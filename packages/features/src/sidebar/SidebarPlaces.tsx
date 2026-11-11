import { MapPin } from 'lucide-react';
import type { PlaceRecord } from '@doru/core';
import { nls } from '../nls';
import { placeName } from '@doru/core/model';
import './sidebar.css';

/**
 * The Places sidebar: the place entities of the tree, each clickable to
 * open the place tab.
 */
export function SidebarPlaces({
  places,
  onOpenPlace,
}: {
  places: PlaceRecord[];
  onOpenPlace: (placeId: string) => void;
}) {
  return (
    <ul className="side-section-list">
      {places.map((place) => (
        <li key={place.id} className="entity-card clickable" onClick={() => onOpenPlace(place.id)}>
          <span className="entity-card-icon">
            <MapPin size={15} aria-hidden="true" />
          </span>
          <span className="entity-card-body">
            <span className="entity-card-title">{placeName(place)}</span>
          </span>
          {place.latitude !== undefined && place.longitude !== undefined && (
            <span className="entity-card-meta">{nls.t('features.sidebar.geocoded')}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
