import type { PersonRecord } from '../model/types';
import type { PedigreeEdge, PedigreeLayout } from './types';

/**
 * Static SVG rendering of a laid-out pedigree. Pure string output — no DOM.
 * Used by the MCP charts_render tool so agents can "see" the same charts
 * the user sees.
 */

const COLOR = {
  bg: '#141816',
  card: '#1b201c',
  cardStroke: '#3a423c',
  text: '#c7cdc8',
  muted: '#8d958f',
  edge: '#5d655f',
  male: '#7fb3c9',
  female: '#c98ba0',
};

const FONT = 'system-ui, -apple-system, sans-serif';

export interface SvgRenderOptions {
  /** Whitespace around the chart bounds (default 24). */
  padding?: number;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function personName(person: PersonRecord): string {
  const name = person.names[0];
  if (!name) {
    return person.id;
  }
  if (name.full) {
    const cleaned = name.full.replace(/\//g, '').trim();
    if (cleaned) {
      return cleaned;
    }
  }
  const parts = [name.given, name.surname].filter((part) => part !== undefined);
  return parts.length > 0 ? parts.join(' ') : person.id;
}

function personYears(person: PersonRecord): string {
  const parts: string[] = [];
  if (person.birth?.year !== undefined) {
    parts.push(String(person.birth.year));
  }
  if (person.death?.year !== undefined) {
    parts.push(`\u{2013} ${person.death.year}`);
  }
  return parts.join(' ');
}

export function renderPedigreeSvg(
  layout: PedigreeLayout,
  persons: PersonRecord[],
  options: SvgRenderOptions = {},
): string {
  const padding = options.padding ?? 24;
  const width = Math.ceil(layout.width + padding * 2);
  const height = Math.ceil(layout.height + padding * 2);
  const dx = padding - layout.minX;
  const dy = padding - layout.minY;
  const personById = new Map(persons.map((person) => [person.id, person]));

  const parts: string[] = [];
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="${FONT}">`,
  );
  parts.push(`<rect width="100%" height="100%" fill="${COLOR.bg}"/>`);

  for (const edge of layout.edges) {
    const path = edgePath(edge, dx, dy);
    if (!path) {
      continue;
    }
    if (edge.kind === 'see-also') {
      parts.push(
        `<path d="${path}" fill="none" stroke="${COLOR.muted}" stroke-width="1.5" stroke-dasharray="5 4"/>`,
      );
    } else {
      parts.push(
        `<path d="${path}" fill="none" stroke="${COLOR.edge}" stroke-width="1.5"/>`,
      );
    }
  }

  for (const card of layout.cards) {
    const person = personById.get(card.personId) ?? { id: card.personId, names: [], sex: 'U' };
    const x = card.x + dx;
    const y = card.y + dy;
    const sexColor =
      person.sex === 'M' ? COLOR.male : person.sex === 'F' ? COLOR.female : COLOR.cardStroke;
    parts.push(
      `<rect x="${(x - 90).toFixed(1)}" y="${(y - 32).toFixed(1)}" width="180" height="64" rx="6" fill="${COLOR.card}" stroke="${COLOR.cardStroke}" stroke-width="1"/>`,
    );
    parts.push(
      `<rect x="${(x - 90).toFixed(1)}" y="${(y - 32).toFixed(1)}" width="3" height="64" rx="1.5" fill="${sexColor}"/>`,
    );
    const isFocus = card.key === layout.focusKey;
    parts.push(
      `<text x="${x.toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="13" font-weight="600" fill="${isFocus ? COLOR.text : COLOR.text}">${escapeXml(personName(person))}</text>`,
    );
    const years = personYears(person);
    if (years !== '') {
      parts.push(
        `<text x="${x.toFixed(1)}" y="${(y + 15).toFixed(1)}" text-anchor="middle" font-size="11" fill="${COLOR.muted}">${person.death?.year !== undefined ? '\u{2020} ' : ''}${escapeXml(years)}</text>`,
      );
    }
  }

  parts.push('</svg>');
  return parts.join('\n');
}

function edgePath(
  edge: PedigreeEdge,
  dx: number,
  dy: number,
): string | null {
  const from = edge.geometry.from;
  const to = edge.geometry.to;
  const fx = from.x + dx;
  const fy = from.y + dy;
  const tx = to.x + dx;
  const ty = to.y + dy;
  switch (edge.kind) {
    case 'marriage':
      return `M ${fx.toFixed(1)} ${fy.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
    case 'pedigree': {
      const jy = (fy + ty) / 2;
      return [
        `M ${fx.toFixed(1)} ${fy.toFixed(1)}`,
        `L ${fx.toFixed(1)} ${jy.toFixed(1)}`,
        `L ${tx.toFixed(1)} ${jy.toFixed(1)}`,
        `L ${tx.toFixed(1)} ${ty.toFixed(1)}`,
      ].join(' ');
    }
    case 'see-also':
      return `M ${fx.toFixed(1)} ${fy.toFixed(1)} L ${tx.toFixed(1)} ${ty.toFixed(1)}`;
  }
}
