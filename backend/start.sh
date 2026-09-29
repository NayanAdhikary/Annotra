#!/bin/bash
uvicorn app.main:app \
  --host 0.0.0.0 --port 8000 \
  --workers 4 \
  --loop uvloop \
  --http httptools \
  --limit-concurrency 500 \
  --timeout-keep-alive 30
