import { useEffect, useState } from 'react';
import { getTimeSlots } from '../services/api';
import { TIME_SLOTS } from './timeSlots';

export function useTimeSlots() {
  const [slots, setSlots] = useState(TIME_SLOTS);

  useEffect(() => {
    let active = true;
    let request = null;
    try {
      request = getTimeSlots ? getTimeSlots() : null;
    } catch {
      request = null;
    }
    Promise.resolve(request)
      .then((res) => {
        const list = res?.data?.data;
        if (active && Array.isArray(list) && list.length > 0) setSlots(list);
      })
      .catch(() => {
        /* keep the static fallback */
      });
    return () => {
      active = false;
    };
  }, []);

  return slots;
}