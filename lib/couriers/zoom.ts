// lib/couriers/zoom.ts
// ------------------------------------------------------------
// Courier‑specific wrapper for Zoom calculations.
// This file re‑exports the core calculation implementation that lives
// in `../calculator`. Keeping the logic in a single place avoids
// duplication and guarantees consistent behaviour between the frontend
// hook and any future server‑side usage.
// ------------------------------------------------------------

import { calculateZoomQuote, type ZoomParams, type ZoomRules } from "../calculator";

/**
 * Public API for the Zoom courier.
 *
 * The backend restricts Zoom to the "office" delivery type (locker).
 * All validation is performed inside `calculateZoomQuote` – this
 * wrapper simply forwards the parameters.
 */
export function getZoomQuote(params: ZoomParams, rules: ZoomRules) {
  return calculateZoomQuote(params, rules);
}

export type { ZoomParams, ZoomRules };
