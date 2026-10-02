import { useId, useRef, useState, type DragEvent } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { Camera, Download, File, FileImage, FileSpreadsheet, FileText, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { downloadAttachment, useAttachFile, useRemoveFile } from '@/hooks/mutations';
import { MAX_ATTACHMENT_BYTES } from '@/services/attachmentsService';
import type { Attachment } from '@/types/entities';
import { errorMessage } from '@/utils/format';

function fileIcon(mime: string, name: string) {
  if (mime.startsWith('image/')) return FileImage;
  if (/sheet|excel|csv/i.test(mime) || /\.(xlsx?|csv)$/i.test(name)) return FileSpreadsheet;
  if (/pdf|word|text|document/i.test(mime)) return FileText;
  return File;
}

function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsSection({ taskId, attachments, isPending, error, onRetry, canEdit }: {
  taskId: string;
  attachments: Attachment[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  canEdit: boolean;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const attach = useAttachFile();
  const remove = useRemoveFile();
  const [problem, setProblem] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setProblem(null);
    for (const file of Array.from(files)) {
      if (file.size > MAX_ATTACHMENT_BYTES) {
        setProblem(`"${file.name}" is larger than 5 MB.`);
        continue;
      }
      try {
        await attach.mutateAsync({ taskId, file });
      } catch (e) {
        setProblem(`"${file.name}" wasn't uploaded: ${errorMessage(e)}`);
      }
    }
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (canEdit) void upload(e.dataTransfer.files);
  };

  const download = async (a: Attachment) => {
    setBusyId(a.id);
    setProblem(null);
    try {
      await downloadAttachment(a.id);
    } catch (e) {
      setProblem(`Couldn't download "${a.fileName}": ${errorMessage(e)}`);
    } finally {
      setBusyId(null);
    }
  };

  const onRemove = (a: Attachment) => {
    if (!window.confirm(`Remove "${a.fileName}"? This can't be undone.`)) return;
    setProblem(null);
    remove.mutate({ taskId, attachment: a }, { onError: (e) => setProblem(`"${a.fileName}" wasn't removed: ${errorMessage(e)}`) });
  };

  return (
    <Card aria-labelledby="attachments-h">
      <CardHeader id="attachments-h" title={`Attachments${attachments ? ` (${attachments.length})` : ''}`} />
      {isPending ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" aria-hidden><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : error ? (
        <ErrorState error={error} title="Couldn't load attachments" onRetry={onRetry} />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {attachments?.map((a) => {
            const Icon = fileIcon(a.mimeType, a.fileName);
            return (
              <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy-700" aria-hidden><Icon className="size-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold" title={a.fileName}>{a.fileName}</span>
                  <span className="block truncate text-xs text-muted">
                    {sizeLabel(a.fileSize)} · {a.author.name || 'Unknown'} · {a.createdOn ? formatDistanceToNow(parseISO(a.createdOn), { addSuffix: true }) : ''}
                  </span>
                </span>
                <Button variant="ghost" size="icon" aria-label={`Download ${a.fileName}`} disabled={busyId === a.id}
                  onClick={() => void download(a)} icon={<Download className="size-4" aria-hidden />} />
                {canEdit && (
                  <Button variant="ghost" size="icon" aria-label={`Remove ${a.fileName}`} disabled={remove.isPending}
                    onClick={() => onRemove(a)} icon={<Trash2 className="size-4" aria-hidden />} />
                )}
              </li>
            );
          })}
          {canEdit && (
            <li className="hidden sm:block">
              <label
                htmlFor={inputId}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex h-full min-h-20 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-3 text-sm font-semibold ${
                  dragging ? 'border-navy-700 bg-navy-50 text-navy-700' : 'border-line text-secondary hover:bg-navy-50'
                }`}
              >
                <Upload className="size-4" aria-hidden /> {attach.isPending ? 'Uploading…' : 'Upload or drop files'}
              </label>
            </li>
          )}
        </ul>
      )}
      {attachments?.length === 0 && !canEdit && <p className="text-sm text-muted">No files attached.</p>}

      {canEdit && (
        <>
          <input id={inputId} ref={fileRef} type="file" multiple className="sr-only" tabIndex={-1}
            onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
            onChange={(e) => { void upload(e.target.files); e.target.value = ''; }} />
          <div className="mt-3 grid grid-cols-2 gap-2 sm:hidden">
            <Button variant="outline" className="justify-center" disabled={attach.isPending} onClick={() => cameraRef.current?.click()} icon={<Camera className="size-4" aria-hidden />}>Take photo</Button>
            <Button variant="outline" className="justify-center" disabled={attach.isPending} onClick={() => fileRef.current?.click()} icon={<Upload className="size-4" aria-hidden />}>Upload file</Button>
          </div>
          <Button variant="outline" className="mt-3 hidden sm:inline-flex" disabled={attach.isPending} onClick={() => fileRef.current?.click()} icon={<Upload className="size-4" aria-hidden />}>
            {attach.isPending ? 'Uploading…' : 'Choose files'}
          </Button>
          <p className="mt-2 text-xs text-muted">Up to 5 MB per file.</p>
        </>
      )}
      {problem && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">{problem}</p>}
    </Card>
  );
}
