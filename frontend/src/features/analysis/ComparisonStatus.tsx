import type { ComparisonStatus as Status } from './useComparison';

export function ComparisonStatus({status,retry}:{status:Status;retry:()=>void}) {
  if (status === 'ready') return null;
  const messages = {
    idle: 'Choose an Earth candidate and planetary target to inspect evidence.',
    loading: 'Checking comparison evidence for this mission…',
    missing: 'No reviewed comparison has been published for this mission yet. Scores remain unavailable.',
    invalid: 'The comparison could not be verified. No score is shown.',
    error: 'Comparison evidence could not be loaded. No score is shown.'
  };
  return <div className="comparison-load-status" role={status === 'error' || status === 'invalid' ? 'alert' : 'status'}>
    <span>{messages[status]}</span>{(status === 'error' || status === 'invalid') && <button type="button" onClick={retry}>Try again</button>}
  </div>;
}
