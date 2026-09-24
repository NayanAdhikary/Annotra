import { useCallback } from 'react';
import { useViewportStore } from '../store/viewportStore';

export const MIN_SCALE = 0.05;
export const MAX_SCALE = 16;
export const ZOOM_STEP = 1.15;

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function useZoom(stageRef: React.RefObject<any>) {
    const setLive = useViewportStore(s => s.setLive);

    const zoomAt = useCallback(
        (screenX: number, screenY: number, factor: number) => {
            const { live } = useViewportStore.getState();
            const newScale = clamp(live.scale * factor, MIN_SCALE, MAX_SCALE);
            if (newScale === live.scale) return;

            const k = newScale / live.scale;
            const newX = screenX - (screenX - live.x) * k;
            const newY = screenY - (screenY - live.y) * k;

            setLive({ scale: newScale, x: newX, y: newY });
        },
        [setLive],
    );

    const onWheel = useCallback(
        (e: any) => {
            const stage = stageRef.current;
            if (!stage) return;
            const p = stage.getPointerPosition();
            if (!p) return;

            const direction = e.evt.deltaY > 0 ? 1 / ZOOM_STEP : ZOOM_STEP;

            zoomAt(p.x, p.y, direction);
        },
        [stageRef, zoomAt],
    );

    const zoomBy = useCallback(
        (factor: number) => {
            const { containerW, containerH } = useViewportStore.getState();
            zoomAt(containerW / 2, containerH / 2, factor);
        },
        [zoomAt],
    );

    const zoomTo = useCallback(
        (scale: number) => {
            const { live, containerW, containerH } = useViewportStore.getState();
            if (scale === live.scale) return;
            zoomAt(containerW / 2, containerH / 2, scale / live.scale);
        },
        [zoomAt],
    );
    return {
        onWheel,
        zoomBy,
        zoomTo
    };
}