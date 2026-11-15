import type { EarthSite } from '../../types/contracts';

export function isMappable(site: EarthSite) {
  return Number.isFinite(site.latitude) && Number.isFinite(site.longitude) &&
    Math.abs(site.latitude) <= 85.05112878 && Math.abs(site.longitude) <= 180;
}
export function filterCandidates(sites: EarthSite[], environment: string, availability: string, search: string) {
  const query = search.trim().toLocaleLowerCase();
  return sites.filter(site => (environment === 'All' || site.environmentType === environment) &&
    (availability === 'All' || site.dataStatus === availability) &&
    `${site.name} ${site.country} ${site.environmentType}`.toLocaleLowerCase().includes(query));
}
