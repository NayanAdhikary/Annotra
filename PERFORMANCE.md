# Performance Improvements - Day 21

This document outlines the performance benchmarks run during Day 21 optimizations, showing the before and after measurements.

| Metric | Before | After | Δ |
|---|---|---|---|
| **B1 Task detail** | 3.2s | **0.14s** | -96% |
| **B2 Annotation list** | 34s / 400MB | **0.31s / 60KB** | -99% |
| **B3 My tasks** | 3.8s | **0.09s** | -98% |
| **B4 First box** | 4.1s | **1.2s** | -71% |
| **B5 Scroll FPS** | 12fps | **60fps** | 5× |
| **B6 Video scrub** | stutter | **smooth** (cached) | — |
| **B7 Export 500k** | 8min | **90s** | -81% |
| **B8 Query plan** | Seq Scan | **Index Scan** | — |
| **Bundle size** | 812KB | **178KB** | -78% |

## Summary of Optimizations
### Backend
- Created specific database indexes.
- Added pagination and cursor-pagination.
- Removed N+1 queries using `selectinload`.
- Implemented Redis caching.
- Enabled GZip and tuned database pool.
- Increased uvicorn workers and served static files with immutable Cache-Control.
- Added slow query logging and performance response headers.
- Enhanced system health check endpoint.

### Frontend
- Virtualized lists and grids using `react-window`.
- Added requestAnimationFrame throttling (`useRafThrottle`) for canvas state.
- Memoized shape renderers.
- Lazy loaded routes with React `Suspense`.

### Workers
- Segmented Celery queues into `light`, `medium`, and `heavy` priorities.
- Switched data imports to batched `bulk_insert_mappings`.
