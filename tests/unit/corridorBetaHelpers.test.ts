import { describe, it, expect } from 'vitest';
import {
  stageLabel,
  stageColor,
  corridorLabel,
  corridorReason,
  corridorNextAction,
  metricLabel,
} from '@/features/home/sections/corridorBetaHelpers';

describe('stageLabel', () => {
  it('returns English expand label', () => {
    expect(stageLabel('expand', false)).toBe('Ready to expand');
  });
  it('returns Arabic expand label', () => {
    expect(stageLabel('expand', true)).toBe('جاهز للتوسع');
  });
  it('returns English prove label', () => {
    expect(stageLabel('prove', false)).toBe('Prove repeat rides');
  });
  it('returns Arabic prove label', () => {
    expect(stageLabel('prove', true)).toBe('اثبت التكرار');
  });
  it('returns English focus label for other stage', () => {
    expect(stageLabel('focus' as never, false)).toBe('Narrow focus');
  });
  it('returns Arabic focus label for other stage', () => {
    expect(stageLabel('focus' as never, true)).toBe('ضيّق التركيز');
  });
});

describe('stageColor', () => {
  it('returns green for expand', () => {
    const color = stageColor('expand');
    expect(typeof color).toBe('string');
    expect(color.length).toBeGreaterThan(0);
  });
  it('returns gold for prove', () => {
    const color = stageColor('prove');
    expect(typeof color).toBe('string');
  });
  it('returns cyan for other', () => {
    const color = stageColor('focus' as never);
    expect(typeof color).toBe('string');
  });
});

describe('corridorLabel', () => {
  it('returns English label unchanged', () => {
    expect(corridorLabel('Amman to Aqaba', false)).toBe('Amman to Aqaba');
  });
  it('translates known cities to Arabic', () => {
    const result = corridorLabel('Amman to Aqaba', true);
    expect(result).toContain('عمّان');
    expect(result).toContain('العقبة');
  });
  it('falls back to original for unknown city', () => {
    const result = corridorLabel('Unknown to Amman', true);
    expect(result).toContain('Unknown');
    expect(result).toContain('عمّان');
  });
  it('returns original label when no " to " separator', () => {
    expect(corridorLabel('Amman', true)).toBe('Amman');
  });
});

describe('corridorReason', () => {
  it('returns English label unchanged', () => {
    const label = 'Observed ride data clears the corridor expansion gate.';
    expect(corridorReason(label, false)).toBe(label);
  });
  it('translates first known reason to Arabic', () => {
    const result = corridorReason('Observed ride data clears the corridor expansion gate.', true);
    expect(result).toContain('بيانات');
  });
  it('translates second known reason to Arabic', () => {
    const label =
      'This corridor is ready for controlled expansion because rides, repeat behavior, and supply are all stable.';
    const result = corridorReason(label, true);
    expect(result).toContain('هذا المسار');
  });
  it('translates narrow beta reason to Arabic', () => {
    const result = corridorReason('Narrow the beta until something', true);
    expect(result).toContain('ضيّق');
  });
  it('returns original for unknown Arabic reason', () => {
    const label = 'Some unknown reason.';
    expect(corridorReason(label, true)).toBe(label);
  });
});

describe('corridorNextAction', () => {
  it('returns English label unchanged', () => {
    const label = 'Open the next corridor only after the same three-week gate passes.';
    expect(corridorNextAction(label, false)).toBe(label);
  });
  it('translates first known action to Arabic', () => {
    const result = corridorNextAction(
      'Open the next corridor only after the same three-week gate passes.',
      true,
    );
    expect(result).toContain('افتح');
  });
  it('translates second known action to Arabic', () => {
    const result = corridorNextAction(
      'Run one route, one pickup node, and one rider segment until demand concentrates.',
      true,
    );
    expect(result).toContain('شغّل');
  });
  it('translates third known action to Arabic', () => {
    const result = corridorNextAction(
      'Open controlled expansion with the same trust and supply gates.',
      true,
    );
    expect(result).toContain('افتح توسعاً');
  });
  it('returns original for unknown Arabic action', () => {
    const label = 'Do something else.';
    expect(corridorNextAction(label, true)).toBe(label);
  });
});

describe('metricLabel', () => {
  it('translates weekly rides to Arabic', () => {
    expect(metricLabel('weekly rides', true)).toBe('رحلات أسبوعية');
  });
  it('returns English weekly rides unchanged', () => {
    expect(metricLabel('weekly rides', false)).toBe('weekly rides');
  });
  it('translates repeat ride rate to Arabic', () => {
    expect(metricLabel('repeat ride rate', true)).toBe('نسبة التكرار');
  });
  it('returns English repeat ride rate unchanged', () => {
    expect(metricLabel('repeat ride rate', false)).toBe('repeat ride rate');
  });
  it('translates supply reliability to Arabic', () => {
    expect(metricLabel('supply reliability', true)).toBe('ثبات العرض');
  });
  it('returns English supply reliability unchanged', () => {
    expect(metricLabel('supply reliability', false)).toBe('supply reliability');
  });
  it('returns Arabic fallback for unknown metric', () => {
    expect(metricLabel('other metric', true)).toBe('ثبات ثلاث أسابيع');
  });
  it('returns English fallback for unknown metric', () => {
    expect(metricLabel('other metric', false)).toBe('three-week consistency');
  });
});
