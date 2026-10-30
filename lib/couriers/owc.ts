// lib/couriers/owc.ts
// ------------------------------------------------------------
// Courier‑specific wrapper for One Way Cargo (OWC) calculations.
// The heavy lifting is performed in `../calculator`.
// ------------------------------------------------------------

import { calculateOwcQuote, type OwcParams, type OwcRules } from "../calculator";

/**
 * Public API for the OWC courier.
 */
export function getOwcQuote(params: OwcParams, rules: OwcRules) {
  return calculateOwcQuote(params, rules);
}

export type { OwcParams, OwcRules };
