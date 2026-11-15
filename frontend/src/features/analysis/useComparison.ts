import { useCallback, useEffect, useState } from 'react';
import type { ComparisonResult, MissionProfile } from '../../types/contracts';
import { parseComparison } from './comparisonValidation';

export type ComparisonStatus = 'idle' | 'loading' | 'ready' | 'missing' | 'invalid' | 'error';
interface Loaded { key: string; status: ComparisonStatus; comparison: ComparisonResult | null }

/** Distinguish absent evidence from loading/network/validation failure; never reuse stale results. */
export function useComparison(targetId: string, earthSiteId: string | null, profile: MissionProfile) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt(value => value + 1), []);
  const key = `${targetId}--${earthSiteId ?? ''}--${profile}--${attempt}`;
  useEffect(() => {
    if (!targetId || !earthSiteId) return;
    const controller = new AbortController();
    const store = (status: ComparisonStatus, comparison: ComparisonResult | null = null) => {
      if (!controller.signal.aborted) setLoaded({key, status, comparison});
    };
    const file = `${import.meta.env.BASE_URL}comparisons/${encodeURIComponent(earthSiteId)}--${encodeURIComponent(targetId)}--${profile}.json`;
    async function load() {
      try {
        const response = await fetch(file, {signal: controller.signal});
        if (response.status === 404 || (response.ok && response.headers.get('content-type')?.includes('text/html'))) { store('missing'); return; }
        if (!response.ok) { store('error'); return; }
        let payload: unknown;
        try { payload = await response.json(); } catch { store('invalid'); return; }
        const comparison = parseComparison(payload, targetId, earthSiteId!, profile);
        store(comparison ? 'ready' : 'invalid', comparison);
      } catch { store('error'); }
    }
    void load();
    return () => controller.abort();
  }, [targetId, earthSiteId, profile, key]);
  return {comparison: loaded?.key === key ? loaded.comparison : null,
    status: (!targetId || !earthSiteId ? 'idle' : loaded?.key === key ? loaded.status : 'loading') as ComparisonStatus, retry};
}
