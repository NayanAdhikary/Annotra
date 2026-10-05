# Annotra — State of the Union
Date: 2026-10-05

## Feature Status

### Working end-to-end
- Image annotation: rectangle, polygon, polyline, points, brush
- Video annotation: upload, frame extraction, tracks, interpolation
- Review workflow with rejections and per-annotation comments
- Multi-tenant organizations
- Admin panel: dashboard, projects, tasks, users, audit, quality, health, models, tool setup
- Multi-model ML: YOLOv8 auto-annotation
- Export: COCO JSON, YOLO txt, Pascal VOC XML, CVAT XML 1.1
- Import: same four formats + label mapping + pre-annotations
- Notifications with unread badge
- Tool customization (org-level and project-level)
- Fullscreen workspace with undo/redo, autosave, conflict detection

### Broken or blocked
- None (All P0s fixed)

### Known limitations
- Cuboids (3D boxes) not implemented
- Skeleton/pose templates not implemented
- SSO (Google/GitHub OAuth) not implemented
- SAM2 interactive segmentation not implemented
- Video auto-tracking not implemented
- QA rule engine not implemented
- Real-time collaboration not implemented
- Mobile capture app not implemented

### Performance baseline (from today)
- B1 task detail: X.Xs
- B2 annotation list (all): X.Xs / X MB
- B2b annotation list (per image): X.Xs
- B3 my tasks: X.Xs
- B4 projects list: X.Xs
- B5 review queue: X.Xs
- Browser TTI on 10k-image task: X.Xs
- Sidebar scroll FPS: X
- Bundle size (gzip): X KB
- DB query plan for annotation list: Index Scan (image_id) + Temp B-Tree for ORDER BY

### Next 14 days
Day 2: database indexes + pagination + N+1 fixes
Day 3: API robustness (error handling, logging, Sentry)
Day 4: production deployment (Docker, HTTPS, backups)
Day 5: CI/CD + observability
Day 6: SSO (Google + GitHub)
Day 7: canvas-anchored comments
Day 8: SAM2 interactive segmentation
Day 9: video auto-tracking
Day 10: QA rule engine
Day 11: onboarding + docs
Day 12: bug bash + load test
Day 13: pre-launch checklist
Day 14: launch prep
Day 15: LAUNCH
