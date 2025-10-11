// src/hooks/useBulkReviews.ts
import { useQuery } from '@tanstack/react-query';
export const useBulkReviews = (productIds: string[]) =>
  useQuery({
    queryKey: ['reviews-bulk', productIds.slice().sort().join(',')],
    queryFn: async () => {
      if (!productIds.length) return {};
      const r = await fetch('/api/reviews/bulk-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productIds }),
        credentials: 'include',
      });
      if (!r.ok) return {};
      const j = await r.json();
      const out: Record<string, { averageRating: number; reviewCount: number }> = {};
      for (const [pid, v] of Object.entries<any>(j.data || {})) {
        out[pid] = {
          averageRating: Number(v.averageRating ?? v.avg ?? 0) || 0,
          reviewCount: Number(v.reviewCount ?? v.total ?? 0) || 0,
        };
      }
      return out;
    },
    staleTime: 300000,
    enabled: productIds.length > 0,
  });
