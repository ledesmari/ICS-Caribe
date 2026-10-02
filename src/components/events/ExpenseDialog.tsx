import { useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { AlertTriangle, Download, Receipt, Trash2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { Skeleton } from '@/components/ui/States';
import { downloadAttachment, useReceipts, useSaveExpense } from '@/hooks/mutations';
import { useAttachments } from '@/hooks/queries';
import { MAX_ATTACHMENT_BYTES } from '@/services/attachmentsService';
import { ExpenseCategory, ExpenseStatus } from '@/types/schema';
import type { EventTask, Expense } from '@/types/entities';
import { EXPENSE_CATEGORY_LABEL, EXPENSE_STATUS_LABEL, errorMessage } from '@/utils/format';

const inputClass = 'min-h-11 w-full rounded-xl border border-line bg-white px-4 text-base aria-[invalid=true]:border-red-600';

function Field({ id, label, required, error, children }: { id: string; label: string; required?: boolean; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">
        {label} {required && <span aria-hidden className="text-red-700">*</span>}
      </label>
      {children}
      {error && <p id={`${id}-err`} className="mt-1 text-sm font-semibold text-red-700">{error}</p>}
    </div>
  );
}

function Receipts({ expenseId }: { expenseId: string }) {
  const ids = [expenseId];
  const receipts = useAttachments(ids);
  const { upload, remove } = useReceipts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const onFiles = async (files: FileList | null) => {
    setProblem(null);
    for (const file of Array.from(files ?? [])) {
      if (file.size > MAX_ATTACHMENT_BYTES) { setProblem(`"${file.name}" is larger than 5 MB.`); continue; }
      try { await upload.mutateAsync({ expenseId, file }); } catch (e) { setProblem(`"${file.name}" wasn't uploaded: ${errorMessage(e)}`); }
    }
  };

  return (
    <section aria-labelledby={`${expenseId}-receipts`} className="rounded-2xl bg-page p-4">
      <h3 id={`${expenseId}-receipts`} className="flex items-center gap-2 text-sm font-bold"><Receipt className="size-4" aria-hidden /> Receipts</h3>
      {receipts.isPending ? <Skeleton className="mt-2 h-10" /> : receipts.isError ? (
        <p className="mt-2 text-sm text-red-700">{errorMessage(receipts.error)}</p>
      ) : receipts.data?.length ? (
        <ul className="mt-2 space-y-1">
          {receipts.data.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-sm">
              <span className="min-w-0 flex-1 truncate">{r.fileName}</span>
              <Button variant="ghost" size="icon" aria-label={`Download ${r.fileName}`} onClick={() => void downloadAttachment(r.id).catch((e) => setProblem(errorMessage(e)))}
                icon={<Download className="size-4" aria-hidden />} />
              <Button variant="ghost" size="icon" aria-label={`Remove ${r.fileName}`} disabled={remove.isPending}
                onClick={() => { if (window.confirm(`Remove "${r.fileName}"?`)) remove.mutate(r.id, { onError: (e) => setProblem(errorMessage(e)) }); }}
                icon={<Trash2 className="size-4" aria-hidden />} />
            </li>
          ))}
        </ul>
      ) : <p className="mt-1 text-sm text-muted">No receipts yet.</p>}
      <input ref={fileRef} type="file" accept="image/*,application/pdf" multiple className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { void onFiles(e.target.files); e.target.value = ''; }} />
      <Button variant="outline" className="mt-3" disabled={upload.isPending} onClick={() => fileRef.current?.click()} icon={<Upload className="size-4" aria-hidden />}>
        {upload.isPending ? 'Uploading…' : 'Add receipt'}
      </Button>
      {problem && <p role="alert" className="mt-2 text-sm text-red-700">{problem}</p>}
    </section>
  );
}

export function ExpenseDialog({ eventId, expense, tasks, onClose }: {
  eventId: string;
  /** null = new expense */
  expense: Expense | null;
  tasks: EventTask[];
  onClose: () => void;
}) {
  const formId = useId();
  const ids = { name: useId(), category: useId(), status: useId(), est: useId(), act: useId(), vendor: useId(), paid: useId(), task: useId() };
  const save = useSaveExpense();
  const [name, setName] = useState(expense?.name ?? '');
  const [category, setCategory] = useState<ExpenseCategory>(expense?.category ?? ExpenseCategory.Other);
  const [status, setStatus] = useState<ExpenseStatus>(expense?.status ?? ExpenseStatus.Estimated);
  const [estimated, setEstimated] = useState(expense?.estimatedAmount?.toString() ?? '');
  const [actual, setActual] = useState(expense?.actualAmount?.toString() ?? '');
  const [vendor, setVendor] = useState(expense?.vendor ?? '');
  const [paymentDate, setPaymentDate] = useState(expense?.paymentDate ?? '');
  const [taskId, setTaskId] = useState(expense?.eventTaskId ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const amount = (v: string) => (v.trim() === '' ? null : Number(v));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!name.trim()) found.name = 'Enter a description.';
    for (const [key, v] of [['est', estimated], ['act', actual]] as const) {
      const n = amount(v);
      if (n !== null && (!Number.isFinite(n) || n < 0)) found[key] = 'Enter an amount of 0 or more.';
    }
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) return document.getElementById(ids[first as keyof typeof ids])?.focus();
    save.mutate(
      {
        expense,
        input: {
          eventId, name: name.trim(), category, status, vendor,
          estimatedAmount: amount(estimated), actualAmount: amount(actual),
          paymentDate: paymentDate || null, eventTaskId: taskId || null,
        },
      },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog
      open
      onClose={() => { if (!save.isPending) onClose(); }}
      title={expense ? 'Edit expense' : 'Add expense'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>Cancel</Button>
          <Button type="submit" form={formId} variant="secondary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save expense'}</Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="space-y-4">
        <Field id={ids.name} label="Description" required error={errors.name}>
          <input id={ids.name} className={inputClass} value={name} maxLength={200} autoFocus aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? `${ids.name}-err` : undefined} onChange={(e) => setName(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id={ids.category} label="Category" required>
            <select id={ids.category} className={inputClass} value={category} onChange={(e) => setCategory(Number(e.target.value) as ExpenseCategory)}>
              {(Object.keys(EXPENSE_CATEGORY_LABEL).map(Number) as ExpenseCategory[]).map((c) => <option key={c} value={c}>{EXPENSE_CATEGORY_LABEL[c]}</option>)}
            </select>
          </Field>
          <Field id={ids.status} label="Status" required>
            <select id={ids.status} className={inputClass} value={status} onChange={(e) => setStatus(Number(e.target.value) as ExpenseStatus)}>
              {(Object.keys(EXPENSE_STATUS_LABEL).map(Number) as ExpenseStatus[]).map((s) => <option key={s} value={s}>{EXPENSE_STATUS_LABEL[s]}</option>)}
            </select>
          </Field>
          <Field id={ids.est} label="Estimated amount" error={errors.est}>
            <input id={ids.est} type="number" inputMode="decimal" min={0} step="0.01" className={`tabular ${inputClass}`} value={estimated}
              aria-invalid={Boolean(errors.est)} onChange={(e) => setEstimated(e.target.value)} />
          </Field>
          <Field id={ids.act} label="Actual amount" error={errors.act}>
            <input id={ids.act} type="number" inputMode="decimal" min={0} step="0.01" className={`tabular ${inputClass}`} value={actual}
              aria-invalid={Boolean(errors.act)} onChange={(e) => setActual(e.target.value)} />
          </Field>
          <Field id={ids.vendor} label="Vendor">
            <input id={ids.vendor} className={inputClass} value={vendor} maxLength={200} onChange={(e) => setVendor(e.target.value)} />
          </Field>
          <Field id={ids.paid} label="Payment date">
            <input id={ids.paid} type="date" className={inputClass} value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </Field>
        </div>
        <Field id={ids.task} label="Linked task">
          <select id={ids.task} className={inputClass} value={taskId} onChange={(e) => setTaskId(e.target.value)}>
            <option value="">No linked task</option>
            {[...tasks].sort((a, b) => a.title.localeCompare(b.title)).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </Field>
        {expense && <Receipts expenseId={expense.id} />}
        {!expense && <p className="text-xs text-muted">You can add receipts after saving.</p>}
        {save.isError && (
          <p role="alert" className="flex gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <AlertTriangle className="size-4 shrink-0" aria-hidden /> Not saved: {errorMessage(save.error)}
          </p>
        )}
      </form>
    </Dialog>
  );
}
