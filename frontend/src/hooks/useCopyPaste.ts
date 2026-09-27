import { useEffect } from 'react';
import { useAnnotationStore, makeLocalId } from '../store/annotationStore';
import { useHistoryStore } from '../store/historyStore';
import { AddAnnotationCommand } from '../commands/AnnotationCommands';

let clipboard: any[] = [];

export function useCopyPaste() {
  const execute = useHistoryStore((s) => s.execute);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );
      if (inInput) return;

      const mod = e.ctrlKey || e.metaKey;
      if (!mod) return;

      const store = useAnnotationStore.getState();
      const { selectedIds, annotations, frame } = store;

      if (e.key.toLowerCase() === 'c') {
        // Copy selected annotations
        clipboard = annotations.filter((a) => selectedIds.includes(a.id))
          .map((a) => ({ ...a }));
        e.preventDefault();
        return;
      }

      if (e.key.toLowerCase() === 'v' && clipboard.length > 0) {
        // Paste — offset by 10px so they don't hide the originals
        for (const src of clipboard) {
          const clone = {
            ...src,
            id: makeLocalId(),
            serverId: undefined,
            frame,
            points: src.points.map((v: number, i: number) =>
              i % 2 === 0 ? v + 10 : v + 10,
            ),
          };
          execute(new AddAnnotationCommand(clone));
        }
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [execute]);
}
