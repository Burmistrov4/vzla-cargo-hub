import { renderHook, waitFor } from '@testing-library/react';
import { useRates } from '../lib/useRates';

describe('useRates hook', () => {
  const mockRates = { rates: [{ id: 1 }], rules: [{ rule: 'test' }], bcvRate: 23.5 };

  beforeEach(() => {
    // Clear localStorage
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    // Mock fetch responses
    global.fetch = jest.fn().mockImplementation((url) => {
      if (url.endsWith('/api/rates')) {
        return Promise.resolve({ json: () => Promise.resolve(mockRates) });
      }
      if (url.endsWith('/api/bcv')) {
        return Promise.resolve({ json: () => Promise.resolve({ rate: 23.5 }) });
      }
      return Promise.reject(new Error('Unknown endpoint'));
    }) as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('fetches data and caches it', async () => {
    const { result } = renderHook(() => useRates());
    // Wait for loading to become false
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.rates).toEqual(mockRates.rates);
    expect(result.current.rules).toEqual(mockRates.rules);
    expect(result.current.bcvRate).toBe(23.5);
    expect(result.current.hasCache).toBe(true);
    // Verify cache
    const cached = JSON.parse(localStorage.getItem('cachedRates')!);
    expect(cached.rates).toEqual(mockRates.rates);
  });

  it('uses cache on error if available', async () => {
    // Prepopulate cache
    const cachedData = { rates: [{ id: 2 }], rules: [{ rule: 'cached' }], bcvRate: 20 };
    localStorage.setItem('cachedRates', JSON.stringify(cachedData));
    // Force fetch to error
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useRates());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.rates).toEqual(cachedData.rates);
    expect(result.current.rules).toEqual(cachedData.rules);
    expect(result.current.bcvRate).toBe(20);
    expect(result.current.hasCache).toBe(true);
  });

  it('fails without cache and shows error', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
    const { result } = renderHook(() => useRates());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.rates).toEqual([]);
    expect(result.current.hasCache).toBe(false);
  });
});
