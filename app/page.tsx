"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";
const TOURISM_URL = "https://sites.google.com/view/venezuela-rutas-y-sabores?usp=sharing";

type CourierCode = "" | "owc" | "zoom";
type ServiceType = "" | "air" | "sea";
type DeliveryType = "office" | "delivery" | "home";
type RegionType = "region_central" | "resto_pais";
type HoldMode = "none" | "general" | "repack";

type RestrictedItemMatch = {
    item_name: string;
    restriction_level: string;
    matched_input: string;
    reason?: string | null;
    notes?: string | null;
};

type QuoteBreakdown = {
    freight_usd: number;
    freight_ves: number;
    insurance_usd: number;
    insurance_ves: number;
    customs_tax_usd: number;
    customs_tax_ves: number;
    handling_usd: number;
    handling_ves: number;
    packaging_usd: number;
    packaging_ves: number;
    repack_usd: number;
    repack_ves: number;
    storage_usd: number;
    storage_ves: number;
    purchase_service_usd: number;
    purchase_service_ves: number;
    compactation_fee_usd: number;
    compactation_fee_ves: number;
};

type RawMetrics = {
    real_weight_lb: number;
    volumetric_weight_lb: number;
    raw_volume_ft3: number;
    display_volume_ft3: number;
    storage_chargeable_ft3: number;
    length_in_used?: number;
    width_in_used?: number;
    height_in_used?: number;
};

type QuoteEngineResult = {
    engine: string;
    service_type: string;
    charge_unit: string;
    chargeable_units_exact: number;
    chargeable_units_display: number;
    uses_minimum_charge: boolean;
    exchange_rate_used: number;
    raw_metrics: RawMetrics;
    flags: Record<string, string | number | boolean>;
    public_calculator_reference?: Record<string, string | number | boolean>;
    breakdown: QuoteBreakdown;
    total_usd: number;
    total_ves: number;
};

type QuoteResponse = {
    courier: string;
    courier_code: string;
    service_type: string;
    exchange_rate_used: number;
    restricted_matches: RestrictedItemMatch[];
    quote: QuoteEngineResult;
};

type QuoteSaveResponse = {
    shipment_id: string;
    shipment_code: string;
    courier: string;
    courier_code: string;
    service_type: string;
    exchange_rate_used: number;
    restricted_matches: RestrictedItemMatch[];
    quote: QuoteEngineResult;
};

type OwcRulesResponse = {
    courier: string;
    courier_code: string;
    region: RegionType;
    rules: {
        air_base_rate_ves: number;
        sea_base_rate_ves: number;
        correspondence_rate_ves: number;
        handling_fee_ves: number;
    };
};

type FormState = {
    courier_code: CourierCode;
    service_type: ServiceType;
    delivery_type: DeliveryType;
    region: RegionType;
    declared_value_usd: number;
    total_weight_lb: number;
    total_weight_kg: number;
    total_volume_ft3: number;
    length_in: number;
    width_in: number;
    height_in: number;
    total_same_item_qty: number;
    tracking_count: number;
    enable_handling_fee: boolean;
    enable_repack_fee: boolean;
    compactation_requested: boolean;
    hold_mode: HoldMode;
    hold_days: number;
    use_insurance: boolean;
    use_purchase_by_order: boolean;
    apply_provisional_customs: boolean;
};

type NumericField =
    | "declared_value_usd"
    | "total_weight_lb"
    | "total_weight_kg"
    | "total_volume_ft3"
    | "length_in"
    | "width_in"
    | "height_in"
    | "total_same_item_qty"
    | "tracking_count"
    | "hold_days";

const initialForm: FormState = {
    courier_code: "",
    service_type: "",
    delivery_type: "office",
    region: "region_central",
    declared_value_usd: 0,
    total_weight_lb: 5,
    total_weight_kg: 0,
    total_volume_ft3: 0,
    length_in: 5,
    width_in: 5,
    height_in: 5,
    total_same_item_qty: 1,
    tracking_count: 1,
    enable_handling_fee: true,
    enable_repack_fee: false,
    compactation_requested: false,
    hold_mode: "none",
    hold_days: 0,
    use_insurance: false,
    use_purchase_by_order: false,
    apply_provisional_customs: false,
};

const EMPTY_BREAKDOWN: QuoteBreakdown = {
    freight_usd: 0,
    freight_ves: 0,
    insurance_usd: 0,
    insurance_ves: 0,
    customs_tax_usd: 0,
    customs_tax_ves: 0,
    handling_usd: 0,
    handling_ves: 0,
    packaging_usd: 0,
    packaging_ves: 0,
    repack_usd: 0,
    repack_ves: 0,
    storage_usd: 0,
    storage_ves: 0,
    purchase_service_usd: 0,
    purchase_service_ves: 0,
    compactation_fee_usd: 0,
    compactation_fee_ves: 0,
};

const EMPTY_RAW_METRICS: RawMetrics = {
    real_weight_lb: 0,
    volumetric_weight_lb: 0,
    raw_volume_ft3: 0,
    display_volume_ft3: 0,
    storage_chargeable_ft3: 0,
    length_in_used: 0,
    width_in_used: 0,
    height_in_used: 0,
};

function formatNumber(
    value: number,
    maximumDecimals = 2,
    minimumDecimals = 0
) {
    return new Intl.NumberFormat("es-VE", {
        minimumFractionDigits: minimumDecimals,
        maximumFractionDigits: maximumDecimals,
    }).format(Number.isFinite(value) ? value : 0);
}

function formatMoneyBs(value: number, decimals = 0) {
    return `Bs ${formatNumber(value, decimals, decimals)}`;
}

function formatMoneyUsd(value: number, decimals = 2) {
    return `$ ${formatNumber(value, decimals, decimals)}`;
}

function safeNumber(value: unknown, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function csvEscape(value: string | number | boolean | null | undefined) {
    const text = value === null || value === undefined ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
}

function asRecord(value: unknown): Record<string, unknown> {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
        return value as Record<string, unknown>;
    }
    return {};
}

function regionLabel(region: RegionType) {
    return region === "region_central" ? "Región central" : "Resto del país";
}

function serviceLabel(service: ServiceType | string) {
    if (service === "air") return "Aéreo";
    if (service === "sea") return "Marítimo";
    return "Sin seleccionar";
}

function courierLabel(courier: CourierCode | string) {
    if (courier === "owc") return "One Way Cargo";
    if (courier === "zoom") return "Zoom";
    return "Sin seleccionar";
}

function deliveryLabel(delivery: DeliveryType) {
    if (delivery === "office") return "Office";
    if (delivery === "delivery") return "Delivery";
    return "Home";
}

function holdModeLabel(mode: HoldMode) {
    if (mode === "general") return "General";
    if (mode === "repack") return "Repack";
    return "None";
}

function toneClasses(
    tone:
        | "blue"
        | "indigo"
        | "emerald"
        | "amber"
        | "violet"
        | "cyan"
        | "rose"
        | "slate",
    active: boolean
) {
    const palette = {
        blue: active
            ? "bg-blue-50 text-blue-800 ring-1 ring-blue-200"
            : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
        indigo: active
            ? "bg-indigo-50 text-indigo-800 ring-1 ring-indigo-200"
            : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
        emerald: active
            ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
            : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
        amber: active
            ? "bg-amber-50 text-amber-800 ring-1 ring-amber-200"
            : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
        violet: active
            ? "bg-violet-50 text-violet-800 ring-1 ring-violet-200"
            : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
        cyan: active
            ? "bg-cyan-50 text-cyan-800 ring-1 ring-cyan-200"
            : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
        rose: active
            ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200"
            : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
        slate: active
            ? "bg-slate-200 text-slate-800 ring-1 ring-slate-300"
            : "bg-slate-100 text-slate-500 ring-1 ring-slate-200",
    };

    return palette[tone];
}

function MetricCard({
    title,
    value,
    subtitle,
    accent = "default",
}: {
    title: string;
    value: string;
    subtitle?: string;
    accent?: "default" | "primary" | "accent";
}) {
    const accentClasses =
        accent === "primary"
            ? "border-slate-300 bg-slate-900 text-white"
            : accent === "accent"
                ? "border-amber-300 bg-amber-400 text-slate-950"
                : "border-slate-200 bg-white text-slate-900";

    const titleClasses =
        accent === "default" ? "text-slate-500" : "text-inherit/80";
    const subtitleClasses =
        accent === "default" ? "text-slate-500" : "text-inherit/80";

    return (
        <div className={`rounded-3xl border p-5 shadow-sm ${accentClasses}`}>
            <p className={`text-sm ${titleClasses}`}>{title}</p>
            <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
            {subtitle ? (
                <p className={`mt-2 text-xs ${subtitleClasses}`}>{subtitle}</p>
            ) : null}
        </div>
    );
}

function MiniSavedCard({
    title,
    value,
}: {
    title: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {title}
            </p>
            <p className="mt-2 break-all text-sm font-semibold text-slate-800">
                {value}
            </p>
        </div>
    );
}

function OptionCard({
    title,
    description,
    checked,
    onChange,
    disabled = false,
}: {
    title: string;
    description: string;
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label
            className={`flex items-start gap-3 rounded-2xl border p-4 transition ${disabled
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-75"
                    : checked
                        ? "cursor-pointer border-slate-900 bg-slate-50"
                        : "cursor-pointer border-slate-200 bg-white hover:border-slate-300"
                }`}
        >
            <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
            />
            <div>
                <p className="text-sm font-semibold text-slate-900">{title}</p>
                <p className="mt-1 text-xs leading-6 text-slate-500">{description}</p>
            </div>
        </label>
    );
}

function BreakdownRow({
    label,
    ves,
    usd,
    tone,
}: {
    label: string;
    ves: number;
    usd: number;
    tone:
    | "blue"
    | "indigo"
    | "emerald"
    | "amber"
    | "violet"
    | "cyan"
    | "rose"
    | "slate";
}) {
    const active = Math.abs(ves) > 0 || Math.abs(usd) > 0;

    return (
        <div className="grid grid-cols-[1.1fr_0.7fr_0.7fr] gap-3 border-b border-slate-200 py-3 text-sm">
            <div className="flex items-center">
                <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${toneClasses(
                        tone,
                        active
                    )}`}
                >
                    {label}
                </span>
            </div>
            <div
                className={`text-right ${active ? "font-semibold text-slate-800" : "text-slate-500"
                    }`}
            >
                {formatMoneyBs(ves, 0)}
            </div>
            <div
                className={`text-right ${active ? "font-semibold text-slate-800" : "text-slate-500"
                    }`}
            >
                {formatMoneyUsd(usd, 2)}
            </div>
        </div>
    );
}

function normalizeQuoteResponse(input: unknown): QuoteResponse {
    const root = asRecord(input);
    const quote = asRecord(root.quote);
    const rawMetrics = asRecord(quote.raw_metrics);
    const breakdown = asRecord(quote.breakdown);
    const flags = asRecord(quote.flags);
    const publicCalculatorReference = asRecord(quote.public_calculator_reference);

    return {
        courier: String(root.courier ?? ""),
        courier_code: String(root.courier_code ?? ""),
        service_type: String(root.service_type ?? quote.service_type ?? ""),
        exchange_rate_used: safeNumber(
            root.exchange_rate_used ?? quote.exchange_rate_used
        ),
        restricted_matches: Array.isArray(root.restricted_matches)
            ? (root.restricted_matches as RestrictedItemMatch[])
            : [],
        quote: {
            engine: String(quote.engine ?? "unknown_engine"),
            service_type: String(quote.service_type ?? root.service_type ?? ""),
            charge_unit: String(
                quote.charge_unit ??
                (String(root.service_type ?? quote.service_type) === "sea"
                    ? "ft³"
                    : "lb")
            ),
            chargeable_units_exact: safeNumber(quote.chargeable_units_exact),
            chargeable_units_display: safeNumber(quote.chargeable_units_display),
            uses_minimum_charge: Boolean(quote.uses_minimum_charge),
            exchange_rate_used: safeNumber(
                quote.exchange_rate_used ?? root.exchange_rate_used
            ),
            raw_metrics: {
                real_weight_lb: safeNumber(rawMetrics.real_weight_lb),
                volumetric_weight_lb: safeNumber(rawMetrics.volumetric_weight_lb),
                raw_volume_ft3: safeNumber(rawMetrics.raw_volume_ft3),
                display_volume_ft3: safeNumber(rawMetrics.display_volume_ft3),
                storage_chargeable_ft3: safeNumber(
                    rawMetrics.storage_chargeable_ft3
                ),
                length_in_used: safeNumber(rawMetrics.length_in_used),
                width_in_used: safeNumber(rawMetrics.width_in_used),
                height_in_used: safeNumber(rawMetrics.height_in_used),
            },
            flags: Object.fromEntries(
                Object.entries(flags).map(([key, value]) => [
                    key,
                    typeof value === "boolean" ||
                        typeof value === "number" ||
                        typeof value === "string"
                        ? value
                        : String(value),
                ])
            ) as Record<string, string | number | boolean>,
            public_calculator_reference:
                Object.keys(publicCalculatorReference).length > 0
                    ? (Object.fromEntries(
                        Object.entries(publicCalculatorReference).map(
                            ([key, value]) => [
                                key,
                                typeof value === "boolean" ||
                                    typeof value === "number" ||
                                    typeof value === "string"
                                    ? value
                                    : String(value),
                            ]
                        )
                    ) as Record<string, string | number | boolean>)
                    : undefined,
            breakdown: {
                freight_usd: safeNumber(breakdown.freight_usd),
                freight_ves: safeNumber(breakdown.freight_ves),
                insurance_usd: safeNumber(breakdown.insurance_usd),
                insurance_ves: safeNumber(breakdown.insurance_ves),
                customs_tax_usd: safeNumber(breakdown.customs_tax_usd),
                customs_tax_ves: safeNumber(breakdown.customs_tax_ves),
                handling_usd: safeNumber(breakdown.handling_usd),
                handling_ves: safeNumber(breakdown.handling_ves),
                packaging_usd: safeNumber(breakdown.packaging_usd),
                packaging_ves: safeNumber(breakdown.packaging_ves),
                repack_usd: safeNumber(breakdown.repack_usd),
                repack_ves: safeNumber(breakdown.repack_ves),
                storage_usd: safeNumber(breakdown.storage_usd),
                storage_ves: safeNumber(breakdown.storage_ves),
                purchase_service_usd: safeNumber(
                    breakdown.purchase_service_usd
                ),
                purchase_service_ves: safeNumber(
                    breakdown.purchase_service_ves
                ),
                compactation_fee_usd: safeNumber(
                    breakdown.compactation_fee_usd
                ),
                compactation_fee_ves: safeNumber(
                    breakdown.compactation_fee_ves
                ),
            },
            total_usd: safeNumber(quote.total_usd),
            total_ves: safeNumber(quote.total_ves),
        },
    };
}

export default function Home() {
    const [form, setForm] = useState<FormState>(initialForm);
    const [result, setResult] = useState<QuoteResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState("");
    const [saveError, setSaveError] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const [savedQuote, setSavedQuote] = useState<QuoteSaveResponse | null>(null);
    const [rawResponse, setRawResponse] = useState("");

    const [bcvRate, setBcvRate] = useState<number | null>(null);
    const [bcvLoading, setBcvLoading] = useState(true);

    const [owcRules, setOwcRules] = useState<OwcRulesResponse | null>(null);
    const [owcRulesLoading, setOwcRulesLoading] = useState(false);
    const [owcRefreshing, setOwcRefreshing] = useState(false);
    const [owcMessage, setOwcMessage] = useState("");

    const restrictedCount = result?.restricted_matches.length ?? 0;

    const customsTriggeredByValue = Number(form.declared_value_usd) > 200;
    const customsTriggeredByQty = Number(form.total_same_item_qty) >= 4;
    const provisionalCustomsSuggested =
        customsTriggeredByValue || customsTriggeredByQty;

    const effectiveApplyProvisionalCustoms = provisionalCustomsSuggested
        ? true
        : form.apply_provisional_customs;

    const effectiveHoldMode: HoldMode =
        form.hold_days <= 0
            ? "none"
            : form.hold_mode === "repack" && !form.enable_repack_fee
                ? "general"
                : form.hold_mode;

    const effectiveServiceType: ServiceType =
        form.courier_code === "zoom" && form.service_type === "sea"
            ? "air"
            : form.service_type;

    const provisionalCustomsMessage = provisionalCustomsSuggested
        ? customsTriggeredByValue && customsTriggeredByQty
            ? "Se activa automáticamente por valor declarado mayor a USD 200 y por 4 o más unidades del mismo artículo."
            : customsTriggeredByValue
                ? "Se activa automáticamente por valor declarado mayor a USD 200."
                : "Se activa automáticamente por 4 o más unidades del mismo artículo."
        : "No aplica automáticamente con los datos actuales.";

    const canQuote =
        form.courier_code !== "" && effectiveServiceType !== "";

    async function loadExchangeRate(signal?: AbortSignal) {
        try {
            setBcvLoading(true);

            let res = await fetch(`${API_BASE}/exchange-rate/latest`, { signal });

            if (!res.ok) {
                const refreshRes = await fetch(`${API_BASE}/exchange-rate/refresh-bcv`, {
                    method: "POST",
                    signal,
                });

                if (!refreshRes.ok) {
                    const refreshText = await refreshRes.text();
                    console.warn("No se pudo refrescar BCV:", refreshText);
                    setBcvRate(null);
                    return;
                }

                res = await fetch(`${API_BASE}/exchange-rate/latest`, { signal });
            }

            if (!res.ok) {
                const latestText = await res.text();
                console.warn("No se pudo obtener la tasa BCV:", latestText);
                setBcvRate(null);
                return;
            }

            const data = await res.json();
            setBcvRate(safeNumber(data?.rate, 0));
        } catch (err) {
            if ((err as Error).name !== "AbortError") {
                console.warn("Error cargando tasa BCV:", err);
                setBcvRate(null);
            }
        } finally {
            setBcvLoading(false);
        }
    }

    async function loadOwcRules(region: RegionType, signal?: AbortSignal) {
        try {
            setOwcRulesLoading(true);
            const res = await fetch(`${API_BASE}/courier-rules/owc?region=${region}`, {
                signal,
            });

            if (!res.ok) {
                throw new Error("No se pudo cargar el tarifario OWC del sistema");
            }

            const data = await res.json();
            setOwcRules(data as OwcRulesResponse);
        } catch (err) {
            if ((err as Error).name !== "AbortError") {
                console.error("Error cargando courier-rules/owc:", err);
                setOwcRules(null);
            }
        } finally {
            setOwcRulesLoading(false);
        }
    }

    async function refreshOwcRates() {
        try {
            setOwcRefreshing(true);
            setOwcMessage("");

            const res = await fetch(
                `${API_BASE}/couriers/owc/refresh-rates?region=${form.region}`,
                { method: "POST" }
            );

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.detail ?? "No se pudieron actualizar las tarifas OWC");
            }

            setOwcMessage("Tarifario OWC actualizado correctamente.");
            await loadOwcRules(form.region);
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Error al actualizar las tarifas OWC";
            setOwcMessage(message);
        } finally {
            setOwcRefreshing(false);
        }
    }

    useEffect(() => {
        const controller = new AbortController();
        loadExchangeRate(controller.signal);
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (form.courier_code !== "owc") {
            setOwcRules(null);
            setOwcMessage("");
            return;
        }

        const controller = new AbortController();
        loadOwcRules(form.region, controller.signal);
        return () => controller.abort();
    }, [form.courier_code, form.region]);

    function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => ({
            ...prev,
            [key]: value,
        }));
    }

    function setNumberField(key: NumericField, value: string) {
        const numeric = value.trim() === "" ? 0 : Number(value);

        setForm((prev) => ({
            ...prev,
            [key]: Number.isNaN(numeric) ? 0 : numeric,
        }));
    }

    const visibleMetrics = useMemo(() => {
        if (!result) return null;

        const metrics = result.quote?.raw_metrics ?? EMPTY_RAW_METRICS;
        const breakdown = result.quote?.breakdown ?? EMPTY_BREAKDOWN;

        return {
            pesoFinal: safeNumber(result.quote?.chargeable_units_display),
            pieCubicoVisible: safeNumber(metrics.display_volume_ft3),
            volumenReal: safeNumber(metrics.raw_volume_ft3),
            baseStorage: safeNumber(metrics.storage_chargeable_ft3),
            almacenamientoVes: safeNumber(breakdown.storage_ves),
            almacenamientoUsd: safeNumber(breakdown.storage_usd),
        };
    }, [result]);

    function buildQuotePayload() {
        if (form.courier_code === "") {
            throw new Error("Debes seleccionar un courier.");
        }

        if (effectiveServiceType === "") {
            throw new Error("Debes seleccionar un servicio.");
        }

        return {
            ...form,
            courier_code: form.courier_code as Exclude<CourierCode, "">,
            service_type: effectiveServiceType as Exclude<ServiceType, "">,
            hold_mode: effectiveHoldMode,
            apply_provisional_customs: effectiveApplyProvisionalCustoms,
            items: [],
        };
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError("");
        setSaveError("");
        setSaveMessage("");

        try {
            const payload = buildQuotePayload();

            const response = await fetch(`${API_BASE}/quote/calculate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                let detail = "No se pudo calcular la cotización";

                if (typeof data?.detail === "string") {
                    detail = data.detail;
                } else if (Array.isArray(data?.detail)) {
                    detail = data.detail
                        .map((item: { msg?: string }) => item?.msg ?? "Error de validación")
                        .join(" | ");
                }

                throw new Error(detail);
            }

            setSavedQuote(null);
            setResult(normalizeQuoteResponse(data));
            setRawResponse(JSON.stringify(data, null, 2));
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Ocurrió un error inesperado";
            setError(message);
            setResult(null);
            setRawResponse("");
        } finally {
            setLoading(false);
        }
    }

    async function handleSaveQuote() {
        setSaveLoading(true);
        setSaveError("");
        setSaveMessage("");

        try {
            const payload = buildQuotePayload();

            const response = await fetch(`${API_BASE}/quote/calculate-and-save`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            const data = await response.json();

            if (!response.ok) {
                let detail = "No se pudo guardar la cotización";

                if (typeof data?.detail === "string") {
                    detail = data.detail;
                } else if (Array.isArray(data?.detail)) {
                    detail = data.detail
                        .map((item: { msg?: string }) => item?.msg ?? "Error de validación")
                        .join(" | ");
                }

                throw new Error(detail);
            }

            const saved = data as QuoteSaveResponse;

            setSavedQuote(saved);
            setSaveMessage(`Cotización guardada correctamente. Código: ${saved.shipment_code}`);
            setSaveError("");
            setResult(normalizeQuoteResponse(saved));
            setRawResponse(JSON.stringify(saved, null, 2));
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Ocurrió un error al guardar";
            setSaveError(message);
            setSaveMessage("");
        } finally {
            setSaveLoading(false);
        }
    }

    const repackNotice =
        result && form.enable_repack_fee
            ? Boolean(result.quote?.flags?.repack_applies)
                ? {
                    tone: "success" as const,
                    title: "Repack aplicable",
                    message:
                        result.service_type === "air"
                            ? "Repack sí aplica a esta cotización en aéreo."
                            : "Repack sí aplica a esta cotización en marítimo.",
                }
                : {
                    tone: "warning" as const,
                    title: "Aviso sobre repack",
                    message:
                        result.service_type === "air"
                            ? "Repack no aplica todavía en aéreo. Mínimo comercial: 5 lb."
                            : "Repack no aplica todavía en marítimo. Mínimo comercial: 3 ft³.",
                }
            : null;

    function handleExportCsv() {
        if (!result) return;

        const exportBasis =
            result.service_type === "sea"
                ? "sea_volume_display"
                : String(result.quote?.flags?.air_basis ?? "n/a");

        const fileCode =
            savedQuote?.shipment_code ??
            `cotizacion-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}`;

        const breakdown = result.quote?.breakdown ?? EMPTY_BREAKDOWN;
        const metrics = result.quote?.raw_metrics ?? EMPTY_RAW_METRICS;

        const rows: Array<Array<string | number | boolean | null | undefined>> = [
            ["Sección", "Campo", "Valor", "Extra"],
            ["Resumen", "Código", savedQuote?.shipment_code ?? "", ""],
            ["Resumen", "Shipment ID", savedQuote?.shipment_id ?? "", ""],
            ["Resumen", "Courier", result.courier, result.courier_code],
            ["Resumen", "Servicio", result.service_type, ""],
            ["Resumen", "Región", regionLabel(form.region), ""],
            ["Resumen", "Delivery", deliveryLabel(form.delivery_type), ""],
            ["Resumen", "Tasa BCV usada", result.exchange_rate_used, ""],
            ["Resumen", "Base de cálculo", exportBasis, ""],
            ["Resumen", "Tracking count", form.tracking_count, ""],
            ["Resumen", "Cantidad total de paquetes", form.total_same_item_qty, ""],

            ["Entrada", "Valor declarado USD", form.declared_value_usd, ""],
            ["Entrada", "Peso total lb", form.total_weight_lb, ""],
            ["Entrada", "Peso total kg", form.total_weight_kg, ""],
            ["Entrada", "Volumen total ft³", form.total_volume_ft3, ""],
            ["Entrada", "Largo in", form.length_in, ""],
            ["Entrada", "Ancho in", form.width_in, ""],
            ["Entrada", "Alto in", form.height_in, ""],

            ["Flags", "Handling fee", form.enable_handling_fee, ""],
            ["Flags", "Repack fee", form.enable_repack_fee, ""],
            ["Flags", "Compactación", form.compactation_requested, ""],
            ["Flags", "Hold mode", effectiveHoldMode, ""],
            ["Flags", "Hold days", form.hold_days, ""],
            ["Flags", "Seguro 5%", form.use_insurance, ""],
            ["Flags", "Purchase by order", form.use_purchase_by_order, ""],
            ["Flags", "Impuesto provisional", effectiveApplyProvisionalCustoms, ""],

            ["Métricas", "Peso final", result.quote.chargeable_units_display, result.quote.charge_unit],
            ["Métricas", "Peso cobrable exacto", result.quote.chargeable_units_exact, result.quote.charge_unit],
            ["Métricas", "Volumen visible ft³", metrics.display_volume_ft3, ""],
            ["Métricas", "Volumen real ft³", metrics.raw_volume_ft3, ""],
            ["Métricas", "Base storage ft³", metrics.storage_chargeable_ft3, ""],
            ["Métricas", "Peso real lb", metrics.real_weight_lb, ""],
            ["Métricas", "Peso volumétrico lb", metrics.volumetric_weight_lb, ""],

            ["Desglose", "Flete", breakdown.freight_ves, breakdown.freight_usd],
            ["Desglose", "Handling", breakdown.handling_ves, breakdown.handling_usd],
            ["Desglose", "Seguro", breakdown.insurance_ves, breakdown.insurance_usd],
            ["Desglose", "Impuestos", breakdown.customs_tax_ves, breakdown.customs_tax_usd],
            ["Desglose", "Repack", breakdown.repack_ves, breakdown.repack_usd],
            ["Desglose", "Storage", breakdown.storage_ves, breakdown.storage_usd],
            ["Desglose", "Compra por encargo", breakdown.purchase_service_ves, breakdown.purchase_service_usd],
            ["Desglose", "Compactación", breakdown.compactation_fee_ves, breakdown.compactation_fee_usd],
            ["Desglose", "Packaging", breakdown.packaging_ves, breakdown.packaging_usd],

            ["Totales", "Total VES", result.quote.total_ves, ""],
            ["Totales", "Total USD", result.quote.total_usd, ""],
        ];

        if (repackNotice) {
            rows.push(["Avisos", repackNotice.title, repackNotice.message, repackNotice.tone]);
        }

        if (result.restricted_matches.length > 0) {
            rows.push(["", "", "", ""]);
            rows.push(["Restricciones", "Item", "Nivel", "Notas"]);

            result.restricted_matches.forEach((item) => {
                rows.push([
                    "Restricciones",
                    item.item_name,
                    item.restriction_level,
                    item.notes ?? item.reason ?? "",
                ]);
            });
        }

        const csvContent =
            "\ufeff" +
            rows
                .map((row) => row.map((value) => csvEscape(value)).join(","))
                .join("\n");

        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        });

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${fileCode}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    function buildWhatsAppMessage() {
        if (!result) return "";

        const breakdown = result.quote?.breakdown ?? EMPTY_BREAKDOWN;
        const metrics = result.quote?.raw_metrics ?? EMPTY_RAW_METRICS;

        const activeCharges = [
            breakdown.freight_ves > 0
                ? `• Flete: ${formatMoneyBs(breakdown.freight_ves, 2)} | ${formatMoneyUsd(breakdown.freight_usd, 2)}`
                : null,
            breakdown.handling_ves > 0
                ? `• Handling: ${formatMoneyBs(breakdown.handling_ves, 2)} | ${formatMoneyUsd(breakdown.handling_usd, 2)}`
                : null,
            breakdown.insurance_ves > 0
                ? `• Seguro: ${formatMoneyBs(breakdown.insurance_ves, 2)} | ${formatMoneyUsd(breakdown.insurance_usd, 2)}`
                : null,
            breakdown.customs_tax_ves > 0
                ? `• Impuestos: ${formatMoneyBs(breakdown.customs_tax_ves, 2)} | ${formatMoneyUsd(breakdown.customs_tax_usd, 2)}`
                : null,
            breakdown.repack_ves > 0
                ? `• Repack: ${formatMoneyBs(breakdown.repack_ves, 2)} | ${formatMoneyUsd(breakdown.repack_usd, 2)}`
                : null,
            breakdown.storage_ves > 0
                ? `• Storage: ${formatMoneyBs(breakdown.storage_ves, 2)} | ${formatMoneyUsd(breakdown.storage_usd, 2)}`
                : null,
            breakdown.purchase_service_ves > 0
                ? `• Compra por encargo: ${formatMoneyBs(breakdown.purchase_service_ves, 2)} | ${formatMoneyUsd(breakdown.purchase_service_usd, 2)}`
                : null,
            breakdown.compactation_fee_ves > 0
                ? `• Compactación: ${formatMoneyBs(breakdown.compactation_fee_ves, 2)} | ${formatMoneyUsd(breakdown.compactation_fee_usd, 2)}`
                : null,
            breakdown.packaging_ves > 0
                ? `• Packaging: ${formatMoneyBs(breakdown.packaging_ves, 2)} | ${formatMoneyUsd(breakdown.packaging_usd, 2)}`
                : null,
        ].filter(Boolean) as string[];

        const lines = [
            "Hola, quiero compartir esta cotización:",
            "",
            `Courier: ${result.courier}`,
            `Servicio: ${serviceLabel(effectiveServiceType)}`,
            `Región: ${regionLabel(form.region)}`,
            `Delivery type: ${deliveryLabel(form.delivery_type)}`,
            "",
            `Peso final: ${formatNumber(result.quote.chargeable_units_display, 2, 2)} ${result.quote.charge_unit}`,
            `Volumen visible: ${formatNumber(metrics.display_volume_ft3, 2, 2)} ft³`,
            `Volumen real: ${formatNumber(metrics.raw_volume_ft3, 2, 2)} ft³`,
            `Base storage: ${formatNumber(metrics.storage_chargeable_ft3, 2, 2)} ft³`,
            "",
            "Cargos aplicados:",
            ...(activeCharges.length > 0 ? activeCharges : ["• Sin cargos adicionales"]),
            "",
            `Total USD: ${formatMoneyUsd(result.quote.total_usd, 2)}`,
            `Total VES: ${formatMoneyBs(result.quote.total_ves, 2)}`,
            `Tasa BCV usada: ${formatNumber(result.exchange_rate_used, 4, 4)}`,
            "",
            `Valor declarado USD: ${formatMoneyUsd(form.declared_value_usd, 2)}`,
            `Tracking count: ${formatNumber(form.tracking_count, 0, 0)}`,
            `Cantidad total del mismo artículo: ${formatNumber(form.total_same_item_qty, 0, 0)}`,
            "",
            ...(savedQuote
                ? [
                    `Código de cotización: ${savedQuote.shipment_code}`,
                    `Shipment ID: ${savedQuote.shipment_id}`,
                    "",
                ]
                : []),
            repackNotice ? `${repackNotice.title}: ${repackNotice.message}` : "",
            "Generado desde Vzla Cargo Hub.",
        ].filter(Boolean);

        return lines.join("\n");
    }

    function handleSendWhatsApp() {
        if (!result) {
            setError("Primero calcula una cotización antes de enviarla por WhatsApp.");
            return;
        }

        const message = buildWhatsAppMessage();
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        window.open(url, "_blank", "noopener,noreferrer");
    }

    const displayBasis =
        result?.service_type === "sea"
            ? "sea_volume_display"
            : String(result?.quote?.flags?.air_basis ?? "n/a");

    const resultMetrics = result?.quote?.raw_metrics ?? EMPTY_RAW_METRICS;
    const resultBreakdown = result?.quote?.breakdown ?? EMPTY_BREAKDOWN;

    return (
        <main className="min-h-screen bg-slate-100">
            <div className="mx-auto max-w-7xl px-6 py-10">
                <div className="mb-8 rounded-[2rem] border border-slate-200 bg-white px-6 py-6 shadow-sm">
                    <div className="mb-6 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                            Motor OWC / Zoom
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                            FastAPI + Next.js
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                            Cálculo comercial
                        </span>
                    </div>

                    <div className="mb-8 rounded-[2rem] border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-blue-50 p-6 shadow-sm">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="max-w-3xl">
                                <div className="mb-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                                    Turismo en Venezuela
                                </div>
                                <h2 className="text-2xl font-bold tracking-tight text-slate-950">
                                    Apoya el turismo en los llanos venezolanos
                                </h2>
                                <p className="mt-2 text-sm leading-7 text-slate-600">
                                    Descubre destinos, rutas, paisajes y experiencias que muestran lo mejor de Venezuela.
                                    Esta sección abre en una pestaña nueva para que no pierdas tu cotización en Vzla Cargo Hub.
                                </p>
                            </div>

                            <div className="flex shrink-0">
                                <a
                                    href={TOURISM_URL}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                                >
                                    Visitar sitio de turismo
                                </a>
                            </div>
                        </div>
                    </div>

                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_270px] lg:items-end">
                        <div>
                            <h1 className="text-5xl font-black tracking-tight text-slate-950">
                                Vzla Cargo Hub
                            </h1>

                            <p className="mt-4 max-w-3xl text-xl leading-9 text-slate-700">
                                Calcula envíos con reglas reales del courier, peso final,
                                volumen visible y desglose detallado por tipo de cargo.
                            </p>

                            <div className="mt-4 flex flex-wrap gap-2">
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                                    Courier: {courierLabel(form.courier_code)}
                                </span>
                                <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                                    Servicio: {serviceLabel(effectiveServiceType)}
                                </span>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                    Región: {regionLabel(form.region)}
                                </span>
                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                    Delivery: {deliveryLabel(form.delivery_type)}
                                </span>
                            </div>
                        </div>

                        <div className="lg:self-end lg:pb-3">
                            <div className="w-full rounded-[2rem] bg-slate-900 px-6 py-5 text-white shadow-xl">
                                <div className="text-sm uppercase tracking-wide text-slate-300">
                                    Tasa BCV
                                </div>

                                {bcvLoading ? (
                                    <div className="mt-4 flex items-center gap-3">
                                        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-400 border-t-white" />
                                        <span className="text-lg font-semibold">Cargando...</span>
                                    </div>
                                ) : (
                                    <div className="mt-2 text-5xl font-black">
                                        {bcvRate !== null && bcvRate > 0 ? formatNumber(bcvRate, 4, 4) : "N/D"}
                                    </div>
                                )}

                                <div className="mt-2 text-sm text-slate-300">USD → VES</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-8 lg:grid-cols-[1.03fr_0.97fr]">
                    <form
                        onSubmit={handleSubmit}
                        className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                    >
                        <div className="mb-6">
                            <h2 className="text-2xl font-bold text-slate-950">
                                Formulario de cotización
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Completa los datos del paquete para estimar el costo del envío,
                                el peso final de cobro, el volumen visible y los cargos
                                adicionales que apliquen.
                            </p>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Courier</span>
                                <select
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={form.courier_code}
                                    onChange={(e) => {
                                        const nextCourier = e.target.value as CourierCode;

                                        setForm((prev) => ({
                                            ...prev,
                                            courier_code: nextCourier,
                                            service_type:
                                                nextCourier === "zoom" && prev.service_type === "sea"
                                                    ? "air"
                                                    : prev.service_type,
                                        }));
                                    }}
                                >
                                    <option value="">Selecciona un courier</option>
                                    <option value="owc">One Way Cargo</option>
                                    <option value="zoom">Zoom (beta)</option>
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Servicio</span>
                                <select
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={effectiveServiceType}
                                    onChange={(e) =>
                                        updateForm("service_type", e.target.value as ServiceType)
                                    }
                                >
                                    <option value="">Selecciona un servicio</option>
                                    <option value="air">Aéreo</option>
                                    <option value="sea" disabled={form.courier_code === "zoom"}>
                                        Marítimo
                                    </option>
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Región</span>
                                <select
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-400"
                                    value={form.region}
                                    disabled={form.courier_code !== "owc"}
                                    onChange={(e) =>
                                        updateForm("region", e.target.value as RegionType)
                                    }
                                >
                                    <option value="region_central">Región central</option>
                                    <option value="resto_pais">Resto del país</option>
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">
                                    Delivery type
                                </span>
                                <select
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={form.delivery_type}
                                    onChange={(e) =>
                                        updateForm("delivery_type", e.target.value as DeliveryType)
                                    }
                                >
                                    <option value="office">Office</option>
                                    <option value="delivery">Delivery</option>
                                    <option value="home">Home</option>
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">
                                    Valor declarado USD
                                </span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={form.declared_value_usd}
                                    onChange={(e) =>
                                        setNumberField("declared_value_usd", e.target.value)
                                    }
                                />
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">
                                    Peso total (lb)
                                </span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={form.total_weight_lb}
                                    onChange={(e) => setNumberField("total_weight_lb", e.target.value)}
                                />
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Largo (in)</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={form.length_in}
                                    onChange={(e) => setNumberField("length_in", e.target.value)}
                                />
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Ancho (in)</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={form.width_in}
                                    onChange={(e) => setNumberField("width_in", e.target.value)}
                                />
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Alto (in)</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={form.height_in}
                                    onChange={(e) => setNumberField("height_in", e.target.value)}
                                />
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">
                                    Tracking count
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={form.tracking_count}
                                    onChange={(e) => setNumberField("tracking_count", e.target.value)}
                                />
                            </label>

                            <label className="space-y-2 md:col-span-2">
                                <span className="text-sm font-medium text-slate-700">
                                    Cantidad total del mismo artículo
                                </span>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={form.total_same_item_qty}
                                    onChange={(e) =>
                                        setNumberField("total_same_item_qty", e.target.value)
                                    }
                                />
                            </label>
                        </div>

                        <details className="mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
                            <summary className="cursor-pointer text-lg font-semibold text-slate-900">
                                Opciones avanzadas
                            </summary>

                            <p className="mt-4 text-sm leading-7 text-slate-600">
                                Activa solo las opciones que apliquen a esta cotización. Estas
                                opciones simulan cargos o servicios adicionales como handling,
                                reempaque, almacenaje, seguro o compra por encargo.
                            </p>

                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <OptionCard
                                    title="Handling fee"
                                    description="Cargo operativo fijo por guía o tracking recibido."
                                    checked={form.enable_handling_fee}
                                    onChange={(checked) => updateForm("enable_handling_fee", checked)}
                                />

                                <OptionCard
                                    title="Repack fee"
                                    description="Servicio de reempaque cuando el courier lo requiere."
                                    checked={form.enable_repack_fee}
                                    onChange={(checked) => updateForm("enable_repack_fee", checked)}
                                />

                                <OptionCard
                                    title="Seguro 5%"
                                    description="Protección opcional basada en el valor declarado."
                                    checked={form.use_insurance}
                                    onChange={(checked) => updateForm("use_insurance", checked)}
                                />

                                <OptionCard
                                    title="Purchase by order"
                                    description="Servicio de compra por encargo aplicado sobre el valor del producto."
                                    checked={form.use_purchase_by_order}
                                    onChange={(checked) => updateForm("use_purchase_by_order", checked)}
                                />

                                <OptionCard
                                    title="Impuesto provisional"
                                    description={provisionalCustomsMessage}
                                    checked={effectiveApplyProvisionalCustoms}
                                    disabled={provisionalCustomsSuggested}
                                    onChange={(checked) =>
                                        updateForm("apply_provisional_customs", checked)
                                    }
                                />

                                <OptionCard
                                    title="Compactación"
                                    description="Reduce volumen cuando el servicio esté disponible."
                                    checked={form.compactation_requested}
                                    onChange={(checked) =>
                                        updateForm("compactation_requested", checked)
                                    }
                                />
                            </div>

                            <div className="mt-5 grid gap-4 md:grid-cols-2">
                                <label className="space-y-2">
                                    <span className="text-sm font-medium text-slate-700">
                                        Hold mode
                                    </span>
                                    <select
                                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                        value={effectiveHoldMode}
                                        onChange={(e) =>
                                            updateForm("hold_mode", e.target.value as HoldMode)
                                        }
                                    >
                                        <option value="none">none</option>
                                        <option value="general">general</option>
                                        <option value="repack" disabled={!form.enable_repack_fee}>
                                            repack
                                        </option>
                                    </select>
                                </label>

                                <label className="space-y-2">
                                    <span className="text-sm font-medium text-slate-700">
                                        Hold days
                                    </span>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                        value={form.hold_days}
                                        onChange={(e) => setNumberField("hold_days", e.target.value)}
                                    />
                                </label>
                            </div>

                            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                <p className="font-semibold">Lógica inteligente activa</p>
                                <p className="mt-1 leading-6">
                                    El impuesto provisional se sugiere automáticamente si el valor
                                    declarado supera USD 200 o si hay 4 o más unidades del mismo
                                    artículo. El hold mode <strong>repack</strong> solo queda
                                    disponible si el reempaque está activado.
                                </p>
                            </div>

                            {repackNotice ? (
                                <div
                                    className={`mt-4 rounded-2xl p-4 text-sm ${repackNotice.tone === "success"
                                            ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                                            : "border border-violet-200 bg-violet-50 text-violet-900"
                                        }`}
                                >
                                    <p className="font-semibold">{repackNotice.title}</p>
                                    <p className="mt-1 leading-6">{repackNotice.message}</p>
                                </div>
                            ) : null}
                        </details>

                        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <button
                                type="submit"
                                disabled={loading || saveLoading || !canQuote}
                                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-lg font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Calculando..." : "Calcular"}
                            </button>

                            <button
                                type="button"
                                onClick={handleSaveQuote}
                                disabled={loading || saveLoading || !canQuote}
                                className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-lg font-semibold text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {saveLoading ? "Guardando..." : "Guardar cotización"}
                            </button>

                            <button
                                type="button"
                                onClick={handleExportCsv}
                                disabled={!result || loading || saveLoading}
                                className="inline-flex w-full items-center justify-center rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-lg font-semibold text-emerald-900 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Exportar CSV
                            </button>

                            <button
                                type="button"
                                onClick={handleSendWhatsApp}
                                disabled={!result || loading || saveLoading}
                                className="inline-flex w-full items-center justify-center rounded-2xl bg-emerald-600 px-4 py-3 text-lg font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Enviar por WhatsApp
                            </button>
                        </div>

                        {!canQuote ? (
                            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                Selecciona un courier y un servicio para calcular o guardar la cotización.
                            </div>
                        ) : null}

                        {error ? (
                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                {error}
                            </div>
                        ) : null}

                        {saveError ? (
                            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                {saveError}
                            </div>
                        ) : null}

                        {saveMessage ? (
                            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                                {saveMessage}
                            </div>
                        ) : null}

                        {savedQuote ? (
                            <div className="mt-4 rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
                                <div className="mb-3">
                                    <h3 className="text-lg font-bold text-slate-900">
                                        Cotización guardada
                                    </h3>
                                    <p className="mt-1 text-sm text-slate-600">
                                        Resumen del registro creado en el backend.
                                    </p>
                                </div>

                                <div className="grid gap-3 sm:grid-cols-2">
                                    <MiniSavedCard title="Código" value={savedQuote.shipment_code} />
                                    <MiniSavedCard title="Shipment ID" value={savedQuote.shipment_id} />
                                    <MiniSavedCard title="Courier" value={savedQuote.courier} />
                                    <MiniSavedCard
                                        title="Servicio"
                                        value={serviceLabel(savedQuote.service_type)}
                                    />
                                </div>
                            </div>
                        ) : null}
                    </form>

                    <section className="space-y-6">
                        {form.courier_code === "owc" ? (
                            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-950">
                                            Tarifario OWC en sistema
                                        </h2>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Se carga automáticamente al seleccionar One Way Cargo y
                                            puedes refrescarlo manualmente con el botón.
                                        </p>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={refreshOwcRates}
                                        disabled={owcRefreshing}
                                        className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {owcRefreshing ? "Actualizando..." : "Actualizar tarifas OWC"}
                                    </button>
                                </div>

                                {owcRulesLoading ? (
                                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                        Cargando tarifario OWC...
                                    </div>
                                ) : owcRules ? (
                                    <>
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <MetricCard
                                                title="Aéreo"
                                                value={`${formatMoneyBs(
                                                    owcRules.rules.air_base_rate_ves,
                                                    0
                                                )} / lb`}
                                                subtitle="Tarifa activa"
                                            />
                                            <MetricCard
                                                title="Marítimo"
                                                value={`${formatMoneyBs(
                                                    owcRules.rules.sea_base_rate_ves,
                                                    0
                                                )} / ft³`}
                                                subtitle="Tarifa activa"
                                            />
                                            <MetricCard
                                                title="Correspondencia"
                                                value={formatMoneyBs(
                                                    owcRules.rules.correspondence_rate_ves,
                                                    0
                                                )}
                                                subtitle="Tarifa única"
                                            />
                                            <MetricCard
                                                title="Handling"
                                                value={formatMoneyBs(owcRules.rules.handling_fee_ves, 0)}
                                                subtitle="Cargo operativo"
                                            />
                                        </div>

                                        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                                            <p>
                                                <strong>Región:</strong> {regionLabel(owcRules.region)}
                                            </p>
                                            <p className="mt-1">
                                                <strong>Fuente:</strong> courier-rules/owc
                                            </p>
                                            {owcMessage ? <p className="mt-2">{owcMessage}</p> : null}
                                        </div>
                                    </>
                                ) : (
                                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
                                        No se pudo cargar el tarifario OWC del sistema.
                                    </div>
                                )}
                            </div>
                        ) : null}

                        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                            <div className="mb-5">
                                <h2 className="text-2xl font-bold text-slate-950">Resultado</h2>
                                <p className="mt-2 text-sm leading-6 text-slate-600">
                                    Panel compacto con peso final, volumen visible, volumen real,
                                    base cobrable para storage y total estimado.
                                </p>
                            </div>

                            {form.courier_code === "zoom" ? (
                                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                    Zoom está en implementación. Algunas métricas avanzadas pueden mostrarse en cero mientras terminamos su motor de cálculo.
                                </div>
                            ) : null}

                            {result && visibleMetrics ? (
                                <>
                                    <div className="grid gap-4 md:grid-cols-2">
                                        <MetricCard
                                            title="Peso final"
                                            value={formatNumber(visibleMetrics.pesoFinal, 2, 2)}
                                            subtitle={`Unidad de cobro: ${result.quote.charge_unit === "lb" ? "lb" : "ft³"
                                                }`}
                                        />
                                        <MetricCard
                                            title="Pie cúbico visible"
                                            value={formatNumber(visibleMetrics.pieCubicoVisible, 2, 2)}
                                            subtitle="Volumen visible/redondeado"
                                        />
                                        <MetricCard
                                            title="Volumen real"
                                            value={`${formatNumber(visibleMetrics.volumenReal, 2, 2)} ft³`}
                                            subtitle="Volumen geométrico calculado"
                                        />
                                        <MetricCard
                                            title="Base storage"
                                            value={`${formatNumber(visibleMetrics.baseStorage, 2, 2)} ft³`}
                                            subtitle="Base usada para almacenaje"
                                        />
                                        <MetricCard
                                            title="Storage estimado"
                                            value={formatMoneyBs(visibleMetrics.almacenamientoVes, 2)}
                                            subtitle={formatMoneyUsd(visibleMetrics.almacenamientoUsd, 2)}
                                        />
                                        <MetricCard
                                            title="Total USD"
                                            value={formatMoneyUsd(result.quote.total_usd, 2)}
                                            subtitle={formatMoneyBs(result.quote.total_ves, 2)}
                                            accent="primary"
                                        />
                                    </div>

                                    <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                        <div className="mb-3 flex flex-wrap items-center gap-2">
                                            <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white">
                                                {result.courier}
                                            </span>
                                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                                engine: {result.quote.engine}
                                            </span>
                                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                                rate: {formatNumber(result.exchange_rate_used, 4, 4)}
                                            </span>
                                            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                                restricciones: {restrictedCount}
                                            </span>
                                        </div>

                                        <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                                            <p>
                                                <strong>Base de cálculo:</strong> {displayBasis}
                                            </p>
                                            <p>
                                                <strong>Hold mode:</strong> {holdModeLabel(effectiveHoldMode)}
                                            </p>
                                            <p>
                                                <strong>Volumen real:</strong>{" "}
                                                {formatNumber(safeNumber(resultMetrics.raw_volume_ft3), 2, 2)} ft³
                                            </p>
                                            <p>
                                                <strong>Volumen visible:</strong>{" "}
                                                {formatNumber(safeNumber(resultMetrics.display_volume_ft3), 2, 2)} ft³
                                            </p>
                                            <p>
                                                <strong>Base storage:</strong>{" "}
                                                {formatNumber(
                                                    safeNumber(resultMetrics.storage_chargeable_ft3),
                                                    2,
                                                    2
                                                )}{" "}
                                                ft³
                                            </p>
                                            <p>
                                                <strong>Tracking count:</strong> {form.tracking_count}
                                            </p>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
                                    Aquí aparecerán el peso final, el pie cúbico visible, la base
                                    de storage, el storage estimado y el total cuando calcules una
                                    cotización.
                                </div>
                            )}
                        </div>

                        {result ? (
                            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-2xl font-bold text-slate-950">Desglose</h3>
                                        <p className="mt-1 text-sm text-slate-600">
                                            Cada fila se resalta según el tipo de cargo y si tiene monto aplicado.
                                        </p>
                                    </div>

                                    <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                        {serviceLabel(effectiveServiceType)}
                                    </div>
                                </div>

                                <div className="mb-2 grid grid-cols-[1.1fr_0.7fr_0.7fr] gap-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                    <div>Concepto</div>
                                    <div className="text-right">VES</div>
                                    <div className="text-right">USD</div>
                                </div>

                                <BreakdownRow
                                    label="Flete"
                                    ves={resultBreakdown.freight_ves}
                                    usd={resultBreakdown.freight_usd}
                                    tone="blue"
                                />
                                <BreakdownRow
                                    label="Handling"
                                    ves={resultBreakdown.handling_ves}
                                    usd={resultBreakdown.handling_usd}
                                    tone="indigo"
                                />
                                <BreakdownRow
                                    label="Seguro"
                                    ves={resultBreakdown.insurance_ves}
                                    usd={resultBreakdown.insurance_usd}
                                    tone="emerald"
                                />
                                <BreakdownRow
                                    label="Impuestos"
                                    ves={resultBreakdown.customs_tax_ves}
                                    usd={resultBreakdown.customs_tax_usd}
                                    tone="amber"
                                />
                                <BreakdownRow
                                    label="Repack"
                                    ves={resultBreakdown.repack_ves}
                                    usd={resultBreakdown.repack_usd}
                                    tone="violet"
                                />
                                <BreakdownRow
                                    label="Storage"
                                    ves={resultBreakdown.storage_ves}
                                    usd={resultBreakdown.storage_usd}
                                    tone="cyan"
                                />
                                <BreakdownRow
                                    label="Compra por encargo"
                                    ves={resultBreakdown.purchase_service_ves}
                                    usd={resultBreakdown.purchase_service_usd}
                                    tone="rose"
                                />
                                <BreakdownRow
                                    label="Compactación"
                                    ves={resultBreakdown.compactation_fee_ves}
                                    usd={resultBreakdown.compactation_fee_usd}
                                    tone="slate"
                                />
                                <BreakdownRow
                                    label="Packaging"
                                    ves={resultBreakdown.packaging_ves}
                                    usd={resultBreakdown.packaging_usd}
                                    tone="slate"
                                />

                                <div className="mt-5 grid gap-4 md:grid-cols-2">
                                    <MetricCard
                                        title="Total USD"
                                        value={formatMoneyUsd(result.quote.total_usd, 2)}
                                        subtitle="Monto final estimado"
                                        accent="primary"
                                    />
                                    <MetricCard
                                        title="Total VES"
                                        value={formatMoneyBs(result.quote.total_ves, 2)}
                                        subtitle="Conversión con tasa BCV actual"
                                        accent="accent"
                                    />
                                </div>
                            </div>
                        ) : null}

                        {rawResponse ? (
                            <details className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                                <summary className="cursor-pointer text-lg font-semibold text-slate-900">
                                    JSON de respuesta
                                </summary>
                                <pre className="mt-4 overflow-x-auto rounded-2xl bg-slate-950 p-4 text-xs text-slate-100">
                                    {rawResponse}
                                </pre>
                            </details>
                        ) : null}
                    </section>
                </div>
            </div>
            <footer className="mt-10 rounded-[2rem] border border-slate-200 bg-white px-6 py-5 shadow-sm">
                <div className="flex flex-col gap-2 text-center text-sm text-slate-600">
                    <p>
                        Copyright: Lorenzo V Roca, José Tarazón, Sleither Vásquez, Adrián Cedeño.
                    </p>
                    <p>
                        Hecho con Amor y Café ☕. Mantente al tanto de las futuras actualizaciones.
                    </p>
                </div>
            </footer>
        </main>
    );
}