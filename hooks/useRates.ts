import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export interface Courier {
    id: string;
    name: string;
    code: string;
    active: boolean;
}

export interface CourierRate {
    id: string;
    courier_id: string;
    service_type: string;
    charge_unit: string;
    currency: string;
    rate: number;
    minimum_charge_units: number;
    handling_fee: number;
    handling_fee_currency: string;
    insurance_percent: number;
    packaging_fee: number;
    packaging_fee_currency: string;
    applies_to_delivery_type: string;
    region: string;
    active: boolean;
}

export interface ExchangeRate {
    id: string;
    currency_from: string;
    currency_to: string;
    rate: number;
    source: string;
    fetched_at: string;
}

export function useRates() {
    const [couriers, setCouriers] = useState<Courier[]>([]);
    const [rates, setRates] = useState<CourierRate[]>([]);
    const [exchangeRate, setExchangeRate] = useState<ExchangeRate | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchAll() {
            setLoading(true);
            setError(null);
            try {
                const [couriersRes, ratesRes, exchangeRes] = await Promise.all([
                    supabase.from('couriers').select('*').eq('active', true),
                    supabase.from('courier_rates').select('*').eq('active', true),
                    supabase.from('exchange_rates').select('*').order('fetched_at', { ascending: false }).limit(1)
                ]);

                if (couriersRes.error) throw couriersRes.error;
                if (ratesRes.error) throw ratesRes.error;
                if (exchangeRes.error) throw exchangeRes.error;

                setCouriers(couriersRes.data || []);
                setRates(ratesRes.data || []);
                setExchangeRate(exchangeRes.data?.[0] || null);
            } catch (err: any) {
                console.error("Error fetching rates from Supabase:", err);
                setError(err.message || "Error al cargar las tarifas");
            } finally {
                setLoading(false);
            }
        }

        fetchAll();
    }, []);

    return { couriers, rates, exchangeRate, loading, error };
}
