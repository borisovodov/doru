import { useMemo } from 'react';
import { MapPin } from 'lucide-react';
import type { FactRecord } from '@doru/core';
import { nls } from '../nls';
import './sidebar.css';

/**
 * The Places sidebar: the distinct places mentioned by the tree's facts,
 * most mentioned first. Places are free text for now, so the list is the
 * aggregation of fact places — no geocoding yet.
 */
export function SidebarPlaces({ facts }: { facts: FactRecord[] }) {
  const places = useMemo(() => {
    const counts = new Map<string, number>();
    for (const fact of facts) {
      if (fact.place) {
        counts.set(fact.place, (counts.get(fact.place) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [facts]);

  return (
    <ul className="side-section-list">
      {places.map(([place, count]) => (
        <li key={place} className="entity-card">
          <span className="entity-card-icon">
            <MapPin size={15} aria-hidden="true" />
          </span>
          <span className="entity-card-body">
            <span className="entity-card-title">{place}</span>
            <span className="entity-card-subtitle">{nls.t('features.sidebar.mentions', count)}</span>
          </span>
          <span className="entity-card-meta highlight">{count}</span>
        </li>
      ))}
    </ul>
  );
}
