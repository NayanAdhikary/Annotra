# Annotra UI Contracts

## §7.4 The Three Contracts

When building or modifying components in this application, you must adhere to the following three contracts to ensure predictable state and code hygiene:

1. **No Local Selection State**
   No component may define its own local `selectedId` state. All selection state must be managed centrally through the `useAnnotationStore` Zustand store. This ensures the canvas and sidebar remain perfectly synced.

2. **Save Status Wrapper**
   Every mutating API call (POST, PATCH, DELETE) made from the UI must be wrapped using the `useSaveStatus()` hook. This guarantees that the global save indicator in the toolbar correctly displays "Saving…", "✓ Saved", or "⚠ Save failed" to the user.

3. **Optimistic Updates**
   Mutations should use optimistic UI updates. Update the local Zustand store state immediately (for example, generating a temporary local ID for new annotations), and then seamlessly swap in the server's response upon success. If the server request fails, the local state must be rolled back to its previous state.

4. **Debounced Persistence**
   Never call mutating API endpoints directly from high-frequency UI events like Konva `onDragMove` or `onTransform`. Instead, update the local Zustand store and rely on `useDebouncedPersist` to automatically coalesce these local changes into a single API request after interaction pauses.

## Coordinate Model

- **Image space**: pixel coordinates of the source image. All annotations, all
  hits, all geometry live here. Never changes with viewport.
- **Screen space**: pixels inside the Konva container. Used only for zoom
  anchors and drag deltas.
- **Konva Stage x/y/scaleX/scaleY**: the one-way transform image → screen.

Rules:
1. Never call `getPointerPosition()` outside `usePan` and `useZoom`.
2. Use `getRelativePointerPosition()` in all drawing code — it returns image space.
3. Never write `scaleX` on any shape; only on the Stage.
4. Handles (vertex circles, transformer anchors) divide their size by scale
   so they stay constant on screen.

## Undo/Redo Architecture (Command Pattern)

**Why commands, not snapshots:**
Two ways to implement undo:
- **Snapshot:** before each mutation, store a deep copy of annotations. Undo = restore the snapshot. Simple to write, but memory explodes on a task with 5,000 annotations — one bad wheel-drag can hold 50MB.
- **Command (inverse operation):** every mutation is an object with `apply()` and `invert()`. Undo = call `invert()` on the top of the stack. Memory cost = a few coordinate arrays per operation. This is what CVAT does, and this is what Annotra uses.

## Undo/Redo Design

- History is scoped to the current task. Navigating to a different task
  clears the stack.
- History is global across frames within a task. Undoing a change made on
  frame 1 while on frame 3 does not change the current frame.
- Commands within a 400ms window that have a `coalesceWith` implementation
  merge into a single history entry.
- The stack holds up to 100 entries; older entries are dropped.
- Every mutation in the store MUST go through `useHistoryStore.execute()`.
  Direct calls to `addLocal`, `removeLocal`, `replaceMany` are only allowed
  from inside `makeContext()` and during in-progress drags (which commit a
  single command on drag end).
