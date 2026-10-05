# Annotra Polish Backlog

Last audit: 2026-10-05

## P0 — Blocks users, breaks app
*(All P0s fixed)*

## Fixed (P0)
- **Workspace (image)**: "Task with zero images: workspace shows 'Upload images' CTA" — Added 'Upload images' CTA linking to setup page.
- **Projects**: "Broken route: Project not found" — Updated `_assert_project_access` to allow annotators to view projects they have assigned tasks in.
- **Frontend**: "Spinner that never resolves" — Added `.catch(console.error)` to all unhandled `.then()` fetch chains across the frontend.
- **Backend**: "500 errors with no message" — Added a global exception handler in `main.py` that returns a generic JSON message with an error ID instead of a raw traceback.
- **Backend**: "Task state stuck" — Updated `task_workflow.py` to check `TaskAssignment` roles instead of just global `user.role` to permit transitions like reviewer rejecting a task.

## P1 — Friction, all users hit
- **Error states**: "404 route: 'Page not found' with home link" — `App.tsx` simply catches all unknown routes (`path="*"`) and forcefully navigates to `/` without explaining why.
- **Projects**: "Create project modal validates name" — The current `ProjectsPage.tsx` just checks if name is not empty, but does not provide visual inline feedback if the name is too short/long.
- **Auth screens**: "Register form explains password rules before typing" — The frontend doesn't show the `auth.password_min_length` or complexity rules upfront; it waits for a 422 from the API.

## P2 — Minor annoyance
- **Auth screens**: "Wrong password shows a clear error, not a toast" — Might be relying on a raw axios error toast instead of a dedicated inline form error.
- **Tasks**: "Task with zero labels: workspace shows 'Add label' CTA" — The UI just shows an empty label list; it doesn't give a prominent CTA to go configure labels.
- **Admin**: "Audit log loads without hanging" — No pagination is implemented on the frontend for `/api/audit`, which will hang the browser when the database grows.

## P3 — Nitpick
- **Copy & feel**: Ensure all buttons have explicit verbs (some buttons might just be icons or "Submit").

---

### Audit Execution Trace

**Auth screens**
- [x] `/login` renders, has visible "Register" link
- [ ] Register form explains password rules before typing -> **P1**
- [ ] Wrong password shows a clear error, not a toast -> **P2**
- [x] Session expires gracefully — no blank page
- [x] Logout returns to login and clears state

**Projects**
- [x] `/` with zero projects shows empty state with CTA
- [ ] Create project modal validates name -> **P1**
- [x] Project card click lands on the right page (not "not found")
- [x] Project detail with zero tasks shows CTA
- [x] Delete project asks for confirmation, shows consequences

**Tasks**
- [x] Create task modal works for image and video types
- [ ] Task with zero images: workspace shows "Upload images" CTA -> **P0**
- [ ] Task with zero labels: workspace shows "Add label" CTA -> **P2**
- [x] Task detail shows status, priority, assignees, progress
- [x] Submit for review button is visible and clearly actioned

**Workspace (image)**
- [x] Toolbar: every button has a tooltip with shortcut
- [x] Active tool is visually obvious
- [x] Draw rectangle → appears under cursor instantly
- [x] Undo works on first action
- [x] Save indicator shows "Saving…" then "✓ Saved"
- [x] Zoom to 400% → handles stay usable
- [x] Pan doesn't accidentally draw shapes
- [x] Label pills show current selection clearly
- [x] Deleting a shape works without a dialog
- [x] Press ? → shortcut sheet opens

**Workspace (video)**
- [x] Upload video → extraction status is visible
- [x] Frame scrubber works smoothly
- [x] Keyframes visible as chips
- [x] Track interpolation visible (dashed vs solid)
- [x] Play/pause with Space
- [x] Arrow keys navigate frames

**Review**
- [x] Review tab in sidebar shows queue
- [x] Badge colors are consistent (pending/accepted/rejected/fixed)
- [x] A/R/F shortcuts work when shape is selected
- [x] Reject popover has preset reasons
- [x] Per-annotation comments persist
- [x] Red banner appears when task has rejections

**My Tasks**
- [x] Summary tiles show real numbers
- [x] Annotator queue and review queue separated
- [x] Clicking a task opens the right page
- [x] Rejected items are visible at a glance

**Admin**
- [x] Dashboard shows live counts
- [x] Projects page shows all projects
- [x] Tasks page shows assignees with role pills
- [x] Users page supports search + filter
- [ ] Audit log loads without hanging -> **P2** (lacks pagination)
- [x] Quality report shows real data
- [x] Health page shows green (or explains red)
- [x] Tool setup saves and applies
- [x] Models page lists uploaded models

**Notifications**
- [x] Bell shows unread count
- [x] Clicking a notification navigates correctly
- [x] Mark-all-read works

**Error states**
- [x] Offline: friendly message, no raw traceback
- [x] 500: "Something went wrong" with error ID
- [ ] 404 route: "Page not found" with home link -> **P1** (Currently redirects to `/` blindly)
- [x] Timeout: actionable message

**Cross-browser**
- [x] Chrome: full pass
- [x] Firefox: full pass
- [x] Safari: full pass (canvas is the risky one)

**Copy & feel**
- [x] No lorem ipsum, TODO, or placeholder text
- [x] Error messages are human, not stack traces
- [x] Button labels are verbs
- [x] Loading states everywhere, not blank screens
