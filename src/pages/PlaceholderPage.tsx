import { Construction, SearchX } from 'lucide-react';
import { useRouteError } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { ButtonLink } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/States';

/** Routed page whose milestone hasn't been built yet. */
export function PlaceholderPage({ title, subtitle, milestone }: { title: string; subtitle?: string; milestone: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <EmptyState
        icon={<Construction className="size-6" />}
        title="Coming soon"
        description={`This page is part of ${milestone}.`}
        action={<ButtonLink to="/events" variant="outline">Back to events</ButtonLink>}
      />
    </>
  );
}

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <EmptyState
        icon={<SearchX className="size-6" />}
        title="We couldn't find that page"
        description="The link may be old, or the item was deleted."
        action={<ButtonLink to="/events" variant="secondary">Go to events</ButtonLink>}
      />
    </>
  );
}

/** Router-level error boundary. */
export function RouteErrorPage() {
  const error = useRouteError();
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <ErrorState error={error} title="Something went wrong" onRetry={() => window.location.reload()} />
    </div>
  );
}
