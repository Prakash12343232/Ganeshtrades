export const TIME_SLOTS = [
  '8 AM - 10 AM', '10 AM - 12 PM', '12 PM - 2 PM',
  '2 PM - 4 PM', '4 PM - 6 PM', '6 PM - 8 PM', '8 PM - 10 PM'
];

export const SLOT_ICONS = ['🌅', '☀️', '🌤️', '⛅', '🌇', '🌆', '🌙'];

export function parseSlotStartHour(slot) {
  const match = slot.match(/^(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hour = parseInt(match[1], 10);
  const period = match[2].toUpperCase();
  if (period === 'PM' && hour !== 12) hour += 12;
  if (period === 'AM' && hour === 12) hour = 0;
  return hour;
}

export function getAvailableSlots(date, todayStr, now) {
  if (!date || date !== todayStr) return TIME_SLOTS;
  const currentHour = now.getHours();
  return TIME_SLOTS.filter(slot => parseSlotStartHour(slot) > currentHour);
}