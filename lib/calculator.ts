// lib/calculator.ts
// ---------------------------------------------------------------------------
// This file replicates the backend Python calculator logic in TypeScript.
// It uses decimal.js for exact decimal arithmetic (same precision as Python's Decimal).
// ---------------------------------------------------------------------------

import Decimal from 'decimal.js';

// ---------------------------------------------------------------------------
// Constants (mirroring Python constants)
// ---------------------------------------------------------------------------
export const ZERO = new Decimal('0');
export const ONE = new Decimal('1');
export const LB_PER_KG = new Decimal('2.2046226218');
export const IN3_PER_FT3 = new Decimal('1728');

// ---------------------------------------------------------------------------
// Helper conversion functions (mirroring d(), round_* helpers)
// ---------------------------------------------------------------------------
function d(value: unknown): Decimal {
  if (value instanceof Decimal) return value;
  if (value === null || value === undefined) return ZERO;
  return new Decimal(String(value));
}

export function roundUsd(value: Decimal | number | string): number {
  return d(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

export function roundVes(value: Decimal | number | string): number {
  return d(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function roundIntHalfUp(value: Decimal | number | string): number {
  return d(value).toDecimalPlaces(0, Decimal.ROUND_HALF_UP).toNumber();
}

export function roundUpToStep(value: Decimal, step: Decimal): Decimal {
  if (value.lte(0) || step.lte(0)) return ZERO;
  const steps = value.div(step).ceil();
  return steps.mul(step);
}

// ---------------------------------------------------------------------------
// Derivation utilities – weight, dimensions, volume
// ---------------------------------------------------------------------------
export function deriveWeightLb(params: {
  totalWeightLb?: number;
  totalWeightKg?: number;
  items?: Array<any>;
}): Decimal {
  const { totalWeightLb = 0, totalWeightKg = 0, items = [] } = params;
  if (d(totalWeightLb).gt(0)) return d(totalWeightLb);
  if (d(totalWeightKg).gt(0)) return d(totalWeightKg).mul(LB_PER_KG);
  let weightLb = ZERO;
  let weightKg = ZERO;
  for (const item of items) {
    const qty = d(item.quantity ?? 1);
    const lb = d(item.weight_lb ?? 0);
    const kg = d(item.weight_kg ?? 0);
    weightLb = weightLb.plus(lb.mul(qty));
    weightKg = weightKg.plus(kg.mul(qty));
  }
  if (weightLb.gt(0)) return weightLb;
  if (weightKg.gt(0)) return weightKg.mul(LB_PER_KG);
  return ZERO;
}

export function derivePackageDimensions(params: {
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  items?: Array<any>;
}): { length: Decimal; width: Decimal; height: Decimal } {
  const { lengthIn = 0, widthIn = 0, heightIn = 0, items = [] } = params;
  if (d(lengthIn).gt(0) && d(widthIn).gt(0) && d(heightIn).gt(0)) {
    return {
      length: d(lengthIn),
      width: d(widthIn),
      height: d(heightIn),
    };
  }
  if (items.length === 1) {
    const item = items[0];
    const l = d(item.length_in ?? 0);
    const w = d(item.width_in ?? 0);
    const h = d(item.height_in ?? 0);
    if (l.gt(0) && w.gt(0) && h.gt(0)) {
      return { length: l, width: w, height: h };
    }
  }
  return { length: d(lengthIn), width: d(widthIn), height: d(heightIn) };
}

export function deriveVolumeFt3(params: {
  totalVolumeFt3?: number;
  lengthIn?: number;
  widthIn?: number;
  heightIn?: number;
  items?: Array<any>;
}): Decimal {
  const { totalVolumeFt3 = 0, lengthIn = 0, widthIn = 0, heightIn = 0, items = [] } = params;
  if (d(totalVolumeFt3).gt(0)) return d(totalVolumeFt3);
  if (d(lengthIn).gt(0) && d(widthIn).gt(0) && d(heightIn).gt(0)) {
    return d(lengthIn).mul(d(widthIn)).mul(d(heightIn)).div(IN3_PER_FT3);
  }
  let volumeFt3 = ZERO;
  for (const item of items) {
    const qty = d(item.quantity ?? 1);
    const vol = d(item.volume_ft3 ?? 0);
    const l = d(item.length_in ?? 0);
    const w = d(item.width_in ?? 0);
    const h = d(item.height_in ?? 0);
    if (vol.gt(0)) {
      volumeFt3 = volumeFt3.plus(vol.mul(qty));
    } else if (l.gt(0) && w.gt(0) && h.gt(0)) {
      const computed = l.mul(w).mul(h).div(IN3_PER_FT3);
      volumeFt3 = volumeFt3.plus(computed.mul(qty));
    }
  }
  return volumeFt3;
}

// ---------------------------------------------------------------------------
// Core calculation for Zoom – mirrors calculate_zoom_quote in calculator.py
// ---------------------------------------------------------------------------
export interface ZoomParams {
  courier_code: 'zoom';
  service_type: 'air' | 'sea';
  zoom_service: 'international_locker';
  origin_country: 'US' | 'VE';
  destination_country: 'US' | 'VE';
  shipment_kind: 'merchandise' | 'document';
  consolidated?: boolean;
  consolidated_package_count?: number;
  use_protection?: boolean;
  declared_value_usd?: number;
  total_weight_kg?: number;
  total_weight_lb?: number;
  total_volume_ft3?: number;
  length_in?: number;
  width_in?: number;
  height_in?: number;
  items?: any[];
}

export interface ZoomRules {
  air_rate_usd_per_kg: number;
  billable_weight_step_kg: number;
  protection_percent: number;
}

export function calculateZoomQuote(params: ZoomParams, rules: ZoomRules) {
  if (params.zoom_service !== 'international_locker') {
    throw new Error('Zoom solo soporta Casillero Internacional');
  }
  if (params.service_type !== 'air') {
    throw new Error('Zoom solo soporta servicio aereo');
  }
  if (params.origin_country !== 'US' || params.destination_country !== 'VE') {
    throw new Error('Zoom solo soporta US -> VE en esta version');
  }
  if (params.shipment_kind !== 'merchandise') {
    throw new Error('Zoom solo soporta tipo de envío mercancía');
  }

  const billableWeightKg = deriveWeightKg({
    totalWeightKg: params.total_weight_kg,
    totalWeightLb: params.total_weight_lb,
    items: params.items,
  });

  const step = d(rules.billable_weight_step_kg);
  const roundedWeightKg = roundUpToStep(billableWeightKg, step);

  const freightUsd = roundedWeightKg.mul(d(rules.air_rate_usd_per_kg));

  let protectionUsd = ZERO;
  if (params.use_protection) {
    const protectionRate = d(rules.protection_percent);
    protectionUsd = d(params.declared_value_usd ?? 0).mul(protectionRate);
  }

  let consolidationFeeUsd = ZERO;
  if (params.consolidated) {
    const count = d(params.consolidated_package_count ?? 1);
    const perPackage = d(rules.air_rate_usd_per_kg).mul(step);
    consolidationFeeUsd = count.mul(perPackage);
  }

  const totalUsd = freightUsd.plus(protectionUsd).plus(consolidationFeeUsd);

  return {
    freight_usd: roundUsd(freightUsd),
    protection_usd: roundUsd(protectionUsd),
    consolidation_usd: roundUsd(consolidationFeeUsd),
    total_usd: roundUsd(totalUsd),
    billable_weight_kg: roundedWeightKg.toNumber(),
  };
}

function deriveWeightKg(params: {
  totalWeightKg?: number;
  totalWeightLb?: number;
  items?: any[];
}): Decimal {
  const { totalWeightKg = 0, totalWeightLb = 0, items = [] } = params;
  if (d(totalWeightKg).gt(0)) return d(totalWeightKg);
  if (d(totalWeightLb).gt(0)) return d(totalWeightLb).div(LB_PER_KG);
  let kg = ZERO;
  let lb = ZERO;
  for (const item of items) {
    const qty = d(item.quantity ?? 1);
    const wkg = d(item.weight_kg ?? 0);
    const wlb = d(item.weight_lb ?? 0);
    kg = kg.plus(wkg.mul(qty));
    lb = lb.plus(wlb.mul(qty));
  }
  if (kg.gt(0)) return kg;
  if (lb.gt(0)) return lb.div(LB_PER_KG);
  return ZERO;
}

// ---------------------------------------------------------------------------
// Core calculation for OWC
// ---------------------------------------------------------------------------
export interface OwcParams {
  courier_code: 'owc';
  service_type: 'air' | 'sea';
  declared_value_usd?: number;
  total_weight_kg?: number;
  total_weight_lb?: number;
  total_volume_ft3?: number;
  length_in?: number;
  width_in?: number;
  height_in?: number;
  items?: any[];
  enable_repack_fee?: boolean;
}

export interface OwcRules {
  air_rate_usd_per_kg: number;
  air_rate_usd_per_lb?: number;
  sea_rate_usd_per_ft3: number;
  repack_fee_usd: number;
  handling_fee_usd: number;
  customs_tax_usd?: number;
}

export function calculateOwcQuote(params: OwcParams, rules: OwcRules) {
  const weightKg = deriveWeightKg({
    totalWeightKg: params.total_weight_kg,
    totalWeightLb: params.total_weight_lb,
    items: params.items,
  });

  const weightLb = deriveWeightLb({
    totalWeightKg: params.total_weight_kg,
    totalWeightLb: params.total_weight_lb,
    items: params.items,
  });

  const volumeFt3 = deriveVolumeFt3({
    totalVolumeFt3: params.total_volume_ft3,
    lengthIn: params.length_in,
    widthIn: params.width_in,
    heightIn: params.height_in,
    items: params.items,
  });

  let freightUsd = ZERO;
  if (params.service_type === 'air') {
    if (rules.air_rate_usd_per_lb !== undefined && rules.air_rate_usd_per_lb !== null) {
      freightUsd = weightLb.mul(d(rules.air_rate_usd_per_lb));
    } else {
      freightUsd = weightKg.mul(d(rules.air_rate_usd_per_kg));
    }
  } else if (params.service_type === 'sea') {
    freightUsd = volumeFt3.mul(d(rules.sea_rate_usd_per_ft3));
  }

  const repackUsd = params.enable_repack_fee ? d(rules.repack_fee_usd) : ZERO;
  const handlingUsd = d(rules.handling_fee_usd);
  const customsTaxUsd = d(rules.customs_tax_usd ?? 0);

  // 1. Redondeamos individualmente cada concepto a 2 decimales (como hace Python)
  const freightRounded = roundUsd(freightUsd);
  const repackRounded = roundUsd(repackUsd);
  const handlingRounded = roundUsd(handlingUsd);
  const customsTaxRounded = roundUsd(customsTaxUsd);

  // 2. Sumamos los valores ya redondeados usando decimal.js para mantener precisión absoluta
  const totalUsd = d(freightRounded)
    .plus(repackRounded)
    .plus(handlingRounded)
    .plus(customsTaxRounded);

  return {
    freight_usd: freightRounded,
    repack_usd: repackRounded,
    handling_usd: handlingRounded,
    customs_tax_usd: customsTaxRounded,
    total_usd: totalUsd.toNumber(), // Retornamos el total exacto acumulado de los redondeos
    billable_weight_kg: roundIntHalfUp(weightKg),
    billable_volume_ft3: roundIntHalfUp(volumeFt3),
  };
}

// ---------------------------------------------------------------------------
// Exported umbrella function
// ---------------------------------------------------------------------------
export interface QuoteParams {
  courier_code: string;
  service_type: string;
  declared_value_usd?: number;
  total_weight_kg?: number;
  total_weight_lb?: number;
  total_volume_ft3?: number;
  length_in?: number;
  width_in?: number;
  height_in?: number;
  items?: any[];
  zoom_service?: string;
  origin_country?: string;
  destination_country?: string;
  shipment_kind?: string;
  consolidated?: boolean;
  consolidated_package_count?: number;
  use_protection?: boolean;
  enable_repack_fee?: boolean;
}

export async function buildQuote(params: QuoteParams, rulesFetcher: (courierCode: string) => Promise<any>) {
  const rules = await rulesFetcher(params.courier_code);
  switch (params.courier_code) {
    case 'zoom':
      return calculateZoomQuote(params as any, rules as any);
    case 'owc':
      return calculateOwcQuote(params as any, rules as any);
    default:
      throw new Error(`Courier '${params.courier_code}' no soportado en cálculo frontend`);
  }
}