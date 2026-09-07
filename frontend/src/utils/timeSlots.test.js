import { describe, it, expect } from 'vitest';
import { parseSlotStartHour, getAvailableSlots, TIME_SLOTS } from './timeSlots';

describe('parseSlotStartHour', () => {
  it('parses AM slots', () => {
    expect(parseSlotStartHour('8 AM - 10 AM')).toBe(8);
    expect(parseSlotStartHour('10 AM - 12 PM')).toBe(10);
  });

  it('parses PM slots correctly', () => {
    expect(parseSlotStartHour('12 PM - 2 PM')).toBe(12);
    expect(parseSlotStartHour('2 PM - 4 PM')).toBe(14);
    expect(parseSlotStartHour('8 PM - 10 PM')).toBe(20);
  });

  it('parses midnight AM as hour 0', () => {
    expect(parseSlotStartHour('12 AM - 2 AM')).toBe(0);
  });

  it('returns 0 for unrecognized input', () => {
    expect(parseSlotStartHour('garbage')).toBe(0);
    expect(parseSlotStartHour('')).toBe(0);
  });
});

describe('getAvailableSlots', () => {
  const todayStr = '2026-09-08';

  it('returns all slots for a future date', () => {
    const now = new Date('2026-09-08T15:00:00');
    expect(getAvailableSlots('2026-09-09', todayStr, now)).toEqual(TIME_SLOTS);
  });

  it('returns all slots when no date is selected', () => {
    const now = new Date('2026-09-08T15:00:00');
    expect(getAvailableSlots('', todayStr, now)).toEqual(TIME_SLOTS);
  });

  it('filters out slots that already started today', () => {
    const now = new Date('2026-09-08T15:00:00');
    expect(getAvailableSlots(todayStr, todayStr, now)).toEqual([
      '4 PM - 6 PM',
      '6 PM - 8 PM',
      '8 PM - 10 PM'
    ]);
  });

  it('keeps all slots early in the day', () => {
    const now = new Date('2026-09-08T06:30:00');
    const result = getAvailableSlots(todayStr, todayStr, now);
    expect(result).toEqual(TIME_SLOTS);
  });
});