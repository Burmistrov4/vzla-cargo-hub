"use client";

import {
    useEffect,
    useId,
    useMemo,
    useState,
    type FocusEvent,
    type FormEvent,
} from "react";

const API_BASE =
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://vzla-cargo-hub-backend-production.up.railway.app";
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
    protection_usd: number;
    protection_ves: number;
    consolidation_usd: number;
    consolidation_ves: number;
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
    sea_freight_volume_ft3?: number;
    storage_chargeable_ft3: number;
    storage_charge_min_ft3?: number;
    storage_fee_usd_per_day_ft3?: number;
    storage_fee_ves_per_day_ft3?: number;
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
        storage_fee_usd_per_day_ft3?: number;
        storage_fee_ves_per_day_ft3?: number;
        storage_fee_currency?: string;
        storage_charge_min_ft3?: number;
        general_hold_free_business_days?: number;
    };
    freshness?: {
        stale?: boolean;
        reasons?: string[];
        oldest_updated_at?: string | null;
        refresh_attempted?: boolean;
        refresh_succeeded?: boolean;
        refresh_error?: string | null;
        message?: string | null;
    };
};

type OwcRestrictedItemMatch = {
    item_name: string;
    restriction_level: string;
    display_level?: string | null;
    action?: string | null;
    matched_input: string;
    match_type?: string | null;
    confidence?: number | null;
    category_id?: string | null;
    category_label?: string | null;
    reason?: string | null;
    notes?: string | null;
    user_message?: string | null;
    recommendation?: string | null;
    examples?: string[];
    source_url?: string | null;
    courier_id?: string | null;
};

type OwcRestrictedItemsResponse = {
    query: string;
    normalized_query?: string;
    courier_code: string;
    matches: OwcRestrictedItemMatch[];
    matched_categories?: Array<{
        id: string;
        label: string;
        level_hint?: string;
        examples?: string[];
        user_message?: string | null;
        recommendation?: string | null;
    }>;
    expanded_terms?: string[];
    status?: string;
    message: string;
    source_url?: string | null;
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
    repack_prealert_valid: boolean;
    compactation_requested: boolean;
    hold_mode: HoldMode;
    hold_days: number;
    use_insurance: boolean;
    use_purchase_by_order: boolean;
    apply_provisional_customs: boolean;
    consolidated: boolean;
    consolidated_package_count: number;
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
    | "hold_days"
    | "consolidated_package_count";

type DecimalNumericField =
    | "declared_value_usd"
    | "total_weight_lb"
    | "total_weight_kg"
    | "total_volume_ft3"
    | "length_in"
    | "width_in"
    | "height_in";

type IntegerNumericField =
    | "total_same_item_qty"
    | "tracking_count"
    | "hold_days"
    | "consolidated_package_count";

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
    repack_prealert_valid: false,
    compactation_requested: false,
    hold_mode: "none",
    hold_days: 0,
    use_insurance: false,
    use_purchase_by_order: false,
    apply_provisional_customs: false,
    consolidated: false,
    consolidated_package_count: 2,
};

const EMPTY_BREAKDOWN: QuoteBreakdown = {
    freight_usd: 0,
    freight_ves: 0,
    protection_usd: 0,
    protection_ves: 0,
    consolidation_usd: 0,
    consolidation_ves: 0,
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
    sea_freight_volume_ft3: 0,
    storage_chargeable_ft3: 0,
    storage_charge_min_ft3: 0,
    storage_fee_usd_per_day_ft3: 0,
    storage_fee_ves_per_day_ft3: 0,
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
    if (mode === "general") return "Hold normal";
    if (mode === "repack") return "Prealerta repack válida";
    return "Sin hold";
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
        <div className={`rounded-3xl border p-4 sm:p-5 lg:p-6 shadow-sm ${accentClasses} min-w-0 break-words`}>
            <p className={`text-xs sm:text-sm ${titleClasses}`}>{title}</p>
            <p className="mt-1 sm:mt-2 text-2xl sm:text-3xl font-black tracking-tight">{value}</p>
            {subtitle ? (
                <p className={`mt-1 sm:mt-2 text-[10px] sm:text-xs ${subtitleClasses}`}>{subtitle}</p>
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

function HelpTooltip({
    text,
    label = "Ver ayuda",
    align = "start",
}: {
    text: string;
    label?: string;
    align?: "start" | "center" | "end";
}) {
    const positionClasses =
        align === "end"
            ? "right-0 origin-top-right"
            : align === "center"
                ? "left-1/2 -translate-x-1/2 origin-top"
                : "left-0 origin-top-left";

    return (
        <span className="group/help relative inline-flex items-center">
            <button
                type="button"
                aria-label={label}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 bg-white text-[11px] font-black leading-none text-slate-500 shadow-sm transition hover:border-slate-500 hover:text-slate-900 focus:border-slate-900 focus:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
            >
                <span aria-hidden="true">?</span>
            </button>
            <span
                role="tooltip"
                className={`pointer-events-none absolute top-full z-30 mt-2 w-44 max-w-[calc(100vw-3rem)] rounded-2xl border border-slate-200 bg-white p-3 text-left text-xs font-medium leading-5 text-slate-700 opacity-0 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5 transition duration-200 ease-out translate-y-1 scale-95 group-hover/help:translate-y-0 group-hover/help:scale-100 group-hover/help:opacity-100 group-focus-within/help:translate-y-0 group-focus-within/help:scale-100 group-focus-within/help:opacity-100 ${positionClasses}`}
            >
                {text}
            </span>
        </span>
    );
}

function FieldHelpLabel({
    children,
    help,
}: {
    children: string;
    help: string;
}) {
    return (
        <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <span>{children}</span>
            <HelpTooltip text={help} label={`Ayuda sobre ${children}`} align="center" />
        </span>
    );
}

function OptionCard({
    title,
    description,
    help,
    helpAlign = "center",
    checked,
    onChange,
    disabled = false,
}: {
    title: string;
    description: string;
    help: string;
    helpAlign?: "start" | "center" | "end";
    checked: boolean;
    onChange: (checked: boolean) => void;
    disabled?: boolean;
}) {
    const inputId = useId();

    return (
        <div
            className={`flex items-start gap-2.5 sm:gap-3 rounded-2xl border p-3.5 sm:p-4 transition ${disabled
                    ? "cursor-not-allowed border-slate-200 bg-slate-100 opacity-75"
                    : checked
                        ? "cursor-pointer border-slate-900 bg-slate-50"
                        : "cursor-pointer border-slate-200 bg-white hover:border-slate-300"
                }`}
        >
            <input
                id={inputId}
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300"
                checked={checked}
                disabled={disabled}
                onChange={(e) => onChange(e.target.checked)}
            />
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <label
                        htmlFor={inputId}
                        className={`text-sm font-semibold text-slate-900 truncate ${disabled ? "cursor-not-allowed" : "cursor-pointer"
                            }`}
                    >
                        {title}
                    </label>
                    <HelpTooltip text={help} label={`Ayuda sobre ${title}`} align={helpAlign} />
                </div>
                <p className="mt-1 text-[11px] sm:text-xs leading-5 sm:leading-6 text-slate-500 line-clamp-3 sm:line-clamp-none">{description}</p>
            </div>
        </div>
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
        <div className="grid grid-cols-[1.1fr_0.7fr_0.7fr] gap-2 sm:gap-3 border-b border-slate-200 py-2 sm:py-3 text-[13px] sm:text-sm min-w-0">
            <div className="flex items-center min-w-0">
                <span
                    className={`inline-flex rounded-full px-2 py-0.5 sm:px-2.5 sm:py-1 text-[10px] sm:text-xs font-semibold truncate ${toneClasses(
                        tone,
                        active
                    )}`}
                >
                    {label}
                </span>
            </div>
            <div
                className={`text-right truncate ${active ? "font-semibold text-slate-800" : "text-slate-500"
                    }`}
            >
                {formatMoneyBs(ves, 0)}
            </div>
            <div
                className={`text-right truncate ${active ? "font-semibold text-slate-800" : "text-slate-500"
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
                sea_freight_volume_ft3: safeNumber(rawMetrics.sea_freight_volume_ft3),
                storage_chargeable_ft3: safeNumber(
                    rawMetrics.storage_chargeable_ft3
                ),
                storage_charge_min_ft3: safeNumber(
                    rawMetrics.storage_charge_min_ft3
                ),
                storage_fee_usd_per_day_ft3: safeNumber(
                    rawMetrics.storage_fee_usd_per_day_ft3
                ),
                storage_fee_ves_per_day_ft3: safeNumber(
                    rawMetrics.storage_fee_ves_per_day_ft3
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
                protection_usd: safeNumber(breakdown.protection_usd),
                protection_ves: safeNumber(breakdown.protection_ves),
                consolidation_usd: safeNumber(breakdown.consolidation_usd),
                consolidation_ves: safeNumber(breakdown.consolidation_ves),
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

function booleanFlag(value: string | number | boolean | undefined, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") return value.toLowerCase() === "true";
    return fallback;
}

export default function Home() {
    const [form, setForm] = useState<FormState>(initialForm);
    const [viewMode, setViewMode] = useState<"simple" | "advanced">("simple");
    const [chargesOpen, setChargesOpen] = useState(false);
    const [result, setResult] = useState<QuoteResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [saveLoading, setSaveLoading] = useState(false);
    const [error, setError] = useState("");
    const [saveError, setSaveError] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const [savedQuote, setSavedQuote] = useState<QuoteSaveResponse | null>(null);
    const [rawResponse, setRawResponse] = useState("");
    const [lastQuoteSnapshot, setLastQuoteSnapshot] = useState<string | null>(null);
    const [numericDrafts, setNumericDrafts] = useState<
        Partial<Record<NumericField, string>>
    >({});

    const [bcvRate, setBcvRate] = useState<number | null>(null);
    const [bcvLoading, setBcvLoading] = useState(true);

    const [owcRules, setOwcRules] = useState<OwcRulesResponse | null>(null);
    const [owcRulesLoading, setOwcRulesLoading] = useState(false);
    const [owcRefreshing, setOwcRefreshing] = useState(false);
    const [owcMessage, setOwcMessage] = useState("");
    const [owcItemQuery, setOwcItemQuery] = useState("");
    const [owcRestrictedItems, setOwcRestrictedItems] =
        useState<OwcRestrictedItemsResponse | null>(null);
    const [owcRestrictedLoading, setOwcRestrictedLoading] = useState(false);
    const [owcRestrictedError, setOwcRestrictedError] = useState("");

    const isZoom = form.courier_code === "zoom";
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
            : form.hold_mode;

    const effectiveServiceType: ServiceType =
        form.courier_code === "zoom" && form.service_type === "sea"
            ? "air"
            : form.service_type;

    const canQuote =
        form.courier_code !== "" && effectiveServiceType !== "";

    async function loadExchangeRate(signal?: AbortSignal) {
        try {
            setBcvLoading(true);

            let res = await fetch(
                `${API_BASE}/exchange-rate/latest?refresh_if_stale=true`,
                { signal }
            );

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
            const res = await fetch(
                `${API_BASE}/courier-rules/owc?region=${region}&refresh_if_stale=true`,
                { signal }
            );

            if (!res.ok) {
                throw new Error("No se pudo cargar el tarifario OWC del sistema");
            }

            const data = await res.json();
            setOwcRules(data as OwcRulesResponse);

            const freshnessMessage =
                typeof data?.freshness?.message === "string"
                    ? data.freshness.message
                    : "Tarifario OWC cargado correctamente.";

            setOwcMessage(freshnessMessage);
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
                throw new Error(
                    data?.detail ?? "No se pudieron actualizar las tarifas OWC"
                );
            }

            setOwcMessage("Tarifario OWC actualizado correctamente.");
            await loadOwcRules(form.region);
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Error al actualizar las tarifas OWC";
            setOwcMessage(message);
        } finally {
            setOwcRefreshing(false);
        }
    }

    useEffect(() => {
        const controller = new AbortController();

        const timeoutId = window.setTimeout(() => {
            void loadExchangeRate(controller.signal);
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();

        const timeoutId = window.setTimeout(() => {
            if (form.courier_code !== "owc") {
                setOwcRules(null);
                setOwcMessage("");
                return;
            }

            void loadOwcRules(form.region, controller.signal);
        }, 0);

        return () => {
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, [form.courier_code, form.region]);

    useEffect(() => {
        const controller = new AbortController();
        const cleanQuery = form.courier_code === "owc" ? owcItemQuery.trim() : "";

        const timeoutId = window.setTimeout(async () => {
            if (!cleanQuery) {
                setOwcRestrictedItems(null);
                setOwcRestrictedError("");
                setOwcRestrictedLoading(false);
                return;
            }

            try {
                setOwcRestrictedLoading(true);
                setOwcRestrictedError("");

                const res = await fetch(
                    `${API_BASE}/couriers/owc/restricted-items?q=${encodeURIComponent(
                        cleanQuery
                    )}`,
                    { signal: controller.signal }
                );

                const data = await res.json();

                if (!res.ok) {
                    throw new Error(
                        typeof data?.detail === "string"
                            ? data.detail
                            : "No se pudo verificar el artículo en OWC."
                    );
                }

                setOwcRestrictedItems(data as OwcRestrictedItemsResponse);
            } catch (err) {
                if ((err as Error).name !== "AbortError") {
                    setOwcRestrictedItems(null);
                    setOwcRestrictedError(
                        err instanceof Error
                            ? err.message
                            : "Error verificando artículos OWC."
                    );
                }
            } finally {
                setOwcRestrictedLoading(false);
            }
        }, cleanQuery ? 450 : 0);

        return () => {
            window.clearTimeout(timeoutId);
            controller.abort();
        };
    }, [form.courier_code, owcItemQuery]);
    function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm((prev) => {
            const next = {
                ...prev,
                [key]: value,
            };

            if (key === "hold_mode" && value !== "repack") {
                next.repack_prealert_valid = false;
            }

            return next;
        });
    }

    function setNumberField(key: NumericField, value: string) {
        const numeric = value.trim() === "" ? 0 : Number(value);

        setForm((prev) => ({
            ...prev,
            [key]: Number.isNaN(numeric) ? 0 : numeric,
        }));
    }

    function getNumericInputValue(key: NumericField) {
        return numericDrafts[key] ?? String(form[key]);
    }

    function sanitizeDecimalInput(value: string) {
        const normalized = value.replace(/,/g, ".");
        let output = "";
        let hasPoint = false;

        for (const char of normalized) {
            if (char >= "0" && char <= "9") {
                output += char;
            } else if (char === "." && !hasPoint) {
                output += char;
                hasPoint = true;
            }
        }

        return output.replace(/^0+(?=\d)/, "");
    }

    function formatDecimalDraftForBlur(value: string) {
        if (value === "" || value === ".") return "0";
        if (value.startsWith(".")) return `0${value}`;
        if (value.endsWith(".")) return value.slice(0, -1) || "0";
        return value.replace(/^0+(?=\d)/, "");
    }

    function handleDecimalFieldChange(key: DecimalNumericField, value: string) {
        const sanitized = sanitizeDecimalInput(value);

        setNumericDrafts((prev) => ({
            ...prev,
            [key]: sanitized,
        }));

        if (sanitized !== "" && sanitized !== ".") {
            setNumberField(key, sanitized);
        }
    }

    function handleDecimalFieldBlur(key: DecimalNumericField, value: string) {
        const normalized = formatDecimalDraftForBlur(sanitizeDecimalInput(value));
        setNumberField(key, normalized);
        setNumericDrafts((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }

    function handleIntegerFieldChange(key: IntegerNumericField, value: string) {
        const sanitized = value.replace(/\D/g, "");
        setNumericDrafts((prev) => ({
            ...prev,
            [key]: sanitized,
        }));

        if (sanitized !== "") {
            setNumberField(key, sanitized);
        }
    }

    function handleIntegerFieldBlur(
        key: IntegerNumericField,
        minValue: number,
        value: string
    ) {
        const sanitized = value.replace(/\D/g, "");
        const numeric = sanitized === "" ? minValue : Math.max(Number(sanitized), minValue);
        setNumberField(key, String(numeric));
        setNumericDrafts((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }

    function selectZeroDraftOnFocus(event: FocusEvent<HTMLInputElement>) {
        if (event.currentTarget.value === "0") {
            event.currentTarget.select();
        }
    }

    const visibleMetrics = useMemo(() => {
        if (!result) return null;

        const metrics = result.quote?.raw_metrics ?? EMPTY_RAW_METRICS;
        const breakdown = result.quote?.breakdown ?? EMPTY_BREAKDOWN;

        return {
            pesoFinal: safeNumber(result.quote?.chargeable_units_display),
            pieCubicoVisible: safeNumber(metrics.display_volume_ft3),
            volumenReal: safeNumber(metrics.raw_volume_ft3),
            baseFleteMaritimo: safeNumber(metrics.sea_freight_volume_ft3),
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
            ...(isZoom
                ? {
                    service_type: "air",
                    delivery_type: "office",
                    region: "region_central",
                    total_weight_lb: 0,
                    total_volume_ft3: 0,
                    length_in: 0,
                    width_in: 0,
                    height_in: 0,
                    enable_handling_fee: false,
                    enable_repack_fee: false,
                    repack_prealert_valid: false,
                    compactation_requested: false,
                    hold_mode: "none",
                    hold_days: 0,
                    use_insurance: false,
                    use_purchase_by_order: false,
                    apply_provisional_customs: false,
                    zoom_service: "international_locker",
                    origin_country: "US",
                    destination_country: "VE",
                    shipment_kind: "merchandise",
                    use_protection: true,
                    consolidated: form.consolidated,
                    consolidated_package_count: form.consolidated
                        ? form.consolidated_package_count
                        : 1,
                }
                : {}),
        };
    }

    function buildQuoteSnapshot() {
        return JSON.stringify({
            courier_code: form.courier_code,
            service_type: effectiveServiceType,
            region: form.region,
            delivery_type: form.delivery_type,
            declared_value_usd: form.declared_value_usd,
            total_weight_lb: form.total_weight_lb,
            total_weight_kg: form.total_weight_kg,
            length_in: form.length_in,
            width_in: form.width_in,
            height_in: form.height_in,
            tracking_count: form.tracking_count,
            total_same_item_qty: form.total_same_item_qty,
            enable_handling_fee: form.enable_handling_fee,
            enable_repack_fee: form.enable_repack_fee,
            enable_insurance: form.use_insurance,
            enable_purchase_by_order: form.use_purchase_by_order,
            enable_taxes: effectiveApplyProvisionalCustoms,
            enable_compaction: form.compactation_requested,
            hold_mode: effectiveHoldMode,
            hold_days: form.hold_days,
            repack_prealert_valid: form.repack_prealert_valid,
        });
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setLoading(true);
        setError("");
        setSaveError("");
        setSaveMessage("");

        try {
            const payload = buildQuotePayload();
            const quoteSnapshot = buildQuoteSnapshot();

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
            setLastQuoteSnapshot(quoteSnapshot);
            setRawResponse(JSON.stringify(data, null, 2));
        } catch (err) {
            const message =
                err instanceof Error ? err.message : "Ocurrió un error inesperado";
            setError(message);
            setResult(null);
            setLastQuoteSnapshot(null);
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
            const quoteSnapshot = buildQuoteSnapshot();

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
            setLastQuoteSnapshot(quoteSnapshot);
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

    const repackNotice = result
        ? (() => {
            const flags = result.quote.flags;
            const serviceType = result.service_type;
            const repackMinAirLb = safeNumber(flags.repack_min_air_lb) || 5;
            const repackMinSeaFt3 = safeNumber(flags.repack_min_sea_ft3) || 3;
            const chargeableDisplay = result.quote.chargeable_units_display;
            const displayVolumeFt3 = result.quote.raw_metrics.display_volume_ft3;
            const fallbackEligible =
                serviceType === "air"
                    ? chargeableDisplay >= repackMinAirLb
                    : displayVolumeFt3 >= repackMinSeaFt3;
            const repackEligible = booleanFlag(flags.repack_eligible, fallbackEligible);
            const repackFeeApplied = booleanFlag(
                flags.repack_fee_applied,
                booleanFlag(flags.repack_applies)
            );

            if (repackFeeApplied) {
                return {
                    tone: "success" as const,
                    title: "Repack aplicado",
                    message: "Cargo fijo estimado: $5,00.",
                };
            }

            if (repackEligible) {
                return {
                    tone: "success" as const,
                    title: "Repack disponible",
                    message:
                        serviceType === "air"
                            ? "Esta cotización cumple el mínimo aéreo de 5 lb. Puedes activar Repack fee si necesitas reempaque."
                            : "Esta cotización cumple el mínimo marítimo de 3 ft³. Puedes activar Repack fee si necesitas reempaque.",
                };
            }

            return {
                tone: "warning" as const,
                title: "Aviso sobre repack",
                message:
                    serviceType === "air"
                        ? "Repack no aplica todavía en aéreo. Mínimo comercial: 5 lb."
                        : "Repack no aplica todavía en marítimo. Mínimo comercial: 3 ft³.",
            };
        })()
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
            ["Flags", "Prealerta repack válida", form.repack_prealert_valid, ""],
            ["Flags", "Compactación", form.compactation_requested, ""],
            ["Flags", "Modo storage/hold", holdModeLabel(effectiveHoldMode), ""],
            ["Flags", "Días en hold", form.hold_days, ""],
            ["Flags", "Seguro 5%", form.use_insurance, ""],
            ["Flags", "Purchase by order", form.use_purchase_by_order, ""],
            ["Flags", "Impuesto provisional", effectiveApplyProvisionalCustoms, ""],

            ["Métricas", "Peso final", result.quote.chargeable_units_display, result.quote.charge_unit],
            ["Métricas", "Peso cobrable exacto", result.quote.chargeable_units_exact, result.quote.charge_unit],
            ["Métricas", "Volumen visible ft³", metrics.display_volume_ft3, ""],
            ["Métricas", "Volumen real ft³", metrics.raw_volume_ft3, ""],
            ["Métricas", "Base flete marítimo ft³", metrics.sea_freight_volume_ft3 ?? "", ""],
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
            effectiveServiceType === "sea" ? `Base flete marítimo: ${formatNumber(metrics.sea_freight_volume_ft3 ?? 0, 2, 2)} ft³` : null,
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
    const resultFlags = result?.quote?.flags ?? {};
    const resultHoldMode = String(
        resultFlags.hold_mode ?? effectiveHoldMode
    ) as HoldMode;
    const storageExemptionApplied = booleanFlag(
        resultFlags.storage_exemption_applied
    );
    const technicalHoldModeLabel = (() => {
        if (resultHoldMode === "repack" && storageExemptionApplied) {
            return "Prealerta repack válida: storage exonerado";
        }

        if (resultHoldMode === "repack") {
            return "Prealerta no confirmada: tratado como Hold normal";
        }

        if (resultHoldMode === "general") return "Hold normal";
        return "Sin hold";
    })();
    const resultIsStale =
        Boolean(result) &&
        lastQuoteSnapshot !== null &&
        lastQuoteSnapshot !== buildQuoteSnapshot();
    const storageFeeCurrency = String(
        resultFlags.storage_fee_currency ?? "VES"
    ).toUpperCase();
    const storageFeeUsd = safeNumber(
        resultFlags.storage_fee_usd_per_day_ft3 ??
        resultMetrics.storage_fee_usd_per_day_ft3
    );
    const storageFeeVes = safeNumber(
        resultFlags.storage_fee_ves_per_day_ft3 ??
        resultMetrics.storage_fee_ves_per_day_ft3
    );
    const storageFormula = result
        ? {
            holdDays: safeNumber(resultFlags.hold_days, form.hold_days),
            freeDays: safeNumber(resultFlags.general_hold_free_business_days, 3),
            chargedDays: safeNumber(resultFlags.storage_days_charged),
            baseFt3: safeNumber(resultMetrics.storage_chargeable_ft3),
            minFt3: safeNumber(resultFlags.storage_charge_min_ft3, safeNumber(resultMetrics.storage_charge_min_ft3)),
            rateLabel:
                storageFeeCurrency === "USD"
                    ? `${formatMoneyUsd(storageFeeUsd, 2)}/ft³/día`
                    : `${formatMoneyBs(storageFeeVes, 2)}/ft³/día`,
            exchangeRate: safeNumber(result.quote.exchange_rate_used, result.exchange_rate_used),
            totalVes: safeNumber(resultBreakdown.storage_ves),
            totalUsd: safeNumber(resultBreakdown.storage_usd),
            exemptionApplied: storageExemptionApplied,
        }
        : null;
    const showStorageFormula = Boolean(
        storageFormula && (storageFormula.holdDays > 0 || storageFormula.totalVes > 0)
    );
    const storageStatusNotice = (() => {
        const holdDays = safeNumber(form.hold_days);
        const freeDays = storageFormula?.freeDays ?? 3;
        const chargedDays = Math.max(holdDays - freeDays, 0);

        if (effectiveHoldMode === "repack" && form.repack_prealert_valid) {
            return {
                tone: "success" as const,
                title: "Storage exonerado por prealerta repack válida",
                message:
                    "La exoneración se estima porque confirmaste que la prealerta de reempaque fue emitida correctamente y a tiempo.",
            };
        }

        if (effectiveHoldMode === "repack") {
            return {
                tone: "warning" as const,
                title: "Prealerta repack no confirmada",
                message:
                    "No se debe exonerar storage automáticamente. Si el reempaque se solicitó después de la llegada a Miami, OWC puede cobrar storage después de los 3 días hábiles libres.",
            };
        }

        if (effectiveHoldMode === "general" && holdDays > freeDays) {
            return {
                tone: "warning" as const,
                title: "Storage aplicable",
                message: `Se estiman ${formatNumber(chargedDays, 0, 0)} días hábiles cobrables después de los 3 días hábiles libres. El monto depende de la base ft³, tarifa storage y tasa BCV.`,
            };
        }

        if (effectiveHoldMode === "general") {
            return {
                tone: "info" as const,
                title: "Hold dentro del plazo libre",
                message:
                    "OWC permite 3 días hábiles antes de estimar Storage Fee.",
            };
        }

        return {
            tone: "muted" as const,
            title: "Storage no estimado",
            message: "No hay días de hold activos. No se estima Storage Fee.",
        };
    })();
    const showRepackStorageWarning =
        booleanFlag(resultFlags.repack_fee_applied, form.enable_repack_fee) &&
        effectiveHoldMode === "general" &&
        safeNumber(form.hold_days) > 3;
    const showMissingRepackPrealertWarning =
        effectiveHoldMode === "repack" && !form.repack_prealert_valid;
    const showLongHoldNotice = safeNumber(form.hold_days) > 30;

    return (
        <main className="min-h-screen bg-slate-100 overflow-x-hidden">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-10">
                <div className="mb-6 sm:mb-8 relative overflow-hidden rounded-3xl sm:rounded-[2.5rem] border border-slate-200 bg-white px-5 py-6 md:px-10 md:py-12 shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
                    <div className="absolute -left-20 -top-20 h-96 w-96 rounded-full bg-blue-400/10 blur-3xl pointer-events-none"></div>
                    <div className="absolute -right-20 -bottom-20 h-96 w-96 rounded-full bg-emerald-400/10 blur-3xl pointer-events-none"></div>

                    <div className="relative mb-6 flex flex-wrap gap-2">
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] sm:text-xs font-semibold text-white shadow-sm">
                            Motor OWC / Zoom
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] sm:text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                            FastAPI + Next.js
                        </span>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] sm:text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                            Cálculo comercial
                        </span>
                    </div>

                    <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_270px] lg:items-end">
                        <div className="min-w-0">
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-950 drop-shadow-sm break-words">
                                Vzla Cargo Hub
                            </h1>

                            <p className="mt-3 sm:mt-4 max-w-3xl text-base sm:text-lg lg:text-xl leading-7 sm:leading-9 text-slate-700">
                                Calcula envíos con reglas reales del courier, peso final,
                                volumen visible y desglose detallado por tipo de cargo.
                            </p>

                            <div className="mt-6 flex flex-wrap gap-2">
                                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-blue-700 ring-1 ring-blue-200">
                                    Courier: {courierLabel(form.courier_code)}
                                </span>
                                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-indigo-700 ring-1 ring-indigo-200">
                                    Servicio: {serviceLabel(effectiveServiceType)}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                    Región: {regionLabel(form.region)}
                                </span>
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                                    Delivery: {deliveryLabel(form.delivery_type)}
                                </span>
                            </div>
                        </div>

                        <div className="lg:self-end lg:pb-3">
                            <div className="relative w-full overflow-hidden rounded-[1.75rem] sm:rounded-[2rem] bg-slate-900 px-5 py-4 sm:px-6 sm:py-5 text-white shadow-[0_10px_40px_rgba(15,23,42,0.4)] ring-1 ring-white/10">
                                <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-indigo-500/30 blur-2xl pointer-events-none"></div>
                                <div className="relative">
                                    <div className="text-[10px] sm:text-sm uppercase tracking-wide text-slate-300">
                                        Tasa BCV
                                    </div>

                                    {bcvLoading ? (
                                        <div className="mt-3 flex items-center gap-3">
                                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-white" />
                                            <span className="text-base font-semibold">Cargando...</span>
                                        </div>
                                    ) : (
                                        <div className="mt-1 sm:mt-2 text-3xl sm:text-4xl lg:text-5xl font-black drop-shadow-sm">
                                            {bcvRate !== null && bcvRate > 0 ? formatNumber(bcvRate, 4, 4) : "N/D"}
                                        </div>
                                    )}

                                    <div className="mt-1 sm:mt-2 text-[10px] sm:text-sm text-slate-400 font-medium">USD → VES</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid gap-6 sm:gap-8 lg:grid-cols-[1.03fr_0.97fr] lg:items-start">
                    <form
                        onSubmit={handleSubmit}
                        className="rounded-3xl sm:rounded-[2rem] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm"
                    >
                        <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
                            <div>
                                <h2 className="text-xl sm:text-2xl font-bold text-slate-950">
                                    Formulario de cotización
                                </h2>
                                <p className="mt-1 sm:mt-2 text-xs sm:text-sm leading-5 sm:leading-6 text-slate-600">
                                    Completa los datos del paquete para estimar el costo del envío.
                                </p>
                            </div>
                            <div className="relative flex shrink-0 rounded-full bg-slate-100 p-1 ring-1 ring-slate-200 isolate w-full sm:w-auto">
                                <div
                                    className={`absolute inset-y-1 w-[calc(50%-4px)] rounded-full bg-white shadow-sm transition-transform duration-300 ease-in-out ${
                                        viewMode === "simple" ? "translate-x-0" : "translate-x-[calc(100%+8px)]"
                                    }`}
                                />
                                <button
                                    type="button"
                                    onClick={() => {
                                        setViewMode("simple");
                                        setChargesOpen(false);
                                    }}
                                    className={`relative z-10 flex-1 sm:w-36 rounded-full py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-colors duration-300 ${
                                        viewMode === "simple" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    Modo simple
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setViewMode("advanced");
                                        setChargesOpen(true);
                                    }}
                                    className={`relative z-10 flex-1 sm:w-36 rounded-full py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition-colors duration-300 ${
                                        viewMode === "advanced" ? "text-slate-900" : "text-slate-500 hover:text-slate-700"
                                    }`}
                                >
                                    Modo avanzado
                                </button>
                            </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Courier</span>
                                <select
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
                                    value={form.courier_code}
                                    onChange={(e) => {
                                        const nextCourier = e.target.value as CourierCode;

                                        setForm((prev) => ({
                                            ...prev,
                                            courier_code: nextCourier,
                                            service_type:
                                                nextCourier === "zoom"
                                                    ? "air"
                                                    : prev.service_type,
                                            delivery_type:
                                                nextCourier === "zoom" ? "office" : prev.delivery_type,
                                            region:
                                                nextCourier === "zoom" ? "region_central" : prev.region,
                                        }));

                                        if (nextCourier !== "owc") {
                                            setOwcItemQuery("");
                                            setOwcRestrictedItems(null);
                                            setOwcRestrictedError("");
                                            setOwcRestrictedLoading(false);
                                        }
                                    }}
                                >
                                    <option value="">Selecciona un courier</option>
                                    <option value="owc">One Way Cargo</option>
                                    <option value="zoom">Zoom (beta)</option>
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">
                                    {isZoom ? "Servicio Zoom" : "Servicio"}
                                </span>
                                <select
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
                                    value={effectiveServiceType}
                                    onChange={(e) =>
                                        updateForm("service_type", e.target.value as ServiceType)
                                    }
                                    disabled={isZoom}
                                >
                                    <option value="">Selecciona un servicio</option>
                                    <option value="air">Aéreo</option>
                                    <option value="sea" disabled={form.courier_code === "zoom"}>
                                        Marítimo
                                    </option>
                                </select>
                            </label>

                            {!isZoom ? (
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
                            ) : null}

                            <label className="space-y-2">
                                {!isZoom ? (
                                    <FieldHelpLabel help="Esta opción indica cómo deseas recibir o gestionar la entrega en Venezuela. Por ahora es informativa en OWC si no aparece un cargo específico en el desglose. No debe confundirse con Pick Up en Miami, que es un servicio aparte.">
                                        Delivery type
                                    </FieldHelpLabel>
                                ) : (
                                    <span className="text-sm font-medium text-slate-700">
                                        Entrega
                                    </span>
                                )}
                                <select
                                    aria-label={isZoom ? "Entrega" : "Delivery type"}
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500 disabled:bg-slate-100 disabled:text-slate-500"
                                    value={form.delivery_type}
                                    disabled={isZoom}
                                    onChange={(e) =>
                                        updateForm("delivery_type", e.target.value as DeliveryType)
                                    }
                                >
                                    <option value="office">{isZoom ? "Oficina" : "Office"}</option>
                                    <option value="delivery">Delivery</option>
                                    <option value="home">Home</option>
                                </select>
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">
                                    Valor declarado USD
                                </span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={getNumericInputValue("declared_value_usd")}
                                    onFocus={selectZeroDraftOnFocus}
                                    onChange={(e) =>
                                        handleDecimalFieldChange(
                                            "declared_value_usd",
                                            e.target.value
                                        )
                                    }
                                    onBlur={(e) =>
                                        handleDecimalFieldBlur(
                                            "declared_value_usd",
                                            e.currentTarget.value
                                        )
                                    }
                                />
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">
                                    {isZoom ? "Peso fisico (kg)" : "Peso total (lb)"}
                                </span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={getNumericInputValue(
                                        isZoom ? "total_weight_kg" : "total_weight_lb"
                                    )}
                                    onFocus={selectZeroDraftOnFocus}
                                    onChange={(e) =>
                                        handleDecimalFieldChange(
                                            isZoom ? "total_weight_kg" : "total_weight_lb",
                                            e.target.value
                                        )
                                    }
                                    onBlur={(e) =>
                                        handleDecimalFieldBlur(
                                            isZoom ? "total_weight_kg" : "total_weight_lb",
                                            e.currentTarget.value
                                        )
                                    }
                                />
                            </label>

                            {isZoom ? (
                                <>
                                    <label className="space-y-2">
                                        <span className="text-sm font-medium text-slate-700">
                                            Consolidar encomiendas
                                        </span>
                                        <select
                                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                            value={form.consolidated ? "yes" : "no"}
                                            onChange={(e) =>
                                                updateForm("consolidated", e.target.value === "yes")
                                            }
                                        >
                                            <option value="no">No</option>
                                            <option value="yes">Si</option>
                                        </select>
                                    </label>

                                    {form.consolidated ? (
                                        <label className="space-y-2">
                                            <span className="text-sm font-medium text-slate-700">
                                                Cantidad de encomiendas
                                            </span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                                value={getNumericInputValue(
                                                    "consolidated_package_count"
                                                )}
                                                onFocus={selectZeroDraftOnFocus}
                                                onChange={(e) =>
                                                    handleIntegerFieldChange(
                                                        "consolidated_package_count",
                                                        e.target.value
                                                    )
                                                }
                                                onBlur={(e) =>
                                                    handleIntegerFieldBlur(
                                                        "consolidated_package_count",
                                                        2,
                                                        e.currentTarget.value
                                                    )
                                                }
                                            />
                                        </label>
                                    ) : null}
                                </>
                            ) : (
                            <>
                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Largo (in)</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={getNumericInputValue("length_in")}
                                    onFocus={selectZeroDraftOnFocus}
                                    onChange={(e) =>
                                        handleDecimalFieldChange("length_in", e.target.value)
                                    }
                                    onBlur={(e) =>
                                        handleDecimalFieldBlur("length_in", e.currentTarget.value)
                                    }
                                />
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Ancho (in)</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={getNumericInputValue("width_in")}
                                    onFocus={selectZeroDraftOnFocus}
                                    onChange={(e) =>
                                        handleDecimalFieldChange("width_in", e.target.value)
                                    }
                                    onBlur={(e) =>
                                        handleDecimalFieldBlur("width_in", e.currentTarget.value)
                                    }
                                />
                            </label>

                            <label className="space-y-2">
                                <span className="text-sm font-medium text-slate-700">Alto (in)</span>
                                <input
                                    type="text"
                                    inputMode="decimal"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={getNumericInputValue("height_in")}
                                    onFocus={selectZeroDraftOnFocus}
                                    onChange={(e) =>
                                        handleDecimalFieldChange("height_in", e.target.value)
                                    }
                                    onBlur={(e) =>
                                        handleDecimalFieldBlur("height_in", e.currentTarget.value)
                                    }
                                />
                            </label>

                            <label className="space-y-2">
                                <FieldHelpLabel help="Cantidad de paquetes, cajas o tracking numbers que entran al almacén de Miami. Algunos cargos como Handling Fee se aplican por tracking/caja. Storage también puede variar por paquete según el caso real de OWC.">
                                    Tracking count
                                </FieldHelpLabel>
                                <input
                                    aria-label="Tracking count"
                                    type="text"
                                    inputMode="numeric"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={getNumericInputValue("tracking_count")}
                                    onFocus={selectZeroDraftOnFocus}
                                    onChange={(e) =>
                                        handleIntegerFieldChange("tracking_count", e.target.value)
                                    }
                                    onBlur={(e) =>
                                        handleIntegerFieldBlur(
                                            "tracking_count",
                                            1,
                                            e.currentTarget.value
                                        )
                                    }
                                />
                            </label>

                            <label className="space-y-2 md:col-span-2">
                                <span className="text-sm font-medium text-slate-700">
                                    Cantidad total del mismo artículo
                                </span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                    value={getNumericInputValue("total_same_item_qty")}
                                    onFocus={selectZeroDraftOnFocus}
                                    onChange={(e) =>
                                        handleIntegerFieldChange(
                                            "total_same_item_qty",
                                            e.target.value
                                        )
                                    }
                                    onBlur={(e) =>
                                        handleIntegerFieldBlur(
                                            "total_same_item_qty",
                                            1,
                                            e.currentTarget.value
                                        )
                                    }
                                />
                            </label>
                            </>
                            )}
                        </div>

                        {form.courier_code === "owc" && (
                            <div className="mt-6 rounded-[2rem] border border-slate-200 bg-slate-50 p-5">
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <h3 className="text-xl font-black text-slate-950">
                                            Verificador de artículos OWC
                                        </h3>
                                        <p className="mt-2 text-sm leading-6 text-slate-700">
                                            Consulta si el artículo aparece como prohibido, restringido o bajo
                                            régimen especial según las reglas actuales de One Way Cargo.
                                        </p>
                                    </div>

                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-slate-950 text-center text-[11px] font-black leading-3 text-white">
                                        One
                                        <br />
                                        Way
                                        <br />
                                        Cargo
                                    </div>
                                </div>

                                <label className="mt-5 block text-sm font-medium text-slate-900">
                                    ¿Qué estás enviando?
                                </label>

                                <input
                                    value={owcItemQuery}
                                    onChange={(e) => setOwcItemQuery(e.target.value)}
                                    placeholder="Ej: celular, teléfono, laptop, jeans, perfume, pastillas..."
                                    className="mt-2 w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base outline-none transition focus:border-slate-900 focus:ring-4 focus:ring-slate-200"
                                />

                                {owcRestrictedLoading && (
                                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-600">
                                        Buscando en reglas OWC...
                                    </div>
                                )}

                                {owcRestrictedError && (
                                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                        {owcRestrictedError}
                                    </div>
                                )}

                                {!owcRestrictedLoading &&
                                    !owcRestrictedError &&
                                    owcItemQuery.trim() &&
                                    owcRestrictedItems && (
                                        <div className="mt-4 space-y-3">
                                            {owcRestrictedItems.matches.length > 0 ? (
                                                owcRestrictedItems.matches.map((item, index) => {
                                                    const level = String(item.restriction_level || "").toLowerCase();
                                                    const isProhibited = level.includes("prohibited") || item.action === "block";
                                                    const displayLevel = item.display_level ?? (isProhibited ? "Prohibido" : "Régimen especial");
                                                    const sourceUrl = item.source_url ?? owcRestrictedItems.source_url ?? "https://onewaycargo.net/articulos-prohibidos";

                                                    return (
                                                        <div
                                                            key={`${item.item_name}-${index}`}
                                                            className={`rounded-2xl border p-4 ${isProhibited
                                                                    ? "border-red-300 bg-red-50"
                                                                    : "border-amber-300 bg-amber-50"
                                                                }`}
                                                        >
                                                            <div className="flex flex-wrap items-start justify-between gap-3">
                                                                <div>
                                                                    <p className="font-black text-slate-950">
                                                                        {item.item_name}
                                                                    </p>

                                                                    <p className="mt-2 text-sm text-slate-800">
                                                                        <span className="font-bold">Razón:</span>{" "}
                                                                        {item.reason || item.category_label || "Regla especial OWC"}
                                                                    </p>

                                                                    {item.notes && (
                                                                        <p className="mt-1 text-sm text-slate-800">
                                                                            <span className="font-bold">Notas:</span>{" "}
                                                                            {item.notes}
                                                                        </p>
                                                                    )}
                                                                </div>

                                                                <span
                                                                    className={`rounded-full px-3 py-1 text-xs font-black ${isProhibited
                                                                            ? "bg-red-100 text-red-700 ring-1 ring-red-300"
                                                                            : "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                                                                        }`}
                                                                >
                                                                    {displayLevel}
                                                                </span>
                                                            </div>

                                                            <p className="mt-3 text-sm leading-6 text-slate-700">
                                                                {item.user_message ||
                                                                    (isProhibited
                                                                        ? "Este artículo aparece como no permitido por OWC. No se recomienda enviarlo sin confirmación oficial del courier."
                                                                        : "Este artículo puede requerir validación previa. Consulta con OWC antes de enviarlo, especialmente si son varias unidades, alto valor o uso comercial.")}
                                                            </p>

                                                            {item.recommendation ? (
                                                                <p className="mt-2 text-sm leading-6 text-slate-700">
                                                                    <span className="font-bold">Recomendación:</span>{" "}
                                                                    {item.recommendation}
                                                                </p>
                                                            ) : null}

                                                            {item.examples?.length ? (
                                                                <p className="mt-2 text-xs leading-6 text-slate-600">
                                                                    Ejemplos relacionados: {item.examples.join(", ")}
                                                                </p>
                                                            ) : null}

                                                            <a
                                                                href={sourceUrl}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="mt-3 inline-flex text-sm font-black text-slate-900 underline decoration-slate-300 underline-offset-4"
                                                            >
                                                                Ver fuente OWC
                                                            </a>
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900">
                                                    <p className="font-black">
                                                        Sin coincidencias en reglas OWC actuales
                                                    </p>
                                                    <p className="mt-1">
                                                        No se encontraron restricciones para “{owcItemQuery}”.
                                                        Esto no garantiza que esté permitido; verifica manualmente si tienes dudas.
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                            </div>
                        )}

                        {!isZoom ? (
                        <details 
                            open={chargesOpen} 
                            onToggle={(e) => setChargesOpen(e.currentTarget.open)}
                            className="group mt-6 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5 transition-all"
                        >
                            <summary className="cursor-pointer outline-none">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-slate-900">Cargos y servicios adicionales</h3>
                                    <span className="transition-transform group-open:rotate-180 text-slate-500">▼</span>
                                </div>
                                <div className="mt-1 text-sm text-slate-500 group-open:hidden">
                                    Handling, repack, seguro, storage y otros cargos opcionales.
                                    {(form.enable_handling_fee || form.enable_repack_fee || Number(form.hold_days) > 0 || form.use_insurance || form.use_purchase_by_order) ? (
                                        <span className="ml-1 font-semibold text-blue-600">Hay cargos activos en esta cotización.</span>
                                    ) : null}
                                </div>
                            </summary>

                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <p className="text-sm leading-7 text-slate-600">
                                    Activa solo las opciones que apliquen a esta cotización. Estas
                                    opciones simulan cargos o servicios adicionales como handling,
                                    reempaque, almacenaje, seguro o compra por encargo.
                                </p>

                                <div className="mt-5 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
                                <OptionCard
                                    title="Handling fee"
                                    description="Cargo operativo por guía o tracking recibido."
                                    help="OWC cobra Handling Fee por cada caja/tracking que ingresa a su almacén de Miami. Si tienes 2 tracking numbers, el cargo puede aplicarse 2 veces."
                                    helpAlign="center"
                                    checked={form.enable_handling_fee}
                                    onChange={(checked) => updateForm("enable_handling_fee", checked)}
                                />

                                <OptionCard
                                    title="Repack fee"
                                    description="Servicio de reempaque cuando OWC lo requiere."
                                    help="Repack Fee cobra el servicio de reempaque. Es un cargo fijo estimado de $5,00 y aplica desde 5 lb en aéreo o 3 ft³ en marítimo. No exonera storage por sí solo; la exoneración corresponde al modo “Prealerta de reempaque válida”."
                                    helpAlign="end"
                                    checked={form.enable_repack_fee}
                                    onChange={(checked) => updateForm("enable_repack_fee", checked)}
                                />

                                <OptionCard
                                    title="Seguro 5%"
                                    description="Protección opcional basada en el monto asegurado."
                                    help="OWC recomienda asegurar la carga pagando 5% del monto que deseas asegurar. Por defecto esta app usa el valor declarado como referencia. Debe solicitarse antes de que la carga sea entregada a la aerolínea o naviera."
                                    helpAlign="center"
                                    checked={form.use_insurance}
                                    onChange={(checked) => updateForm("use_insurance", checked)}
                                />

                                <OptionCard
                                    title="Purchase by order"
                                    description="Servicio de compra por encargo."
                                    help="Servicio tipo Personal Shopper. Según OWC, puede tener tarifa mínima de $20 para compras simples o desde $30 / 10% del monto facturado según el caso. Esta opción es una estimación y puede requerir validación con asesor."
                                    helpAlign="end"
                                    checked={form.use_purchase_by_order}
                                    onChange={(checked) => updateForm("use_purchase_by_order", checked)}
                                />

                                <OptionCard
                                    title="Impuesto provisional"
                                    description="Se sugiere automáticamente según valor o cantidad."
                                    help="La app lo sugiere si el valor declarado supera USD 200 o si hay 4 o más unidades del mismo artículo. Es una alerta preventiva; el tratamiento final puede depender del courier y revisión aduanal."
                                    helpAlign="center"
                                    checked={effectiveApplyProvisionalCustoms}
                                    disabled={provisionalCustomsSuggested}
                                    onChange={(checked) =>
                                        updateForm("apply_provisional_customs", checked)
                                    }
                                />

                                <OptionCard
                                    title="Compactación"
                                    description="Solicitud sin costo para revisar excedente volumétrico."
                                    help="La compactación no une paquetes y no está garantizada. OWC indica que es una solicitud de revisión sin costo para intentar reducir excedente volumétrico. Debe prealertarse antes de que el paquete sea registrado en Miami. No debe reducir el cálculo automáticamente si no hay dimensiones compactadas confirmadas."
                                    helpAlign="end"
                                    checked={form.compactation_requested}
                                    onChange={(checked) =>
                                        updateForm("compactation_requested", checked)
                                    }
                                />
                            </div>

                            <div className="mt-5 grid gap-4 grid-cols-1 sm:grid-cols-2">
                                <label className="space-y-2">
                                    <FieldHelpLabel help="Hold mode solo afecta storage. General representa hold normal con storage después de 3 días. Repack representa una prealerta válida de reempaque con storage exonerado. No decide si se cobra Repack Fee.">
                                        Modo de storage / hold
                                    </FieldHelpLabel>
                                    <select
                                        aria-label="Modo de storage / hold"
                                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                        value={effectiveHoldMode}
                                        onChange={(e) =>
                                            updateForm("hold_mode", e.target.value as HoldMode)
                                        }
                                    >
                                        <option value="none">Sin hold</option>
                                        <option value="general">Hold normal</option>
                                        <option value="repack">Prealerta repack válida</option>
                                    </select>
                                </label>

                                <label className="space-y-2">
                                    <FieldHelpLabel help="OWC indica que el hold está vigente por 3 días hábiles. Después de ese plazo, puede generar Storage Fee por día y por pie cúbico. Storage Fee es estimado. OWC puede ajustarlo o eliminarlo si el hold fue causado por error operativo o revisión del asesor.">
                                        Días en hold
                                    </FieldHelpLabel>
                                    <input
                                        aria-label="Días en hold"
                                        type="text"
                                        inputMode="numeric"
                                        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-500"
                                        value={getNumericInputValue("hold_days")}
                                        onFocus={selectZeroDraftOnFocus}
                                        onChange={(e) =>
                                            handleIntegerFieldChange("hold_days", e.target.value)
                                        }
                                        onBlur={(e) =>
                                            handleIntegerFieldBlur(
                                                "hold_days",
                                                0,
                                                e.currentTarget.value
                                            )
                                        }
                                    />
                                </label>
                            </div>

                            {effectiveHoldMode === "repack" ? (
                                <label className="mt-4 flex items-start gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 text-sm text-cyan-950 transition">
                                    <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 rounded border-slate-300"
                                        checked={form.repack_prealert_valid}
                                        onChange={(e) =>
                                            updateForm("repack_prealert_valid", e.target.checked)
                                        }
                                    />
                                    <span>
                                        <span className="block font-semibold">
                                            Prealerta de reempaque emitida a tiempo
                                        </span>
                                        <span className="mt-1 block leading-6">
                                            Confirma que la prealerta de reempaque fue creada
                                            antes de que la carga fuera recibida en Miami.
                                        </span>
                                    </span>
                                </label>
                            ) : null}

                            <div className="mt-5 flex flex-col gap-3">
                                <div
                                    className={`rounded-2xl border px-4 py-3 text-sm ${storageStatusNotice.tone === "success"
                                            ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                            : storageStatusNotice.tone === "warning"
                                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                                : storageStatusNotice.tone === "info"
                                                    ? "border-cyan-200 bg-cyan-50 text-cyan-900"
                                                    : "border-slate-200 bg-white text-slate-700"
                                        }`}
                                >
                                    <p className="font-semibold">{storageStatusNotice.title}</p>
                                    <p className="mt-1 leading-relaxed opacity-90">{storageStatusNotice.message}</p>
                                </div>

                                {showMissingRepackPrealertWarning ? (
                                    <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                                        <p className="font-semibold">
                                            Falta confirmar prealerta válida
                                        </p>
                                        <p className="mt-1 leading-relaxed opacity-90">
                                            Para exonerar storage, debes confirmar que la prealerta
                                            de reempaque fue emitida antes de que el paquete fuera
                                            recibido en Miami. Si el reempaque se solicitó después,
                                            usa Hold normal.
                                        </p>
                                    </div>
                                ) : null}

                                {showRepackStorageWarning ? (
                                    <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-900">
                                        <p className="font-semibold">
                                            Repack aplicado, pero storage puede aplicar
                                        </p>
                                        <p className="mt-1 leading-relaxed opacity-90">
                                            Repack Fee es un cargo separado. Si el hold es general,
                                            OWC puede cobrar Storage Fee después de los 3 días libres.
                                        </p>
                                    </div>
                                ) : null}

                                {showLongHoldNotice ? (
                                    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                                        <p className="font-semibold text-slate-900">
                                            Hold prolongado
                                        </p>
                                        <p className="mt-1 leading-relaxed opacity-90">
                                            Un hold prolongado puede requerir revisión manual con
                                            asesor. Esta app solo estima según reglas cargadas.
                                        </p>
                                    </div>
                                ) : null}

                                <details className="group rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                    <summary className="cursor-pointer font-semibold outline-none flex items-center justify-between">
                                        <span>Reglas automáticas activas</span>
                                        <span className="transition-transform group-open:rotate-180">▼</span>
                                    </summary>
                                    <div className="mt-2 pt-2 border-t border-amber-200/50">
                                        <p className="mb-2 font-medium">Impuestos, repack y storage se sugieren según las condiciones de la cotización.</p>
                                        <p className="leading-relaxed opacity-90">
                                            El impuesto provisional se sugiere automáticamente si el valor
                                            declarado supera USD 200 o si hay 4 o más unidades del mismo
                                            artículo. Repack fee es un cargo/servicio separado. El hold
                                            mode <strong>repack</strong> solo exonera storage por prealerta
                                            válida; no decide si se cobra Repack Fee.
                                        </p>
                                    </div>
                                </details>
                            </div>
                            </div>
                        </details>
                        ) : null}

                        {repackNotice ? (
                            <div
                                className={`mt-4 rounded-2xl px-4 py-3 text-sm ${repackNotice.tone === "success"
                                        ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                                        : "border border-violet-200 bg-violet-50 text-violet-900"
                                    }`}
                            >
                                <p className="font-semibold">{repackNotice.title}</p>
                                <p className="mt-1 leading-relaxed opacity-90">{repackNotice.message}</p>
                            </div>
                        ) : null}

                        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <button
                                type="submit"
                                disabled={loading || saveLoading || !canQuote}
                                className="group relative inline-flex w-full overflow-hidden items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-lg font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60 shadow-[0_4px_15px_rgba(15,23,42,0.2)] hover:shadow-[0_4px_20px_rgba(15,23,42,0.3)]"
                            >
                                <span className="absolute inset-0 flex h-full w-full justify-center [transform:skew(-12deg)_translateX(-150%)] group-hover:duration-1000 group-hover:[transform:skew(-12deg)_translateX(150%)]"><span className="relative h-full w-8 bg-white/20"></span></span>
                                <span className="relative">{loading ? "Calculando..." : "Calcular"}</span>
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

                    <section className="flex flex-col gap-6 sm:gap-8 lg:sticky lg:top-8 pb-10">
                        {form.courier_code === "owc" ? (
                            <div className="order-3 lg:order-1 rounded-3xl sm:rounded-[2rem] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                                <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-bold text-slate-950">
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

                        <div className="order-1 lg:order-2 rounded-3xl sm:rounded-[2rem] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                            <div className="mb-4 sm:mb-5">
                                <h2 className="text-xl sm:text-2xl font-bold text-slate-950">Resultado</h2>
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

                            {resultIsStale ? (
                                <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                    <p className="font-semibold">
                                        Cotización pendiente de recalcular
                                    </p>
                                    <p className="mt-1 leading-6">
                                        Cambiaste datos después del último cálculo. Presiona
                                        “Calcular” para actualizar el resultado.
                                    </p>
                                </div>
                            ) : null}

                            {result && visibleMetrics ? (
                                <>
                                    <div className="grid gap-3 sm:gap-4 grid-cols-2 sm:grid-cols-2">
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
                                        {effectiveServiceType === "sea" && (
                                            <MetricCard
                                                title="Base flete marítimo"
                                                value={`${formatNumber(visibleMetrics.baseFleteMaritimo, 2, 2)} ft³`}
                                                subtitle="Base usada para flete"
                                            />
                                        )}
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

                                    <details className="group mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 transition-all">
                                        <summary className="cursor-pointer font-semibold text-slate-700 flex items-center justify-between outline-none">
                                            <span>Ver detalle técnico</span>
                                            <span className="transition-transform group-open:rotate-180">▼</span>
                                        </summary>
                                        <div className="mt-4 border-t border-slate-200 pt-4">
                                            <div className="mb-4 flex flex-wrap items-center gap-2">
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

                                            <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
                                                <p>
                                                    <strong>Base de cálculo:</strong> {displayBasis}
                                                </p>
                                                <p>
                                                    <strong>Modo de storage / hold:</strong>{" "}
                                                    {technicalHoldModeLabel}
                                                </p>
                                                <p>
                                                    <strong>Volumen real:</strong>{" "}
                                                    {formatNumber(safeNumber(resultMetrics.raw_volume_ft3), 2, 2)} ft³
                                                </p>
                                                <p>
                                                    <strong>Volumen visible:</strong>{" "}
                                                    {formatNumber(safeNumber(resultMetrics.display_volume_ft3), 2, 2)} ft³
                                                </p>
                                                {effectiveServiceType === "sea" && (
                                                    <p>
                                                        <strong>Base flete marítimo:</strong>{" "}
                                                        {formatNumber(safeNumber(resultMetrics.sea_freight_volume_ft3), 2, 2)} ft³
                                                    </p>
                                                )}
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

                                            {showStorageFormula && storageFormula ? (
                                                <div className="mt-5 rounded-2xl border border-cyan-200 bg-white p-4 text-sm text-slate-700 shadow-sm">
                                                    <p className="font-semibold text-slate-950">
                                                        Fórmula de Storage estimado
                                                    </p>
                                                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                                                        <p>
                                                            <strong>Hold ingresado:</strong>{" "}
                                                            {formatNumber(storageFormula.holdDays, 0, 0)} días
                                                        </p>
                                                        <p>
                                                            <strong>Días hábiles libres OWC:</strong>{" "}
                                                            {formatNumber(storageFormula.freeDays, 0, 0)}
                                                        </p>
                                                        <p>
                                                            <strong>Días hábiles cobrables estimados:</strong>{" "}
                                                            {formatNumber(storageFormula.chargedDays, 0, 0)}
                                                        </p>
                                                        {storageFormula.exemptionApplied ? (
                                                            <p>
                                                                <strong>Días cobrados por storage:</strong>{" "}
                                                                0 por prealerta válida
                                                        </p>
                                                        ) : null}
                                                        <p>
                                                            <strong>Base storage:</strong>{" "}
                                                            {formatNumber(storageFormula.baseFt3, 2, 2)} ft³
                                                        </p>
                                                        <p>
                                                            <strong>Mínimo storage:</strong>{" "}
                                                            {formatNumber(storageFormula.minFt3, 2, 2)} ft³
                                                        </p>
                                                        <p>
                                                            <strong>Tarifa storage:</strong>{" "}
                                                            {storageFormula.rateLabel}
                                                        </p>
                                                        <p>
                                                            <strong>Tasa BCV usada:</strong>{" "}
                                                            {formatNumber(storageFormula.exchangeRate, 4, 4)}
                                                        </p>
                                                        <p>
                                                            <strong>Total storage estimado:</strong>{" "}
                                                            {formatMoneyBs(storageFormula.totalVes, 2)} |{" "}
                                                            {formatMoneyUsd(storageFormula.totalUsd, 2)}
                                                        </p>
                                                    </div>
                                                    <p className="mt-3 text-xs leading-5 text-slate-500">
                                                        Estimación referencial: OWC puede ajustar o eliminar este
                                                        cargo si el hold fue causado por error operativo o revisión
                                                        del asesor.
                                                    </p>
                                                </div>
                                            ) : null}
                                        </div>
                                    </details>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300 bg-slate-50 py-12 px-6 text-center">
                                    <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200 text-slate-400">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9zm3.75 11.625a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-bold text-slate-900">Tu cotización aparecerá aquí</h3>
                                    <p className="mt-2 max-w-sm text-sm text-slate-500">
                                        Llena el formulario y presiona Calcular. Aquí verás el peso final, volumen visible, flete, desglose y total estimado.
                                    </p>
                                </div>
                            )}
                        </div>

                        {result ? (
                            <div className="order-2 lg:order-3 rounded-3xl sm:rounded-[2rem] border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
                                <div className="mb-4 flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-xl sm:text-2xl font-bold text-slate-950">Desglose</h3>
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
                                {isZoom ? (
                                    <>
                                        <BreakdownRow
                                            label="Proteccion"
                                            ves={resultBreakdown.protection_ves}
                                            usd={resultBreakdown.protection_usd}
                                            tone="emerald"
                                        />
                                        <BreakdownRow
                                            label="Consolidacion"
                                            ves={resultBreakdown.consolidation_ves}
                                            usd={resultBreakdown.consolidation_usd}
                                            tone="violet"
                                        />
                                    </>
                                ) : (
                                    <BreakdownRow
                                        label="Seguro"
                                        ves={resultBreakdown.insurance_ves}
                                        usd={resultBreakdown.insurance_usd}
                                        tone="emerald"
                                    />
                                )}
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

                                <div className="mt-5 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
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
            <div className="mx-auto max-w-7xl px-4 sm:px-6 pb-6 sm:pb-10">
                <div className="rounded-3xl sm:rounded-[2rem] border border-slate-200 bg-white p-5 sm:p-6 md:p-10 shadow-sm mb-6 sm:mb-8">
                    <h2 className="text-xl sm:text-2xl font-bold text-slate-950 mb-4 sm:mb-6">Cómo usar Vzla Cargo Hub</h2>
                    
                    <div className="grid gap-8 md:grid-cols-2">
                        <div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-3">Guía básica</h3>
                            <ul className="space-y-3 text-sm text-slate-600">
                                <li className="flex gap-2">
                                    <span className="font-bold text-slate-900">1.</span>
                                    <span>Selecciona el courier y el tipo de servicio (Aéreo o Marítimo).</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="font-bold text-slate-900">2.</span>
                                    <span>Ingresa las dimensiones y el peso de tu paquete.</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="font-bold text-slate-900">3.</span>
                                    <span>En modo avanzado, ajusta reglas opcionales como handling o reempaque si aplican a tu caso.</span>
                                </li>
                                <li className="flex gap-2">
                                    <span className="font-bold text-slate-900">4.</span>
                                    <span>Haz clic en Calcular para ver el desglose en dólares y bolívares.</span>
                                </li>
                            </ul>
                        </div>
                        
                        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                            <h3 className="text-sm font-bold text-amber-900 uppercase tracking-wide mb-3">Reglas importantes</h3>
                            <ul className="space-y-3 text-sm text-amber-900/90 list-disc pl-4">
                                <li><strong className="font-semibold">Repack Fee:</strong> Es un cargo por servicio separado. No exonera el almacenaje por sí solo.</li>
                                <li><strong className="font-semibold">Hold normal (Almacenaje):</strong> Puede generar cargos por Storage Fee después de los 3 días hábiles libres.</li>
                                <li><strong className="font-semibold">Prealerta de repack válida:</strong> Solo exonera el cobro de storage si fue emitida correctamente y a tiempo antes de la llegada del paquete.</li>
                                <li><strong className="font-semibold">Volumen marítimo:</strong> El flete puede calcularse usando el volumen real completo (con decimales) aunque visualmente la app muestre el pie cúbico visible/redondeado, para alinearse con el courier.</li>
                                <li><strong className="font-semibold">Estimaciones:</strong> Esta app estima el costo según reglas predefinidas. El courier (ej. OWC) puede ajustar o exonerar cargos manualmente tras revisión técnica.</li>
                            </ul>
                        </div>
                    </div>
                </div>

                {/* Banner de turismo reubicado */}
                <div className="relative rounded-3xl sm:rounded-[2rem] border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-blue-50 p-5 sm:p-6 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="mb-2 inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">
                                Turismo en Venezuela
                            </div>
                            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-950">
                                Apoya el turismo en los llanos venezolanos
                            </h2>
                            <p className="mt-2 text-sm leading-6 text-slate-600">
                                Descubre destinos, rutas, paisajes y experiencias que muestran lo mejor de Venezuela.
                                Esta sección abre en una pestaña nueva para que no pierdas tu cotización.
                            </p>
                        </div>

                        <div className="flex shrink-0">
                            <a
                                href={TOURISM_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 shadow-sm"
                            >
                                Visitar sitio de turismo
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <footer className="mt-6 sm:mt-10 rounded-3xl sm:rounded-[2rem] border border-slate-200 bg-white px-5 sm:px-6 py-4 sm:py-5 shadow-sm">
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
