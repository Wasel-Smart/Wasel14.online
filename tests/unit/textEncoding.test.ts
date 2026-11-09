import { describe, expect, it } from 'vitest';
import {
  containsLikelyMojibake,
  normalizeTextTree,
  repairLikelyMojibake,
} from '@/utils/textEncoding';

describe('text encoding normalization', () => {
  it('detects likely mojibake while leaving valid Arabic untouched', () => {
    expect(containsLikelyMojibake('cafÃ©')).toBe(true);
    expect(containsLikelyMojibake('واصل')).toBe(false);
  });

  it('repairs common UTF-8 text decoded as a legacy encoding', () => {
    expect(repairLikelyMojibake('cafÃ©')).toBe('café');
    expect(repairLikelyMojibake('plain text')).toBe('plain text');
  });

  it('normalizes nested arrays and objects without preserving prototype keys', () => {
    const input = JSON.parse('{"label":"cafÃ©","nested":["plain",{"name":"Ã©"}],"__proto__":{"polluted":true}}') as unknown;
    const normalized = normalizeTextTree(input) as {
      label: string;
      nested: [string, { name: string }];
    };

    expect(normalized.label).toBe('café');
    expect(normalized.nested).toEqual(['plain', { name: 'é' }]);
    expect(Object.getPrototypeOf(normalized)).toBeNull();
    expect(Object.prototype).not.toHaveProperty('polluted');
  });
});
