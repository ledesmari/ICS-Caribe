import { useQueries } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, CircleSlash, RefreshCw, ShieldCheck, XCircle } from 'lucide-react';
import { useCurrentUser } from '@/hooks/queries';
import { probes } from '@/services/diagnosticsService';
import { ROLE_NAMES } from '@/types/schema';

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function Row({ label, state, detail }: { label: string; state: 'loading' | 'ok' | 'error' | 'off'; detail: string }) {
  const icon = {
    loading: <span className="size-5 animate-pulse rounded-full bg-line" aria-hidden />,
    ok: <CheckCircle2 className="size-5 text-green-600" aria-hidden />,
    error: <XCircle className="size-5 text-red-600" aria-hidden />,
    off: <CircleSlash className="size-5 text-muted" aria-hidden />,
  }[state];
  const status = { loading: 'Checking', ok: 'OK', error: 'Failed', off: 'Not connected' }[state];
  return (
    <li className="flex min-h-14 items-start gap-3 border-t border-line px-5 py-3 first:border-t-0">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{label}</p>
        {state === 'loading' ? (
          <span className="mt-1 block h-3 w-40 animate-pulse rounded bg-line" aria-hidden />
        ) : (
          <p className={`break-words text-sm ${state === 'error' ? 'text-red-700' : 'text-muted'}`}>{detail}</p>
        )}
      </div>
      <span className="sr-only">{status}</span>
    </li>
  );
}

export default function DiagnosticsPage() {
  const user = useCurrentUser();
  const results = useQueries({
    queries: probes.map((p) => ({ queryKey: ['diagnostics', p.key], queryFn: p.run, retry: false, staleTime: 0 })),
  });

  const okCount = results.filter((r) => r.isSuccess).length;
  const failed = results.filter((r) => r.isError).length;
  const running = results.some((r) => r.isFetching) || user.isFetching;
  const hasEpmRole = user.data?.roles.some((r) => r === ROLE_NAMES.manager || r === ROLE_NAMES.member) ?? false;

  const rerun = () => {
    void user.refetch();
    results.forEach((r) => void r.refetch());
  };

  return (
    <div className="max-w-3xl">
      <p className="text-sm font-semibold text-muted">Settings</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-extrabold tracking-tight">Diagnostics</h1>
        <button
          type="button"
          onClick={rerun}
          disabled={running}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy-700 px-5 font-semibold text-white disabled:opacity-60"
        >
          <RefreshCw className={`size-4 ${running ? 'animate-spin' : ''}`} aria-hidden />
          Run again
        </button>
      </div>
      <p className="mt-2 text-secondary" aria-live="polite">
        {running ? 'Running checks…' : `${okCount} of ${probes.length} data sources OK${failed ? ` · ${failed} failed` : ''}`}
      </p>

      <section aria-labelledby="user-heading" className="mt-6 rounded-3xl border border-line bg-white p-5">
        <h2 id="user-heading" className="flex items-center gap-2 text-lg font-bold">
          <ShieldCheck className="size-5 text-navy-700" aria-hidden /> Signed-in user
        </h2>
        {user.isPending ? (
          <div className="mt-3 space-y-2" aria-hidden>
            <span className="block h-4 w-48 animate-pulse rounded bg-line" />
            <span className="block h-3 w-64 animate-pulse rounded bg-line" />
          </div>
        ) : user.isError ? (
          <div className="mt-3 text-red-700" role="alert">
            <p>{errorText(user.error)}</p>
            <button type="button" onClick={() => void user.refetch()} className="mt-2 min-h-11 font-semibold text-navy-700 underline">
              Retry
            </button>
          </div>
        ) : (
          <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted">Name</dt>
            <dd className="font-semibold">{user.data.name || '—'}</dd>
            <dt className="text-muted">Email</dt>
            <dd className="break-all">{user.data.email || '—'}</dd>
            <dt className="text-muted">User ID</dt>
            <dd className="break-all font-mono text-xs">{user.data.id}</dd>
            <dt className="text-muted">Roles</dt>
            <dd>{user.data.roles.length ? user.data.roles.join(', ') : 'None'}</dd>
            <dt className="text-muted">EPM access</dt>
            <dd>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${user.data.isManager ? 'bg-navy-100 text-navy-700' : 'bg-pending-bg text-pending'}`}>
                {user.data.isManager ? 'Manager' : 'Member'}
              </span>
            </dd>
          </dl>
        )}
        {user.isSuccess && !hasEpmRole && (
          <p className="mt-4 flex gap-2 rounded-xl bg-orange-50 p-3 text-sm text-orange-900">
            <AlertTriangle className="size-5 shrink-0" aria-hidden />
            You don't have the "{ROLE_NAMES.manager}" or "{ROLE_NAMES.member}" security role yet. Ask an admin to create and assign them.
          </p>
        )}
      </section>

      <section aria-labelledby="sources-heading" className="mt-6 overflow-hidden rounded-3xl border border-line bg-white">
        <h2 id="sources-heading" className="px-5 pt-5 pb-2 text-lg font-bold">Data sources</h2>
        <ul>
          {probes.map((p, i) => {
            const r = results[i];
            const state = !r || r.isPending ? 'loading' : r.isError ? 'error' : 'ok';
            return <Row key={p.key} label={p.label} state={state} detail={r?.isError ? errorText(r.error) : (r?.data ?? '')} />;
          })}
          <Row
            label="Microsoft Graph (/me)"
            state="off"
            detail="Not used in a Code App. Outlook/Teams scheduling will use the Office 365 connectors in the Meetings milestone."
          />
        </ul>
      </section>
    </div>
  );
}
