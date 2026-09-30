import { useAuthStore } from '../store/authStore';

export function useCanReview(): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return ['reviewer', 'admin', 'manager'].includes(user.role);
}

export function useIsAdminOrManager(): boolean {
  const user = useAuthStore((s) => s.user);
  if (!user) return false;
  return ['admin', 'manager'].includes(user.role);
}
