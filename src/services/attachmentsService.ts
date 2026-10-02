/** Attachments stored as Dataverse Notes (annotations) on event tasks and expenses. */
import { AnnotationsService } from '@/generated/services/AnnotationsService';
import type { AnnotationsBase } from '@/generated/models/AnnotationsModel';
import { deleteRecord, unwrap, unwrapList } from '@/api/dataverseClient';
import { and, anyGuid, asRow, bindRef, chunk, formatted, num, str, type Row } from '@/api/odata';
import { COLUMNS, ENTITY_SETS } from '@/types/schema';
import type { Attachment, AttachmentContent } from '@/types/entities';

const A = COLUMNS.annotation;
const { createdBy, createdOn } = COLUMNS.common;

/** Dataverse default max attachment size. */
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

export type AttachmentParent = { kind: 'eventTask' | 'expense'; id: string };

export function toAttachment(r: Row): Attachment & { objectId: string } {
  return {
    id: str(r, A.id),
    objectId: str(r, A.objectId),
    fileName: str(r, A.fileName),
    fileSize: num(r, A.fileSize) ?? 0,
    mimeType: str(r, A.mimeType),
    author: { id: str(r, createdBy), name: formatted(r, createdBy) },
    createdOn: str(r, createdOn),
  };
}

async function fileToBase64(file: Blob): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export const attachmentsService = {
  /** Metadata only — never selects documentbody in lists. */
  async listByParents(parentIds: string[]): Promise<(Attachment & { objectId: string })[]> {
    if (parentIds.length === 0) return [];
    const pages = await Promise.all(chunk(parentIds).map((ids) => unwrapList('List attachments', AnnotationsService.getAll({
      select: [A.id, A.fileName, A.fileSize, A.mimeType, A.objectId, createdBy, createdOn],
      filter: and(anyGuid(A.objectId, ids), `${A.isDocument} eq true`),
      orderBy: [`${createdOn} desc`],
    }))));
    return pages.flat().map((r) => toAttachment(asRow(r))).sort((a, b) => b.createdOn.localeCompare(a.createdOn));
  },

  async download(id: string): Promise<AttachmentContent> {
    const r = asRow(await unwrap('Download attachment', AnnotationsService.get(id, { select: [A.documentBody, A.fileName, A.mimeType] })));
    return { fileName: str(r, A.fileName), mimeType: str(r, A.mimeType), documentBody: str(r, A.documentBody) };
  },

  async upload(parent: AttachmentParent, file: File): Promise<string> {
    if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`"${file.name}" is larger than 5 MB.`);
    if (file.size === 0) throw new Error(`"${file.name}" is empty.`);
    const record: Omit<AnnotationsBase, 'annotationid'> = {
      subject: file.name.slice(0, 500),
      isdocument: true,
      filename: file.name,
      mimetype: file.type || 'application/octet-stream',
      documentbody: await fileToBase64(file),
    };
    if (parent.kind === 'eventTask') record[A.eventTaskBind] = bindRef(ENTITY_SETS.eventTask, parent.id);
    else record[A.expenseBind] = bindRef(ENTITY_SETS.expense, parent.id);
    const created = await unwrap('Upload attachment', AnnotationsService.create(record));
    return str(asRow(created), A.id);
  },

  async remove(id: string): Promise<void> {
    await deleteRecord('Delete attachment', ENTITY_SETS.annotation, id);
  },
};
