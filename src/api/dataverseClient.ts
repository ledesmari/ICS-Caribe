/**
 * Thin layer over the Power Apps SDK generated services.
 * - Converts IOperationResult into thrown DataverseError (React Query friendly).
 * - runSequence(): ordered multi-row writes with compensation on failure, because the
 *   Code Apps SDK has no $batch changeset. Not truly atomic: a compensation can fail too,
 *   in which case the error says so.
 */
import { getClient, type IOperationResult } from '@microsoft/power-apps/data';
import { dataSourcesInfo } from '../../.power/schemas/appschemas/dataSourcesInfo';

/** Same client the generated services use (see deleteRecord). */
const sdkClient = getClient(dataSourcesInfo);

export class DataverseError extends Error {
  readonly status: number | null;
  readonly operation: string;

  constructor(operation: string, message: string, status: number | null = null, options?: ErrorOptions) {
    super(message, options);
    this.name = 'DataverseError';
    this.operation = operation;
    this.status = status;
  }
}

function statusOf(error: unknown): number | null {
  if (error && typeof error === 'object' && 'status' in error && typeof error.status === 'number') return error.status;
  return null;
}

/**
 * Readable text from whatever the SDK returns: an Error, a plain { message } object
 * (PowerDataRuntimeHttpError), a Dataverse { error: { message } } body, or a JSON string of one.
 */
function messageOf(error: unknown, depth = 0): string {
  if (error == null) return 'Unknown error';
  if (typeof error === 'string') {
    const trimmed = error.trim();
    if (depth < 3 && trimmed.startsWith('{')) {
      try {
        return messageOf(JSON.parse(trimmed), depth + 1);
      } catch {
        return trimmed;
      }
    }
    return trimmed || 'Unknown error';
  }
  if (typeof error === 'object' && depth < 3) {
    if ('message' in error && error.message != null) return messageOf(error.message, depth + 1);
    if ('error' in error && error.error != null) return messageOf(error.error, depth + 1);
    try {
      return JSON.stringify(error);
    } catch {
      return 'Unknown error';
    }
  }
  return String(error);
}

const STATUS_HINTS: Record<number, string> = {
  400: 'Dataverse rejected the request (HTTP 400).',
  401: 'Your session expired. Reload the app and try again (HTTP 401).',
  403: "Permission denied (HTTP 403). You — or the person you assigned — don't have access to this EPM data. Ask an admin to check the EPM security roles.",
  404: 'The record no longer exists (HTTP 404).',
  412: 'Someone else changed this record. Reload and try again (HTTP 412).',
  429: 'Dataverse is busy. Wait a moment and try again (HTTP 429).',
};

function toDataverseError(operation: string, error: unknown): DataverseError {
  if (error instanceof DataverseError) return error;
  const status = statusOf(error);
  let message = messageOf(error);
  // The SDK sometimes stringifies its own error object, leaving no detail; fall back to the status.
  if (!message || message === '[object Object]' || message === 'Unknown error') {
    message = (status !== null && STATUS_HINTS[status]) || (status !== null ? `HTTP ${status}` : 'No details were returned.');
  } else if (status === 403) {
    message = `${message} — ${STATUS_HINTS[403]}`;
  }
  return new DataverseError(operation, `${operation} failed: ${message}`, status, { cause: error });
}

/** Await an SDK call and return its data, or throw DataverseError. */
export async function unwrap<T>(operation: string, call: Promise<IOperationResult<T>>): Promise<T> {
  let result: IOperationResult<T>;
  try {
    result = await call;
  } catch (error) {
    throw toDataverseError(operation, error);
  }
  if (!result.success) throw toDataverseError(operation, result.error);
  return result.data;
}

/**
 * Delete one row and throw DataverseError if Dataverse rejects it. The generated services'
 * `delete()` awaits the SDK call but discards its IOperationResult, so a refused delete (e.g. no
 * permission) would look like success. This calls the same SDK client and unwraps the result.
 * `entitySet` comes from ENTITY_SETS in types/schema.ts (same value as the generated dataSourceName).
 */
export async function deleteRecord(operation: string, entitySet: string, id: string): Promise<void> {
  await unwrap(operation, sdkClient.deleteRecordAsync(entitySet, id));
}

/** Like unwrap, for list calls: always returns an array. */
export async function unwrapList<T>(operation: string, call: Promise<IOperationResult<T[]>>): Promise<T[]> {
  return (await unwrap(operation, call)) ?? [];
}

export interface SequenceStep<T = unknown> {
  label: string;
  run: (previous: unknown[]) => Promise<T>;
  /** Undo this step if a later step fails. Omit for steps that need no undo. */
  undo?: (result: T) => Promise<void>;
}

/**
 * Run writes in order. If one fails, undo the completed ones in reverse order and rethrow.
 * Each step receives the results of the previous steps (like $batch Content-ID references).
 */
export async function runSequence(steps: SequenceStep[]): Promise<unknown[]> {
  const done: { step: SequenceStep; result: unknown }[] = [];
  try {
    for (const step of steps) {
      const result = await step.run(done.map((d) => d.result));
      done.push({ step, result });
    }
    return done.map((d) => d.result);
  } catch (error) {
    const failed: string[] = [];
    for (const { step, result } of done.reverse()) {
      if (!step.undo) continue;
      try {
        await step.undo(result);
      } catch {
        failed.push(step.label);
      }
    }
    const base = toDataverseError('Sequence', error);
    if (failed.length === 0) throw base;
    throw new DataverseError(base.operation, `${base.message} (rollback incomplete: ${failed.join(', ')})`, base.status, {
      cause: error,
    });
  }
}
