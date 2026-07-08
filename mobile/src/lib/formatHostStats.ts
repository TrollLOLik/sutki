import type { HostResponseStats } from '@/lib/api/hostStats';

export function formatHostResponseTime(stats: HostResponseStats | undefined): string {
  if (!stats || stats.responses_count <= 0 || stats.avg_response_minutes <= 0) {
    return '—';
  }

  const minutes = stats.avg_response_minutes;
  if (minutes < 60) {
    return `${minutes} мин`;
  }

  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  if (restMinutes === 0) {
    return `${hours} ч`;
  }
  return `${hours} ч ${restMinutes} мин`;
}
