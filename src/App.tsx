import { createHashRouter, Navigate, RouterProvider } from 'react-router-dom';
import { AppShell } from '@/components/layout/AppShell';
import { NotFoundPage, RouteErrorPage } from '@/pages/PlaceholderPage';

/** Load a page module only when its route is first visited (keeps the first download small). */
type PageModule = { default: React.ComponentType };
const page = (load: () => Promise<PageModule>) => async () => ({ Component: (await load()).default });

/**
 * Hash routing: the app runs inside the Power Apps player iframe, where path-based
 * deep links can't be served on reload. Each route's `handle.title` feeds the mobile top bar.
 */
const router = createHashRouter([
  {
    element: <AppShell />,
    errorElement: <RouteErrorPage />,
    children: [
      { index: true, element: <Navigate to="/events" replace /> },
      {
        path: 'events',
        handle: { title: 'Events' },
        children: [
          { index: true, lazy: page(() => import('@/pages/events/EventsPage')) },
          { path: 'new', handle: { title: 'New event' }, lazy: page(() => import('@/pages/events/NewEventPage')) },
          { path: ':eventId', handle: { title: 'Event' }, lazy: page(() => import('@/pages/events/EventDetailPage')) },
        ],
      },
      {
        path: 'tasks',
        handle: { title: 'Tasks' },
        children: [
          { index: true, lazy: page(() => import('@/pages/tasks/TasksPage')) },
          { path: ':taskId', handle: { title: 'Task' }, lazy: page(() => import('@/pages/tasks/TaskDetailPage')) },
        ],
      },
      { path: 'calendar', handle: { title: 'Calendar' }, lazy: page(() => import('@/pages/calendar/CalendarPage')) },
      { path: 'meetings', handle: { title: 'Meetings' }, lazy: page(() => import('@/pages/meetings/MeetingsPage')) },
      { path: 'reports', handle: { title: 'Reports' }, lazy: page(() => import('@/pages/reports/ReportsPage')) },
      { path: 'templates', handle: { title: 'Templates' }, lazy: page(() => import('@/pages/templates/TemplatesPage')) },
      { path: 'settings', handle: { title: 'Settings' }, lazy: page(() => import('@/pages/DiagnosticsPage')) },
      { path: '*', handle: { title: 'Not found' }, element: <NotFoundPage /> },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
