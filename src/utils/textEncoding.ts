let mojibakePattern: RegExp | undefined;
let utf8Decoder: TextDecoder | undefined;
let windows1252ByteByChar: Map<string, number> | undefined;

function escapeForRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getSuspiciousTokens() {
  return ['\uFFFD', 'Â·', 'Ã‚', 'Ãƒ', 'Ã˜', 'Ã™', 'Ã¢â‚¬', 'Ã°Å¸', 'â€¢', 'ðŸ'] as const;
}

function getWellFormedTokensPattern() {
  return /[\u201C\u201D\u2018\u2019\u2013\u2014\u2026\u2022\u2713\u00A9\u00B1\u00B7]/u;
}

function getArabicPattern() {
  return /[\u0600-\u06FF]/u;
}

function getEmojiPattern() {
  return /[\u{1F300}-\u{1FAFF}]/u;
}

function getUtf8Decoder() {
  if (!utf8Decoder) {
    utf8Decoder = new TextDecoder('utf-8', { fatal: false });
  }

  return utf8Decoder;
}

function getWindows1252ByteByChar() {
  if (!windows1252ByteByChar) {
    windows1252ByteByChar = new Map<string, number>([
      ['\u20AC', 0x80], ['\u201A', 0x82], ['\u0192', 0x83], ['\u201E', 0x84],
      ['\u2026', 0x85], ['\u2020', 0x86], ['\u2021', 0x87], ['\u02C6', 0x88],
      ['\u2030', 0x89], ['\u0160', 0x8a], ['\u2039', 0x8b], ['\u0152', 0x8c],
      ['\u017D', 0x8e], ['\u2018', 0x91], ['\u2019', 0x92], ['\u201C', 0x93],
      ['\u201D', 0x94], ['\u2022', 0x95], ['\u2013', 0x96], ['\u2014', 0x97],
      ['\u02DC', 0x98], ['\u2122', 0x99], ['\u0161', 0x9a], ['\u203A', 0x9b],
      ['\u0153', 0x9c], ['\u017E', 0x9e], ['\u0178', 0x9f],
    ]);
  }

  return windows1252ByteByChar;
}

function getMojibakePattern() {
  if (!mojibakePattern) {
    const knownTokens = getSuspiciousTokens().map(escapeForRegex);
    mojibakePattern = new RegExp(
      [...knownTokens, 'Ã[\\u0080-\\u00BF]', 'Â[\\u0080-\\u00BF]'].join('|'),
      'u',
    );
  }

  return mojibakePattern;
}

function getArabicMojibakePattern() {
  return /(?:Ø.|Ù.){2,}/u;
}

function decodeLatin1AsUtf8(value: string): string {
  const bytes = Uint8Array.from(
    Array.from(value, char => {
      const mappedByte = getWindows1252ByteByChar().get(char);
      if (typeof mappedByte === 'number') {
        return mappedByte;
      }

      const codePoint = char.codePointAt(0) ?? 0;
      return codePoint <= 0xff ? codePoint : 0x3f;
    }),
  );

  return getUtf8Decoder().decode(bytes);
}

function containsControlCharacters(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0) ?? -1;
    if ((codePoint >= 0x00 && codePoint <= 0x1f) || (codePoint >= 0x7f && codePoint <= 0x9f)) {
      return true;
    }
  }

  return false;
}

function scoreTextQuality(value: string): number {
  let score = 0;
  const pattern = getMojibakePattern();

  if (!pattern.test(value)) {
    score += 4;
  }

  if (getArabicPattern().test(value)) {
    score += 3;
  }

  if (getWellFormedTokensPattern().test(value)) {
    score += 2;
  }

  if (getEmojiPattern().test(value)) {
    score += 2;
  }

  if (containsControlCharacters(value)) {
    score -= 4;
  }

  const mojibakeHits = value.match(pattern)?.length ?? 0;
  score -= mojibakeHits * 3;

  return score;
}

export function containsLikelyMojibake(value: string): boolean {
  return getMojibakePattern().test(value) || getArabicMojibakePattern().test(value);
}

export function repairLikelyMojibake(value: string): string {
  if (!containsLikelyMojibake(value)) {
    return value;
  }

  const candidates = [value];

  try {
    const decoded = decodeLatin1AsUtf8(value);
    candidates.push(decoded);

    if (containsLikelyMojibake(decoded)) {
      candidates.push(decodeLatin1AsUtf8(decoded));
    }
  } catch {
    return value;
  }

  return candidates.reduce((best, candidate) =>
    scoreTextQuality(candidate) > scoreTextQuality(best) ? candidate : best,
  );
}

export function normalizeTextTree<T>(value: T): T {
  if (typeof value === 'string') {
    return repairLikelyMojibake(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map(item => normalizeTextTree(item)) as T;
  }

  if (value && typeof value === 'object') {
    // Use Object.create(null) as the accumulator to avoid prototype pollution
    // when iterating over untrusted data that may contain __proto__ keys.
    const result = Object.create(null) as Record<string, unknown>;
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      // Skip prototype-polluting keys
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {continue;}
      result[key] = normalizeTextTree(item);
    }
    return result as T;
  }

  return value;
}
