import { useEffect, useState } from 'react';
import type { ComparisonResult, MissionProfile } from '../../types/contracts';
import { parseComparison } from './comparisonValidation';

/** Optional Task F output. Nothing is scored when no validated file exists. */
export function useComparison(targetId:string, earthSiteId:string|null, profile:MissionProfile):ComparisonResult|null {
  const [loaded,setLoaded] = useState<{key:string;data:ComparisonResult|null}|null>(null);
  const key = `${targetId}--${earthSiteId ?? ''}--${profile}`;
  useEffect(()=>{
    if (!targetId || !earthSiteId) return;
    const controller=new AbortController();
    const file=`${import.meta.env.BASE_URL}comparisons/${encodeURIComponent(earthSiteId)}--${encodeURIComponent(targetId)}--${profile}.json`;
    fetch(file,{signal:controller.signal}).then(async response=>response.ok ? response.json() as Promise<unknown> : null)
      .then(payload=>{if(!controller.signal.aborted)setLoaded({key,data:parseComparison(payload,targetId,earthSiteId,profile)});})
      .catch(()=>{if(!controller.signal.aborted)setLoaded({key,data:null});});
    return ()=>controller.abort();
  },[targetId,earthSiteId,profile,key]);
  return loaded?.key===key ? loaded.data : null;
}
