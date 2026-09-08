import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTimeSlots } from './useTimeSlots';
import { getTimeSlots } from '../services/api';
import { TIME_SLOTS } from './timeSlots';

vi.mock('../services/api', () => ({
  getTimeSlots: vi.fn()
}));

describe('useTimeSlots', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('falls back to the static TIME_SLOTS when the API rejects', async () => {
    getTimeSlots.mockRejectedValue(new Error('network'));
    const { result } = renderHook(() => useTimeSlots());
    await waitFor(() => {
      expect(result.current).toEqual(TIME_SLOTS);
    });
  });

  it('returns backend-provided slots when available', async () => {
    getTimeSlots.mockResolvedValue({ data: { data: ['9 AM - 11 AM', '12 PM - 3 PM'] } });
    const { result } = renderHook(() => useTimeSlots());
    await waitFor(() => {
      expect(result.current).toEqual(['9 AM - 11 AM', '12 PM - 3 PM']);
    });
  });

  it('keeps the static fallback when the backend returns an empty list', async () => {
    getTimeSlots.mockResolvedValue({ data: { data: [] } });
    const { result } = renderHook(() => useTimeSlots());
    await waitFor(() => {
      expect(result.current).toEqual(TIME_SLOTS);
    });
  });
});