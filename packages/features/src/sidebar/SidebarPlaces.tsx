import { MapPin } from 'lucide-react';
import type { PlaceRecord } from '@doru/core';
import { EntityCard } from '@doru/ui';
import { placeName } from '@doru/core/model';
import { nls } from '../nls';
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
        <li key={place.id}>
          <EntityCard
            icon={<MapPin size={15} aria-hidden="true" />}
            title={placeName(place)}
            meta={
              place.latitude !== undefined && place.longitude !== undefined ? nls.t('features.sidebar.geocoded') : null
            }
            onClick={() => onOpenPlace(place.id)}
          />
        </li>
      ))}
    </ul>
  );
}
