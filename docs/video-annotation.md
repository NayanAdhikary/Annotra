# Video Annotation

Video annotation uses the same canvas as images, with one extra concept: **tracks**.

## The model

- A **track** is one object identity across frames.
- Inside a track, an annotator places **keyframes** — frames they explicitly drew.
- Between keyframes, the tool **interpolates** the shape.

## Workflow

1. Upload a video to a video task.
2. Frames extract automatically (FFmpeg, in a Celery worker).
3. Open the video workspace.
4. Draw a box on frame 1 — this creates a new track.
5. Jump to frame 60. Draw the object again — this adds a keyframe to the same track.
6. Scrub between the two — the shape interpolates.

## Visual language

- **Solid outline** = keyframe (you drew this)
- **Dashed outline** = interpolated (the tool computed this)

## Rules

- Polygons with different vertex counts between keyframes hold the previous keyframe.
- A keyframe with `outside=true` hides the object from that frame onward.
- Deleting a track removes every frame in its range.

## Keyboard

- Space — play/pause
- ← / → — one frame back/forward
- ↑ / ↓ — 10 frames back/forward
