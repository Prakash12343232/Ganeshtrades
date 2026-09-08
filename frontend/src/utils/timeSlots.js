export const TIME_SLOTS = [
  '8 AM - 10 AM', '10 AM - 12 PM', '12 PM - 2 PM',
  '2 PM - 4 PM', '4 PM - 6 PM', '6 PM - 8 PM', '8 PM - 10 PM'
];

export const SLOT_ICONS = ['🌅', '☀️', '🌤️', '⛅', '🌇', '🌆', '🌙'];

export const SLOT_ICON_MAP = Object.fromEntries(TIME_SLOTS.map((slot, i) => [slot, SLOT_ICONS[i]]));

export function parseSlotStartHour(slot) {
  const match = slot.match(/^(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hour = parseInt(match[1], 10);
  const period = match[2].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour;
}

export function getAvailableSlots(date, todayStr, now, slots = TIME_SLOTS) {
  if (!date || date !== todayStr) return slots;
  const currentHour = now.getHours();
  return slots.filter(slot => parseSlotStartHour(slot) > currentHour);
}