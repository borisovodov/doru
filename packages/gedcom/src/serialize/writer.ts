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

  line(level: number, tag: string, options: { xref?: string | undefined; value?: string | undefined } = {}): void {
    const prefix = `${level} ${options.xref === undefined ? '' : `${options.xref} `}${tag}`;
    let value = options.value ?? '';
    const looksLikePointer = (v: string): boolean =>
      v === '@VOID@' || /^@[A-Za-z0-9_][^@]*@$/.test(v);
    if (this.version === '7.0') {
      value = value.startsWith('@') && !looksLikePointer(value) ? `@${value}` : value;
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
    // escape sequences) and enforce the 255-character line limit.
    if (looksLikePointer(value)) {
      // Pointer values are emitted verbatim.
    } else {
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
    const emitSegment = (segment: string, baseLevel: number): void => {
      if (segment.length <= limit) {
        this.lines.push(segment === '' ? prefix : `${prefix} ${segment}`);
        return;
      }
      // Split at the largest non-space position within the limit so that
      // the next segment does not start with a space.
      let cut = limit;
      while (cut > 0 && segment[cut] === ' ') {
        cut--;
      }
      if (cut <= 0) {
        cut = limit;
      }
      this.lines.push(`${prefix} ${segment.slice(0, cut)}`);
      let rest = segment.slice(cut);
      while (rest.length > limit) {
        let next = limit;
        while (next > 0 && rest[next] === ' ') {
          next--;
        }
        if (next <= 0) {
          next = limit;
        }
        this.lines.push(`${baseLevel + 1} CONC ${rest.slice(0, next)}`);
        rest = rest.slice(next);
      }
      this.lines.push(rest === '' ? `${baseLevel + 1} CONC` : `${baseLevel + 1} CONC ${rest}`);
    };
    emitSegment(parts[0] ?? '', level);
    for (let i = 1; i < parts.length; i++) {
      const cont = new Writer('5.5.1');
      const part = parts[i] as string;
      const contPrefix = `${level + 1} CONT`;
      const contOverhead = contPrefix.length + 1;
      const contLimit = 255 - contOverhead;
      if (part.length <= contLimit) {
        this.lines.push(part === '' ? contPrefix : `${contPrefix} ${part}`);
      } else {
        let cut = contLimit;
        while (cut > 0 && part[cut] === ' ') {
          cut--;
        }
        if (cut <= 0) {
          cut = contLimit;
        }
        this.lines.push(`${contPrefix} ${part.slice(0, cut)}`);
        let rest = part.slice(cut);
        while (rest.length > contLimit) {
          this.lines.push(`${level + 2} CONC ${rest.slice(0, contLimit)}`);
          rest = rest.slice(contLimit);
        }
        this.lines.push(rest === '' ? `${level + 2} CONC` : `${level + 2} CONC ${rest}`);
      }
      void cont;
    }
  }
}
