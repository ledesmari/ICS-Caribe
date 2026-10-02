/** OData helpers: safe literals, filter builders, lookup binds and typed row readers. */
import { FORMATTED } from '@/types/schema';

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Quote a string literal for $filter (escapes single quotes). */
export function odataString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Validate and return a GUID literal for $filter. Throws on anything else. */
export function odataGuid(value: string): string {
  const v = value.replace(/[{}]/g, '');
  if (!GUID.test(v)) throw new Error(`Invalid GUID: ${value}`);
  return v.toLowerCase();
}

/** "/entityset(guid)" value for "<nav>@odata.bind". */
export function bindRef(entitySet: string, id: string): string {
  return `/${entitySet}(${odataGuid(id)})`;
}

export function eqGuid(column: string, id: string): string {
  return `${column} eq ${odataGuid(id)}`;
}

/** (col eq a or col eq b …) — Dataverse-friendly alternative to `in`. */
export function anyGuid(column: string, ids: readonly string[]): string {
  if (ids.length === 0) throw new Error('anyGuid requires at least one id');
  return `(${ids.map((id) => eqGuid(column, id)).join(' or ')})`;
}

/** Split ids into chunks so `anyGuid` filters stay well under URL length limits. */
export function chunk<T>(items: readonly T[], size = 40): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export function and(...parts: (string | false | null | undefined)[]): string | undefined {
  const kept = parts.filter((p): p is string => Boolean(p));
  return kept.length ? kept.map((p) => (kept.length > 1 ? `(${p})` : p)).join(' and ') : undefined;
}

/* ---------- row readers (SDK rows are loosely typed records) ---------- */

export type Row = Record<string, unknown>;

export function asRow(value: unknown): Row {
  return value && typeof value === 'object' ? (value as Row) : {};
}

export function str(row: Row, key: string): string {
  const v = row[key];
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

export function strOrNull(row: Row, key: string): string | null {
  const v = row[key];
  return typeof v === 'string' && v !== '' ? v : null;
}

export function num(row: Row, key: string): number | null {
  const v = row[key];
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

export function bool(row: Row, key: string): boolean {
  const v = row[key];
  return v === true || v === 1 || v === 'true';
}

/** Display label for a lookup/choice column, e.g. the user's name for _createdby_value. */
export function formatted(row: Row, key: string): string {
  return str(row, `${key}${FORMATTED}`);
}

/** Lookup as {id, name}; null when empty. */
export function lookup(row: Row, key: string): { id: string; name: string } | null {
  const id = strOrNull(row, key);
  return id ? { id, name: formatted(row, key) } : null;
}

/** Date-only column → "yyyy-MM-dd" (Dataverse may append a time part). */
export function dateOnly(row: Row, key: string): string | null {
  const v = strOrNull(row, key);
  return v ? v.slice(0, 10) : null;
}
