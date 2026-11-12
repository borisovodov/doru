/**
 * The line writer: value escaping, multiline CONT splitting and, for
 * 5.5.1, the 255-character line limit with CONC splitting.
 *
 * Part of the serializer split; see serialize.ts for the public API.
 */

export type Version = '7.0' | '5.5.1';

/**
 * The line writer. Handles value escaping, multiline CONT splitting and,
 * for 5.5.1, the 255-character line limit with CONC splitting.
 */
export class Writer {
  readonly version: Version;
  readonly lines: string[] = [];

  constructor(version: Version) {
    this.version = version;
  }

  /**
   * Splits a value into pieces of at most `limit` characters without
   * breaking after a space: when the cut lands on spaces, it walks back
   * to the preceding non-space so the next piece never starts with one.
   */
  private static splitAtLimit(segment: string, limit: number): string[] {
    const pieces: string[] = [];
    let rest = segment;
    while (rest.length > limit) {
      let cut = limit;
      while (cut > 0 && rest[cut] === ' ') {
        cut--;
      }
      if (cut <= 0) {
        cut = limit;
      }
      pieces.push(rest.slice(0, cut));
      rest = rest.slice(cut);
    }
    pieces.push(rest);
    return pieces;
  }

  line(
    level: number,
    tag: string,
    options: { xref?: string | undefined; value?: string | undefined; pointer?: boolean | undefined } = {},
  ): void {
    const prefix = `${level} ${options.xref === undefined ? '' : `${options.xref} `}${tag}`;
    let value = options.value ?? '';
    if (this.version === '7.0') {
      if (!options.pointer && value.startsWith('@')) {
        // GEDCOM 7.0 §1.3: a line value starting with @ must double the
        // @ — the wire form is unambiguous, so this applies even when
        // the value is xref-shaped (a Text "@I1@" is written "@@I1@").
        // Pointer values pass the explicit pointer flag instead.
        value = `@${value}`;
      }
      const parts = value.split('\n');
      this.lines.push(parts.length === 0 || parts[0] === '' ? prefix : `${prefix} ${parts[0]}`);
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i] as string;
        const escaped = part.startsWith('@') ? `@${part}` : part;
        this.lines.push(part === '' ? `${level + 1} CONT` : `${level + 1} CONT ${escaped}`);
      }
      return;
    }
    // 5.5.1: double every @ (except in pointer values and inside @#…@
    // escape sequences) and enforce the 255-character line limit. A
    // pointer value is identified by the explicit pointer flag, not by
    // its shape: a Text value that merely looks like an xref must be
    // escaped like any other text.
    if (!options.pointer) {
      let escaped = '';
      let i = 0;
      while (i < value.length) {
        const c = value[i] as string;
        if (c === '@' && value[i + 1] === '#') {
          const close = value.indexOf('@', i + 2);
          escaped += close === -1 ? value.slice(i) : value.slice(i, close + 1);
          i = close === -1 ? value.length : close + 1;
          continue;
        }
        escaped += c === '@' ? '@@' : c;
        i++;
      }
      value = escaped;
    }
    const parts = value.split('\n');
    const overhead = prefix.length + 1;
    const limit = 255 - overhead;
    const pieces = Writer.splitAtLimit(parts[0] ?? '', limit);
    this.lines.push(pieces[0] === '' ? prefix : `${prefix} ${pieces[0]}`);
    for (let i = 1; i < pieces.length; i++) {
      const piece = pieces[i] as string;
      this.lines.push(piece === '' ? `${level + 1} CONC` : `${level + 1} CONC ${piece}`);
    }
    for (let i = 1; i < parts.length; i++) {
      const contPrefix = `${level + 1} CONT`;
      const contOverhead = contPrefix.length + 1;
      const contLimit = 255 - contOverhead;
      const contPieces = Writer.splitAtLimit(parts[i] as string, contLimit);
      this.lines.push(contPieces[0] === '' ? contPrefix : `${contPrefix} ${contPieces[0]}`);
      for (let j = 1; j < contPieces.length; j++) {
        const piece = contPieces[j] as string;
        this.lines.push(piece === '' ? `${level + 2} CONC` : `${level + 2} CONC ${piece}`);
      }
    }
  }
}
