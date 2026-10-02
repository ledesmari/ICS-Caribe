import { useId, useRef, useState, type FormEvent } from 'react';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { ArrowRight, Paperclip, Send } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ErrorState, Skeleton } from '@/components/ui/States';
import { useAddComment, useAttachFile } from '@/hooks/mutations';
import type { TaskComment, TaskHistoryEntry } from '@/types/entities';
import { ACTION_ICON, showsChange } from './historyIcons';
import { formatDateTime } from '@/utils/dates';
import { errorMessage } from '@/utils/format';

const ago = (iso: string) => (iso ? formatDistanceToNow(parseISO(iso), { addSuffix: true }) : '');

export function CommentsSection({ taskId, assigneeId, comments, isPending, error, onRetry, canComment }: {
  taskId: string;
  assigneeId: string;
  comments: TaskComment[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
  canComment: boolean;
}) {
  const textId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const addComment = useAddComment();
  const attach = useAttachFile();
  const [body, setBody] = useState('');
  const [problem, setProblem] = useState<string | null>(null);

  const send = (e: FormEvent) => {
    e.preventDefault();
    if (!body.trim()) return;
    setProblem(null);
    addComment.mutate({ taskId, body }, { onSuccess: () => setBody(''), onError: (err) => setProblem(`Comment not sent: ${errorMessage(err)}`) });
  };

  return (
    <Card aria-labelledby="comments-h">
      <CardHeader id="comments-h" title={`Comments${comments ? ` (${comments.length})` : ''}`} />
      {isPending ? (
        <div className="space-y-3" aria-hidden><Skeleton className="h-14" /><Skeleton className="h-14" /></div>
      ) : error ? (
        <ErrorState error={error} title="Couldn't load comments" onRetry={onRetry} />
      ) : comments?.length === 0 ? (
        <p className="text-sm text-muted">No comments yet.{canComment ? ' Start the conversation below.' : ''}</p>
      ) : (
        <ol className="space-y-4">
          {comments?.map((c) => (
            <li key={c.id} className="flex gap-3">
              <Avatar person={c.author} />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <span className="font-semibold">{c.author.name || 'Unknown'}</span>
                  <Chip tone={c.author.id === assigneeId ? 'navy' : 'pending'}>{c.author.id === assigneeId ? 'Assignee' : 'Manager'}</Chip>
                  <time dateTime={c.createdOn} title={formatDateTime(c.createdOn, 'PPpp')} className="text-xs text-muted">{ago(c.createdOn)}</time>
                </p>
                <p className="mt-1 text-sm break-words whitespace-pre-wrap text-secondary">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>
      )}

      {canComment && (
        <form onSubmit={send} className="-mx-5 -mb-5 mt-5 border-t border-line bg-white px-5 py-4 max-sm:sticky max-sm:bottom-0 max-sm:rounded-b-3xl">
          <label htmlFor={textId} className="sr-only">Write a comment</label>
          <textarea id={textId} rows={2} maxLength={4000} value={body} placeholder="Write a comment…" disabled={addComment.isPending}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e); }}
            className="w-full resize-y rounded-xl border border-line px-4 py-2 text-sm" />
          <div className="mt-2 flex items-center justify-between gap-2">
            <input ref={fileRef} type="file" multiple className="sr-only" tabIndex={-1} aria-hidden
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = '';
                for (const file of files) {
                  try { await attach.mutateAsync({ taskId, file }); } catch (err) { setProblem(`"${file.name}" wasn't uploaded: ${errorMessage(err)}`); }
                }
              }} />
            <Button variant="ghost" size="icon" aria-label="Attach a file" disabled={attach.isPending} onClick={() => fileRef.current?.click()}
              icon={<Paperclip className="size-5" aria-hidden />} />
            <Button type="submit" variant="secondary" disabled={!body.trim() || addComment.isPending} icon={<Send className="size-4" aria-hidden />}>
              {addComment.isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
          {problem && <p role="alert" className="mt-2 text-sm text-red-700">{problem}</p>}
        </form>
      )}
    </Card>
  );
}

export function HistoryTimeline({ history, isPending, error, onRetry }: {
  history: TaskHistoryEntry[] | undefined; isPending: boolean; error: unknown; onRetry: () => void;
}) {
  const [showAll, setShowAll] = useState(false);
  const MOBILE_LIMIT = 4;
  return (
    <Card aria-labelledby="history-h">
      <CardHeader id="history-h" title="History" />
      {isPending ? (
        <div className="space-y-3" aria-hidden><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
      ) : error ? (
        <ErrorState error={error} title="Couldn't load history" onRetry={onRetry} />
      ) : !history?.length ? (
        <p className="text-sm text-muted">No history yet.</p>
      ) : (
        <>
          <ol className="relative space-y-4 before:absolute before:top-2 before:bottom-2 before:left-[15px] before:w-px before:bg-line">
            {history.map((h, i) => {
              const { icon: Icon, tone } = ACTION_ICON[h.action];
              const showChips = showsChange(h.action, h.fieldName) && (h.oldValue || h.newValue);
              return (
                <li key={h.id} className={`relative flex gap-3 ${!showAll && i >= MOBILE_LIMIT ? 'max-lg:hidden' : ''}`}>
                  <span className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white ${tone}`} aria-hidden>
                    <Icon className="size-4" />
                  </span>
                  <div className="min-w-0 text-sm">
                    <p><span className="font-semibold">{h.actor.name || 'Someone'}</span> <span className="text-secondary">{h.summary || h.fieldName}</span></p>
                    {showChips && (
                      <p className="mt-1 flex flex-wrap items-center gap-1.5">
                        {h.oldValue && <Chip tone="pending">{h.oldValue}</Chip>}
                        {h.oldValue && h.newValue && <ArrowRight className="size-3.5 text-muted" aria-label="to" />}
                        {h.newValue && <Chip tone="navy">{h.newValue}</Chip>}
                      </p>
                    )}
                    <time dateTime={h.createdOn} title={formatDateTime(h.createdOn, 'PPpp')} className="mt-0.5 block text-xs text-muted">{ago(h.createdOn)}</time>
                  </div>
                </li>
              );
            })}
          </ol>
          {history.length > MOBILE_LIMIT && (
            <Button variant="ghost" className="mt-3 lg:hidden" onClick={() => setShowAll((v) => !v)} aria-expanded={showAll}>
              {showAll ? 'Show less' : `See all (${history.length})`}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}
