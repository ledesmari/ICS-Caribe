# Prompt — Delete an event + Change an event's template (CAR-Event Planner Manager)

You are a senior React + TypeScript engineer working in **this repository**: the **CAR-Event Planner Manager**, a **Power Apps Code App** (React 19 + Vite + Tailwind v4 + TanStack Query, `@microsoft/power-apps` SDK) on Dataverse. Add two manager-only features:

1. **Delete an event** — permanently, with an impact summary and typed confirmation, **blocked while the event has upcoming scheduled meetings**.
2. **Change an event's template** — switch the template and **add the new template's tasks** (keep every existing task, skip duplicates). Nothing is ever removed by a template change.

Work **step by step** (section 3). After each step: run `npm run build` and `npm run lint`, fix every error, summarize the files you changed, and **STOP and wait for my review**.

---

## 1. Read first — how this app works (follow these patterns exactly)

| Area | Files | Rule |
|---|---|---|
| Physical names | `src/types/schema.ts` | Prefix **`new_`** (tables `new_epm_*`, columns `new_*`). Only place with column names, binds and choice values. |
| Domain types | `src/types/entities.ts` | camelCase models; `DateOnly` = `"yyyy-MM-dd"` string. |
| Data access | `src/generated/services/*` (generated — **never edit**), `src/api/dataverseClient.ts` (`unwrap`, `unwrapList`, `DataverseError`, `runSequence`), `src/api/odata.ts` | No `fetch`, no Web API URLs, no `$batch`. Code Apps have **no transactions**: multi-row writes use `runSequence` with `undo` steps. |
| Services | `src/services/*` — `eventsService`, `eventTasksService`, `expensesService`, `meetingsService` (+ attendees), `taskActivityService` (comments, history), `attachmentsService`, `templatesService`, `eventCreationService` (`planTasks`, `pool`, `createEventFromTemplate`) | Reuse `planTasks` and the concurrency `pool` (export it if needed) — don't duplicate the cloning logic. |
| Server state | `src/hooks/queries.ts` (`queryKeys`, `useEvent`, `useTasks`, `useTemplates`, `useTemplateTasks`, `useMeetings`, `useCurrentUser`…), `src/hooks/mutations.ts` | New mutations go in `mutations.ts`; invalidate every affected key. |
| Event detail | `src/pages/events/EventDetailPage.tsx` (hero card buttons: Add task, Schedule meeting, Edit event; `isManager`), `src/components/events/EditEventDialog.tsx` | Add the new actions next to "Edit event". |
| UI kit | `src/components/ui/*` (`Button`, `Card`, `Chip`, `Dialog`, `States`, `ProgressBar`, `SegmentedControl`) | Reuse `Dialog`. No new npm dependencies. |
| Dates / format | `src/utils/dates.ts` (`addDaysDateOnly`, `formatDateOnly`, `formatDateRange`, `todayDateOnly`, `phaseFor`, `PHASES`), `src/utils/format.ts` (`pluralize`, `errorMessage`) | Never `new Date("yyyy-MM-dd")`. |
| Scripts | `scripts/add-event-end-date.mjs` | New Dataverse scripts follow the same style (az token, `ORG`, `MSCRM.SolutionUniqueName: CAREventPlannerManager`, `dv()` / `must()`, idempotent, `PublishXml`). **Never run a script yourself** — give me the command and wait. |

**House rules:** strict TypeScript, no `any`, no `enum` (`as const` + unions), no `new_*` strings outside `schema.ts` / `entities.ts` / `services/`. Real `<button>`/`<label>`, visible focus, `aria-label` on icon buttons, touch targets ≥ 44px. Works at **390px and 1440px**. Both features are **managers only** in the UI (`isManager`); Dataverse roles remain the real enforcement.

---

## 2. Key decisions (already made — don't change them)

- **Delete is blocked** when the event has any meeting with status **Scheduled** whose end time is **now or later**. The Teams connector (`CreateTeamsMeeting`) cannot cancel invitations, so the user must cancel it in Outlook/Teams first and then mark it **Cancelled** in the app. Past or Cancelled/Completed meetings don't block.
- **Cancelled status is the normal way** to retire an event that didn't happen. The delete dialog offers "Mark as Cancelled instead".
- **Template change = option B:** keep all current tasks, add the new template's tasks, skip duplicates. **No task is ever deleted** by this feature.
- **Order of writes for the template change:** create the new tasks (+ history) **first**, update the event's template lookup **last**; if the lookup update fails, undo the created tasks.

---

## 3. Steps (stop after each)

### Step 1 — Fix silent deletes (bug)

These calls ignore the SDK result, so a rejected delete looks like success. Wrap each in `unwrap('<Operation>', …)` exactly like the other service calls:

- `attachmentsService.ts` (`AnnotationsService.delete`)
- `meetingsService.ts` (meetings and attendees)
- `eventsService.ts`
- `expensesService.ts`
- `eventTasksService.ts`
- `taskActivityService.ts` (history and comments)
- `templatesService.ts` (templates and template tasks)

Then `grep` for any other `Service.delete(` / `.update(` / `.create(` not wrapped in `unwrap` and fix them too. Make sure existing callers still show errors in the UI.

✅ A failing delete (e.g. no permission) now shows an error instead of silently "succeeding".

### Step 2 — Check how deletes cascade (read-only script)

Create **`scripts/check-event-cascades.mjs`** (read-only; no writes, no publish). It reads `EntityDefinitions(LogicalName='<table>')/OneToManyRelationships?$select=SchemaName,ReferencingEntity,ReferencingAttribute,CascadeConfiguration` for **`new_epm_event`**, **`new_epm_eventtask`**, **`new_epm_meeting`** and **`new_epm_expense`**, and prints a table: relationship · child table · lookup · **Delete** cascade · Assign · Share. Mark each row:

- ✅ `Cascade` — deleting the parent deletes the children
- ⚠️ `RemoveLink` — children would be left without a parent (orphans)
- ⛔ `Restrict` — the parent delete will fail

Expected: every relationship from Event → Event Task / Expense / Meeting, Meeting → Attendee, and Event Task → Comment / History is **Cascade** (Parental). Notes (`annotation`) are deleted automatically with their parent record.

Give me the command (`node scripts/check-event-cascades.mjs`) and **wait for the output**. If any expected relationship is not `Cascade`, **stop** and tell me exactly which one to change to *Parental* in the maker portal (Table → Relationships → the relationship → Type of behavior). Do not build a client-side "delete children one by one" fallback unless I ask for it.

### Step 3 — Delete event: service + mutation

Create **`src/services/eventDeletionService.ts`**:

- `getDeletionImpact(eventId): Promise<DeletionImpact>` — loads (in parallel, using the existing services) and returns:
  - `tasks`, `completedTasks`, `expenses` (+ `paidExpenses`), `meetings`, `attendees`, `comments`, `historyEntries`, `attachments` (Notes on the event's tasks **and** expenses) — counts only;
  - `blockingMeetings: { id, subject, start, end }[]` — status **Scheduled** and `end >= now` (compare ISO UTC strings or `Date` objects from ISO date-times, not date-only strings).
- `deleteEvent(eventId)` — **re-checks blocking meetings right before deleting** (fresh read, not cache); if any exist throws a `DataverseError` with a clear message; otherwise deletes the event once (cascade does the rest).

In `mutations.ts`: `useDeleteEvent()` — on success invalidate `events`, `tasks`, `expenses`, `meetings`, `comments`, `history`, `attachments` (and the calendar keys if the Calendar exists), remove `queryKeys.event(id)` from the cache.

Add `useDeletionImpact(eventId, enabled)` to `queries.ts` (`staleTime: 0`, only while the dialog is open).

### Step 4 — Delete event: UI

- **Event detail hero card** (managers only): add a **"More"** menu button (icon `MoreHorizontal`, `aria-label="More actions"`, a small accessible menu: arrow keys, Esc, focus return) with **Change template** (step 7) and **Delete event** (red text). Keep "Edit event" as is. On mobile the menu items must be ≥ 44px.
- **`DeleteEventDialog.tsx`** (`src/components/events/`), built on `Dialog`:
  - **Loading:** skeleton while the impact loads; error state with Retry.
  - **Blocked state** (`blockingMeetings.length > 0`): title "This event can't be deleted yet"; text explaining that its Teams meetings must be cancelled in Outlook/Teams first, then marked **Cancelled** here; list each blocking meeting (subject, `formatDateTime(start)`) with a link to the event's **Meetings** tab. The only actions are **Go to meetings** and **Close**. No delete button.
  - **Ready state:** title "Delete "<event name>"?"; red-50 warning box: "This permanently deletes the event and everything in it. This can't be undone."; the impact list with real counts using `pluralize` (e.g. "30 tasks (12 completed) · 4 expenses (1 paid) · 2 past meetings, 6 attendees · 18 comments · 95 history entries · 6 files"), only showing non-zero items; an input "Type the event name to confirm" (case-sensitive, trimmed) — **Delete event** (red, `variant` danger; add a danger variant to `buttonStyles` if missing) stays disabled until it matches; secondary **Mark as Cancelled instead** (sets status Cancelled via the existing update mutation and closes) — hidden if already Cancelled; **Keep event**.
  - While deleting: buttons disabled, "Deleting…" label; on error show `errorMessage(e)` inside the dialog.
  - On success: navigate to `/events`, show the app's existing success message pattern (or a `role="status"` banner on the Events page): "<name> was deleted."
- **Meetings:** if the app has no way to mark a meeting **Cancelled**, add a small manager-only **"Mark as cancelled"** action on each Scheduled meeting row in the event's Meetings tab (`MeetingList.tsx`), with a confirm that reminds the user to cancel the Teams invitation in Outlook. Use the existing meetings service/mutation. This is what unblocks the delete.

✅ Delete acceptance:
- An event with an upcoming Scheduled meeting shows the blocked state; after marking that meeting Cancelled, the dialog shows the ready state.
- Typing the wrong name keeps Delete disabled; the right name enables it.
- After deleting, the event, its tasks, expenses, meetings, comments, history and files are gone (spot-check in Dataverse), the Events page, Tasks page, sidebar "Coming up" and the Calendar no longer show it, and nothing errors.
- EPM Members never see the More menu.
- A meeting created in another tab right before confirming still blocks the delete (server re-check).

### Step 5 — Link event tasks to their template task (script + code)

To make duplicate detection reliable from now on, add an optional lookup on Event Task.

1. **`scripts/add-eventtask-template-link.mjs`** (same style as `add-event-end-date.mjs`): `POST RelationshipDefinitions` — `OneToManyRelationshipMetadata`, SchemaName **`new_epm_templatetask_eventtask`**, `ReferencedEntity: new_epm_templatetask`, `ReferencingEntity: new_epm_eventtask`, lookup SchemaName **`new_TemplateTaskId`** (DisplayName "Template Task", RequiredLevel None), `CascadeConfiguration`: `Delete: "RemoveLink"`, all others `"NoCascade"` (deleting a template task must never delete event tasks). Idempotent (skip if the relationship exists), then `PublishXml` for both tables. Give me the command and wait; then tell me to run:
   ```bash
   pac code add-data-source -a dataverse -t new_epm_eventtask
   ```
   and confirm `new_templatetaskid` / `_new_templatetaskid_value` is in the regenerated model.
2. `schema.ts`: `COLUMNS.eventTask.templateTaskId = '_new_templatetaskid_value'`, `templateTaskBind = 'new_TemplateTaskId@odata.bind'`. `entities.ts`: `EventTask.templateTaskId: string | null`. Map it in `eventTasksService` (select + `toEventTask`) and accept `templateTaskId` in `EventTaskInput`.
3. `planTasks` keeps the template task id; **`createEventFromTemplate` now sets `templateTaskId`** on every task it creates.

✅ New events created from a template have `templateTaskId` on every task; old events still load fine (null).

### Step 6 — Change template: service

Create **`src/services/templateChangeService.ts`**:

- `previewTemplateChange(event, currentTasks, newTemplateId | null): TemplateChangePreview` (pure, testable):
  - `newTemplateId === null` → nothing to add; the preview only clears the template.
  - Otherwise plan the new template's tasks with `planTasks(event.eventDate, templateTasks)` (due date = **start date** − days before).
  - A planned task is a **duplicate** (skipped) when an existing task has the same `templateTaskId`, **or** the same title after `trim().toLowerCase()` and collapsing inner spaces. Report the reason.
  - Return `{ toAdd: { title, dueDate, daysBefore, phase, isPastDue }[], skipped: { title, reason }[], keptCount, pastDueCount }` where `isPastDue = dueDate < today` and `phase = phaseFor(daysBefore)`.
  - If the event has no start date, return an error state ("Set the event date before adding template tasks").
- `applyTemplateChange({ event, newTemplate | null, toAdd, assigneeId, skipPastDue }, onProgress)` using `runSequence`:
  1. **Create tasks** (the `pool` from `eventCreationService`, concurrency 4): `status Pending`, `assigneeId` = current user (same as cloning), `templateTaskId`, then one **Task History "Created"** row per task: summary `Added when the template changed from "<old>" to "<new>"` (or `Added from template "<new>"` if the event had none). `undo` = delete every task created in this run (cascade removes their history).
  2. **Update the event lookup** last: set the new template, or **clear it** when `null`.
  - **Clearing the lookup:** `eventsService.toRecord` currently only binds when `templateId` is truthy. Support `templateId === null` by sending `"new_TemplateId@odata.bind": null` in the update. If the SDK rejects a null bind, report the exact error to me and stop — don't invent a workaround.
- If the **same template** is chosen, allow it as **"Add missing tasks"** (useful when tasks were added to the template after the event was created): same preview/apply, step 2 skipped.

Mutation `useChangeEventTemplate()` in `mutations.ts`; invalidate `events`, `event(id)`, `tasks`, `history`, and calendar keys if present.

### Step 7 — Change template: UI

**`ChangeTemplateDialog.tsx`** (`src/components/events/`), opened from the More menu (managers only):

1. **Choose:** current template shown as a chip; a select/radio list of templates (with their color dot if template colors exist, and "N tasks"), plus **No template**. The current template appears as "Current — add missing tasks".
2. **Preview** (updates as the choice changes): "Adds **22** tasks · skips **8** already in the checklist · keeps all **30** current tasks"; a collapsible list of tasks to add grouped by **phase** (`PHASES` labels) with due dates; a collapsible list of skipped tasks with the reason; if `pastDueCount > 0`, an orange-50 note "**5** of these are already past their due date" with a checkbox **Skip tasks whose due date has passed** (default off). For **No template**: "The template will be removed from this event. No tasks are added or removed."
3. **Apply:** primary **Change template** / **Add N tasks** / **Remove template** (label follows the case); progress "Adding tasks… 12 of 22" with a `ProgressBar`; Cancel is disabled while running. On error: show `errorMessage(e)` and state that the created tasks were rolled back (or which ones couldn't be, from the `runSequence` message).
4. On success: close, show a `role="status"` banner on the event page ("Template changed to "<name>" — 22 tasks added"), the Checklist shows the new tasks in their phases.

Also: remove the template field from `EditEventDialog` if it exists there, so the template is only changed through this dialog (one path, with preview).

✅ Template-change acceptance:
- Switching an event from template X (30 tasks) to Y (25 tasks, 8 with the same titles) adds 17 tasks with due dates = start date − days before, each with a "Created" history row, and keeps all 30 originals untouched (status, assignee, comments, files).
- Running "Add missing tasks" again on the same template adds **0** tasks.
- "No template" clears the lookup and adds nothing; the event header no longer shows a template chip.
- "Skip tasks whose due date has passed" works.
- If the lookup update fails, the tasks created in that run are removed.
- New tasks carry `templateTaskId`; duplicate detection uses it first, titles second.

---

## 4. Definition of done

- `npm run build` and `npm run lint` pass; no `any`; no `new_*` outside schema/entities/services.
- Works at 390px and 1440px; dialogs and the More menu are fully keyboard-usable (focus trap, Esc, focus return).
- Loading, empty and error (with Retry) states in both dialogs.
- Final summary: files changed, the two scripts + `pac` command I must run, results of the cascade check, and any assumption you made.
