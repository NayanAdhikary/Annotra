import { useCallback, useEffect, useRef, useState } from 'react';
import { useViewportStore } from '../store/viewportStore';

export function usePan(stageRef: React.RefObject<any>, activeTool: string) {
  const setLive = useViewportStore((s) => s.setLive);
  const [spaceDown, setSpaceDown] = useState(false);
  const panRef = useRef<{ sx: number; sy: number; vx: number; vy: number } | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(t?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        setSpaceDown(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpaceDown(false);
        panRef.current = null;
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  const wantsPan = (e: any) =>
    e.evt.button === 1 || (e.evt.button === 0 && spaceDown);

  const onMouseDown = useCallback(
    (e: any) => {
      if (!wantsPan(e)) return false;
      e.evt.preventDefault();
      const p = stageRef.current?.getPointerPosition();
      if (!p) return false;

      const { live } = useViewportStore.getState();
      panRef.current = { sx: p.x, sy: p.y, vx: live.x, vy: live.y };
      stageRef.current.container().style.cursor = 'grabbing';
      return true;
    },
    [stageRef, spaceDown],
  );

  const onMouseMove = useCallback(() => {
    const pan = panRef.current;
    if (!pan) return false;
    const p = stageRef.current?.getPointerPosition();
    if (!p) return false;
    setLive({ x: pan.vx + (p.x - pan.sx), y: pan.vy + (p.y - pan.sy) });
    return true;
  }, [stageRef, setLive]);

  const onMouseUp = useCallback(() => {
    if (!panRef.current) return false;
    panRef.current = null;
    const c = stageRef.current?.container();
    if (c) c.style.cursor = spaceDown ? 'grab' : 'default';
    return true;
  }, [stageRef, spaceDown]);

  const cursor = panRef.current
    ? 'grabbing'
    : spaceDown
      ? 'grab'
      : activeTool === 'select'
        ? 'default'
        : 'crosshair';

  const startProgrammatic = useCallback((e: any) => {
    const p = stageRef.current?.getPointerPosition();
    if (!p) return;
    const { live } = useViewportStore.getState();
    panRef.current = { sx: p.x, sy: p.y, vx: live.x, vy: live.y };
    if (stageRef.current?.container()) {
      stageRef.current.container().style.cursor = 'grabbing';
    }
  }, [stageRef]);

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    cursor,
    isPanning: () => !!panRef.current,
    startProgrammatic,
  };
}