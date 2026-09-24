import { useEffect, useRef, useCallback } from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import { annotationsApi } from '../api/annotations';
import { useSaveStatus } from './useSaveStatus';

const DEBOUNCE_MS = 400;
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 8000];

interface QueueEntry {
  id: string;
  serverId: number;
  payload: Record<string, any>;
  updatedAt?: string;
  timer: number | null;
  retries: number;
  lastError?: any;
}

/**
 * Watches the annotation store and produces a debounced, retrying, conflict-
 * aware PATCH queue. One entry per annotation. Rapid edits coalesce.
 *
 * Also surfaces conflicts through the annotation store's `conflict` field.
 */
export function useAutosaveQueue() {
  const annotations = useAnnotationStore((s) => s.annotations);
  const wrap = useSaveStatus();
  const queue = useRef<Map<string, QueueEntry>>(new Map());
  const lastSentFingerprint = useRef<Map<string, string>>(new Map());

  const flush = useCallback(
    async (id: string) => {
      const entry = queue.current.get(id);
      if (!entry) return;

      try {
        const resp = await annotationsApi.update(
          entry.serverId,
          entry.payload,
          entry.updatedAt
        );
        // Success: record fingerprint, drop from queue, update version
        lastSentFingerprint.current.set(id, JSON.stringify(entry.payload));
        useAnnotationStore.getState().replaceAnnotation(id, {
          updatedAt: resp.updated_at,
        });
        queue.current.delete(id);
      } catch (err: any) {
        if (err?.response?.status === 409) {
          // Conflict — surface to the user, do NOT retry
          useAnnotationStore.getState().setConflict(id, err.response.data.detail);
          queue.current.delete(id);
          return;
        }
        entry.retries += 1;
        if (entry.retries > MAX_RETRIES) {
          entry.lastError = err;
          useAnnotationStore.getState().setSaveError(id, err);
          queue.current.delete(id);
          return;
        }
        const delay = RETRY_DELAYS[entry.retries - 1] ?? 8000;
        entry.timer = window.setTimeout(() => flush(id), delay);
      }
    },
    [],
  );

  const schedule = useCallback(
    (id: string, serverId: number, payload: Record<string, any>, updatedAt?: string) => {
      const existing = queue.current.get(id);
      if (existing?.timer) window.clearTimeout(existing.timer);

      const entry: QueueEntry = {
        id, serverId, payload, updatedAt,
        timer: null,
        retries: existing?.retries ?? 0,
      };
      entry.timer = window.setTimeout(() => flush(id), DEBOUNCE_MS);
      queue.current.set(id, entry);
    },
    [flush],
  );

  // Watch for changes
  useEffect(() => {
    for (const a of annotations) {
      if (!a.serverId) continue;

      const payload = {
        points: a.points,
        label_id: a.labelId,
        occluded: a.occluded,
      };
      const fingerprint = JSON.stringify(payload);
      if (lastSentFingerprint.current.get(a.id) === fingerprint) continue;
      if (queue.current.get(a.id)?.payload && JSON.stringify(queue.current.get(a.id)!.payload) === fingerprint) continue;

      schedule(a.id, a.serverId, payload, a.updatedAt);
    }
  }, [annotations, schedule]);

  // Flush on page hide
  useEffect(() => {
    const onHide = () => {
      // Synchronously kick every pending entry; can't await during unload.
      queue.current.forEach((entry) => {
        if (entry.timer) window.clearTimeout(entry.timer);
        flush(entry.id);
      });
    };
    window.addEventListener('pagehide', onHide);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') onHide();
    });
    return () => {
      window.removeEventListener('pagehide', onHide);
    };
  }, [flush]);

  // Signal to `useSaveStatus` when work is outstanding
  useEffect(() => {
    const hasPending = () => queue.current.size > 0;
    const interval = window.setInterval(() => {
      if (hasPending()) wrap(async () => {}); // triggers "saving" indicator
    }, 250);
    return () => window.clearInterval(interval);
  }, [wrap]);
}
