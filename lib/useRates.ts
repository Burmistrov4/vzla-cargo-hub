import { useState, useEffect, useCallback } from 'react';

type RatesData = {
  rates: any[];
  rules: any[];
  bcvRate: number | null;
};

/**
 * Hook to fetch courier rates and rules from the server, cache them in
 * localStorage, and expose loading/error state.
 */
export const useRates = () => {
  const [rates, setRates] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [bcvRate, setBcvRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasCache, setHasCache] = useState<boolean>(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Check for cached data first
      const cached = typeof window !== 'undefined' ? localStorage.getItem('cachedRates') : null;
      if (cached) {
        const parsed: RatesData = JSON.parse(cached);
        setRates(parsed.rates);
        setRules(parsed.rules);
        setBcvRate(parsed.bcvRate);
        setHasCache(true);
      }

      // Fetch fresh data from API routes
      const [ratesRes, bcvRes] = await Promise.all([
        fetch('/api/rates').then((r) => r.json()),
        fetch('/api/bcv').then((r) => r.json()),
      ]);

      const data: RatesData = {
        rates: ratesRes.rates ?? ratesRes,
        rules: ratesRes.rules ?? [],
        bcvRate: bcvRes.rate ?? bcvRes,
      };

      setRates(data.rates);
      setRules(data.rules);
      setBcvRate(data.bcvRate);
      if (typeof window !== 'undefined') {
        localStorage.setItem('cachedRates', JSON.stringify(data));
      }
      setHasCache(true);
    } catch (e: any) {
      setError(e?.message ?? 'Error fetching rates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const reload = load;

  return { rates, rules, bcvRate, loading, error, hasCache, reload };
};
