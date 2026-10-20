/**
 * The serializers: the typed model back to GEDCOM 7.0 or 5.5.1 text.
 *
 * The serializers are projections, not judges: constructs the target
 * version can express but stores elsewhere are translated, and everything
 * it cannot express is dropped silently. The rule for each construct is
 * documented in the JSDoc of the affected model field; the summary lives
 * in the README's Serialization section. The only reported error is
 * `serialize.invalid-text` (unpaired surrogates).
 *
 * Layout: `writer.ts` (line writing), `format.ts` (value spellings),
 * `tables.ts` (projection tables), `emitter/` (structure emitters, one
 * file per structure group), `prepare.ts` (model-level 5.5.1 projection).
 */

import type {
  ParseResult,
} from '../errors';
import {
  ok,
  run,
} from '../errors';
import type {
  GedcomDataset,
} from '../structures';
import {
  emitDataset,
} from './emitter/document';
import {
  prepareFor551,
  prepareFor70,
} from './prepare';
import type {
  Version,
} from './writer';
import {
  Writer,
} from './writer';

function emit(version: Version, dataset: GedcomDataset): string {
  const prepared = version === '5.5.1' ? prepareFor551(dataset) : prepareFor70(dataset);
  const w = new Writer(version);
  emitDataset(w, version, prepared);
  const text = w.lines.join('\r\n');
  return `${text}\r\n`;
}

/** Serializes the dataset as GEDCOM 7.0 text. */
export function serializeGedcom70(dataset: GedcomDataset): ParseResult<string> {
  return run(() => emit('7.0', dataset));
}

/** Serializes the dataset as GEDCOM 5.5.1 text. */
export function serializeGedcom551(dataset: GedcomDataset): ParseResult<string> {
  return run(() => emit('5.5.1', dataset));
}

/** True when the text contains a lone (unpaired) UTF-16 surrogate. */
function hasUnpairedSurrogate(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        return true;
      }
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

function encodeUtf8(text: string): ParseResult<Uint8Array> {
  // TextEncoder silently replaces lone surrogates with U+FFFD; the
  // strict package reports them instead of corrupting the output.
  if (hasUnpairedSurrogate(text)) {
    return {
      ok: false,
      error: {
        code: 'serialize.invalid-text',
        message: 'The text contains an unpaired surrogate and cannot be encoded as UTF-8',
      },
    };
  }
  return ok(new TextEncoder().encode(text));
}

/**
 * Serializes the dataset as GEDCOM 7.0 UTF-8 bytes (no BOM, CRLF line
 * endings). The only reported error is `serialize.invalid-text` (unpaired
 * surrogates), which the text serialization cannot produce.
 */
export function serializeGedcom70Bytes(dataset: GedcomDataset): ParseResult<Uint8Array> {
  return encodeUtf8(emit('7.0', dataset));
}

/**
 * Serializes the dataset as GEDCOM 5.5.1 UTF-8 bytes (no BOM, CRLF line
 * endings, `1 CHAR UTF-8` in the header). The only reported error is
 * `serialize.invalid-text` (unpaired surrogates), which the text
 * serialization cannot produce.
 */
export function serializeGedcom551Bytes(dataset: GedcomDataset): ParseResult<Uint8Array> {
  return encodeUtf8(emit('5.5.1', dataset));
}
