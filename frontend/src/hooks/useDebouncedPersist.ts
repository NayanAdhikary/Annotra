import { useEffect, useRef } from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import { annotationsApi } from '../api/annotations';
import { useSaveStatus } from './useSaveStatus';

const DEBOUNCE_MS = 350;

/**
 * Watches the annotations array; whenever a shape's points differ from what
 * was last sent to the server, schedule a PATCH after DEBOUNCE_MS of quiet.
 * Multiple edits to the same annotation coalesce into one request.
 */
export function useDebouncedPersist() {
  const annotations = useAnnotationStore((s) => s.annotations);
  const wrap = useSaveStatus();
  const lastSent = useRef<Record<string, string>>({});
  const timers = useRef<Record<string, number>>({});

  useEffect(() => {
    for (const a of annotations) {
      if (!a.serverId) continue; // not yet acknowledged by server
      const fingerprint = JSON.stringify(a.points) + '|' + a.labelId + '|' + a.occluded;
      if (lastSent.current[a.id] === fingerprint) continue;

      if (timers.current[a.id]) window.clearTimeout(timers.current[a.id]);
      timers.current[a.id] = window.setTimeout(() => {
        lastSent.current[a.id] = fingerprint;
        wrap(() =>
          annotationsApi.update(a.serverId!, {
            points: a.points,
            label_id: a.labelId,
            occluded: a.occluded,
          }),
        ).catch((e) => console.error('debounced persist failed', e));
      }, DEBOUNCE_MS);
    }
  }, [annotations, wrap]);
}
