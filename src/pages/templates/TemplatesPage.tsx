import { useMemo, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutTemplate, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/PageHeader';
import { TemplateEditor } from '@/components/templates/TemplateEditor';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState, LoadingRegion, Skeleton } from '@/components/ui/States';
import { useTemplateAdmin } from '@/hooks/mutations';
import { useCurrentUser, useEvents, useTemplateTaskCounts, useTemplates } from '@/hooks/queries';
import { errorMessage } from '@/utils/format';
import { colorForTemplate } from '@/utils/templateColors';

export default function TemplatesPage() {
  const user = useCurrentUser();
  const templates = useTemplates();
  const counts = useTemplateTaskCounts();
  const events = useEvents();
  const { createTemplate } = useTemplateAdmin();
  const [params, setParams] = useSearchParams();
  const [newName, setNewName] = useState('');
  const isManager = user.data?.isManager ?? false;

  const list = useMemo(() => templates.data ?? [], [templates.data]);
  const selectedId = params.get('id') ?? list[0]?.id ?? null;
  const selected = list.find((t) => t.id === selectedId) ?? null;
  const usedBy = useMemo(() => {
    const m = new Map<string, number>();
    events.data?.forEach((e) => { if (e.template?.id) m.set(e.template.id, (m.get(e.template.id) ?? 0) + 1); });
    return m;
  }, [events.data]);

  const select = (id: string | null) => setParams(id ? { id } : {}, { replace: true });
  const create = (e: FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createTemplate.mutate(newName, { onSuccess: (id) => { setNewName(''); select(id); } });
  };

  return (
    <>
      <PageHeader title="Templates" subtitle={isManager ? 'Reusable checklists for new events' : 'Checklists used to create events (read-only)'} />

      {templates.isPending ? (
        <LoadingRegion label="Loading templates">
          <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]"><Skeleton className="h-64 rounded-3xl" /><Skeleton className="h-96 rounded-3xl" /></div>
        </LoadingRegion>
      ) : templates.isError ? (
        <ErrorState error={templates.error} title="Couldn't load templates" onRetry={() => void templates.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="space-y-3">
            {isManager && (
              <form onSubmit={create} className="rounded-3xl border border-line bg-white p-4">
                <label htmlFor="new-template" className="mb-1.5 block text-sm font-semibold">New template</label>
                <div className="flex gap-2">
                  <input id="new-template" className="min-h-11 min-w-0 flex-1 rounded-xl border border-line px-3 text-sm" placeholder="e.g. Leadership training"
                    value={newName} maxLength={200} disabled={createTemplate.isPending} onChange={(e) => setNewName(e.target.value)} />
                  <Button type="submit" size="icon" aria-label="Create template" disabled={!newName.trim() || createTemplate.isPending} icon={<Plus className="size-5" aria-hidden />} />
                </div>
                {createTemplate.isError && <p role="alert" className="mt-2 text-sm text-red-700">{errorMessage(createTemplate.error)}</p>}
              </form>
            )}
            {list.length === 0 ? (
              <EmptyState icon={<LayoutTemplate className="size-6" />} title="No templates yet"
                description={isManager ? 'Create one above, then add its tasks.' : 'A manager has not created any templates yet.'} />
            ) : (
              <ul className="overflow-hidden rounded-3xl border border-line bg-white" aria-label="Templates">
                {list.map((t) => {
                  const active = t.id === selected?.id;
                  const n = counts.data?.get(t.id);
                  return (
                    <li key={t.id} className="border-t border-line first:border-t-0">
                      <button type="button" onClick={() => select(t.id)} aria-current={active ? 'true' : undefined}
                        className={`flex min-h-14 w-full items-center justify-between gap-3 px-4 text-left ${active ? 'bg-navy-50 shadow-[inset_3px_0_0_var(--color-navy-700)]' : 'hover:bg-navy-50/60'}`}>
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={`size-2.5 shrink-0 rounded-full ${colorForTemplate(t).solid}`} aria-hidden />
                          <span className="truncate font-semibold">{t.name}</span>
                        </span>
                        <span className="tabular shrink-0 text-xs text-muted">{n === undefined ? '' : `${n} task${n === 1 ? '' : 's'}`}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="min-w-0">
            {selected ? (
              <TemplateEditor key={selected.id} template={selected} usedBy={usedBy.get(selected.id) ?? 0} canEdit={isManager}
                onDeleted={() => select(null)} />
            ) : list.length > 0 ? (
              <EmptyState title="Select a template" description="Choose a template to see its tasks." />
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
