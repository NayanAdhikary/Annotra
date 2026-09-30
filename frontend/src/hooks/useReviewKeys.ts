import { useEffect } from 'react';
import { useAnnotationStore } from '../store/annotationStore';
import { useReviewStore } from '../store/reviewStore';
import { useCanReview } from './useRoleAccess';
import { reviewApi } from '../api/review';

export function useReviewKeys(taskId: number, onReviewed: () => void) {
  const canReview = useCanReview();

  useEffect(() => {
    if (!canReview) return;

    const handler = async (e: KeyboardEvent) => {
      const inInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(
        (e.target as HTMLElement)?.tagName,
      );
      if (inInput) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const store = useAnnotationStore.getState();
      const ann = store.annotations.find((a) => a.id === store.primaryId);
      if (!ann || !ann.serverId) return;

      const key = e.key.toLowerCase();

      if (key === 'a') {
        e.preventDefault();
        await reviewApi.reviewOne(ann.serverId, 'accepted');
        store.replaceAnnotation(ann.id, { reviewStatus: 'accepted' });
        onReviewed();
      } else if (key === 'r') {
        e.preventDefault();
        await reviewApi.reviewOne(ann.serverId, 'rejected', 'other');
        store.replaceAnnotation(ann.id, { reviewStatus: 'rejected' });
        onReviewed();
      } else if (key === 'f') {
        e.preventDefault();
        await reviewApi.reviewOne(ann.serverId, 'fixed');
        store.replaceAnnotation(ann.id, { reviewStatus: 'fixed' });
        onReviewed();
      } else if (key === 'n') {
        e.preventDefault();
        const { pendingIds } = useReviewStore.getState();
        const idx = pendingIds.indexOf(ann.serverId);
        const next = pendingIds[(idx + 1) % pendingIds.length];
        const target = store.annotations.find((a) => a.serverId === next);
        if (target) store.selectOne(target.id);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [canReview, taskId, onReviewed]);
}