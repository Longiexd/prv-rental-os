// ============================================================
// STATUS REGISTRY
//
// Single source of truth for every status "meaning" shown in
// the UI: fleet status, rental state, CRM stage, invoice/payment
// state. Every page should read colors from here instead of
// reimplementing its own status → color mapping.
//
// Colors always reference design tokens (lime / pink / danger /
// muted) — never raw hex — so a brand tweak in theme.css updates
// every badge in the app at once.
// ============================================================

export type StatusTone = "lime" | "pink" | "danger" | "muted" | "amber" | "blue";

export type StatusMeta = {
  label: string;
  tone: StatusTone;
};

const TONE_CLASSES: Record<
  StatusTone,
  { bg: string; text: string; border: string; dot: string }
> = {
  lime: {
    bg: "bg-lime/10",
    text: "text-lime",
    border: "border-lime/20",
    dot: "bg-lime",
  },
  pink: {
    bg: "bg-pink/10",
    text: "text-pink",
    border: "border-pink/20",
    dot: "bg-pink",
  },
  danger: {
    bg: "bg-danger/10",
    text: "text-danger",
    border: "border-danger/20",
    dot: "bg-danger",
  },
  muted: {
    bg: "bg-surface-secondary",
    text: "text-muted",
    border: "border-border",
    dot: "bg-muted",
  },
  amber: {
    bg: "bg-amber-400/10",
    text: "text-amber-400",
    border: "border-amber-400/20",
    dot: "bg-amber-400",
  },
  blue: {
    bg: "bg-blue-400/10",
    text: "text-blue-400",
    border: "border-blue-400/20",
    dot: "bg-blue-400",
  },
};

export function toneClasses(tone: StatusTone) {
  return TONE_CLASSES[tone];
}

// --------------------------------------------------------
// FLEET STATUS
// --------------------------------------------------------

export type FleetStatus =
  | "available"
  | "reserved"
  | "rented"
  | "returnDue"
  | "cleaning"
  | "maintenance"
  | "unavailable"
  | "inactive"
  | "unknown";

// Odoo returns fleet status in French for this deployment
// ("Disponible", "Loué", "Nettoyage"...) — matching must cover
// both French and English so this stays correct regardless of
// which language the Odoo instance is configured in.
export function getFleetStatus(vehicle: {
  status?: string | null;
  active?: boolean;
}): FleetStatus {
  if (vehicle.active === false) return "inactive";

  const raw = (vehicle.status || "").toLowerCase().trim();
  if (raw.includes("indispon") || raw.includes("unavailable")) return "unavailable";

  // Checked before the generic "loué" match below, since "retour
  // dû" doesn't contain "loué" but represents the same underlying
  // rented vehicle — just one that needs an action taken on it.
  if (
    raw.includes("retour d") ||
    raw.includes("return due") ||
    raw.includes("overdue")
  )
    return "returnDue";

  if (
    raw.includes("réserv") ||
    raw.includes("reserv")
  )
    return "reserved";

  if (raw.includes("loué") || raw.includes("loue") || raw.includes("rented"))
    return "rented";

  if (
    raw.includes("disponible") ||
    raw.includes("available") ||
    raw.includes("ready")
  )
    return "available";

  if (
    raw.includes("nettoy") ||
    raw.includes("cleaning") ||
    raw === "clean"
  )
    return "cleaning";

  if (
    raw.includes("maintenance") ||
    raw.includes("entretien") ||
    raw.includes("repair") ||
    raw.includes("répar") ||
    raw.includes("repar")
  )
    return "maintenance";

  return "unknown";
}

const FLEET_STATUS_META: Record<FleetStatus, StatusMeta> = {
  available: { label: "Available", tone: "lime" },
  reserved: { label: "Reserved", tone: "amber" },
  returnDue: { label: "Return due", tone: "danger" },
  rented: { label: "Rented", tone: "pink" },
  cleaning: { label: "Cleaning", tone: "blue" },
  maintenance: { label: "Maintenance", tone: "danger" },
  unavailable: { label: "Unavailable", tone: "danger" },
  inactive: { label: "Inactive", tone: "muted" },
  unknown: { label: "Unknown", tone: "muted" },
};

export function fleetStatusMeta(status: FleetStatus): StatusMeta {
  return FLEET_STATUS_META[status];
}

// --------------------------------------------------------
// RENTAL / SALE STATE
// --------------------------------------------------------

export type RentalState =
  | "draft"
  | "confirmed"
  | "ongoing"
  | "completed"
  | "cancelled";

export function getRentalState(sale: {
  state?: string | null;
  booking_status?: string;
  returned?: boolean;
}): RentalState {
  const raw = (sale.state || "").toLowerCase();

  if (raw === "cancel" || sale.booking_status === "cancelled") return "cancelled";
  if (sale.returned) return "completed";
  if (sale.booking_status === "quotation") return "draft";
  if (raw === "done") return "completed";
  if (raw === "sale") return "confirmed";

  return "draft";
}

const RENTAL_STATE_META: Record<RentalState, StatusMeta> = {
  draft: { label: "Quotation", tone: "muted" },
  confirmed: { label: "Confirmed", tone: "lime" },
  ongoing: { label: "Ongoing", tone: "pink" },
  completed: { label: "Completed", tone: "lime" },
  cancelled: { label: "Cancelled", tone: "danger" },
};

export function rentalStateMeta(state: RentalState): StatusMeta {
  return RENTAL_STATE_META[state];
}

// --------------------------------------------------------
// INVOICE / PAYMENT STATE
// --------------------------------------------------------

export type InvoiceStatus =
  | "paid"
  | "partial"
  | "unpaid"
  | "to_invoice"
  | "no_invoice";

export function getInvoiceStatus(value?: string | null): InvoiceStatus {
  const raw = (value || "").toLowerCase();

  if (raw === "paid") return "paid";
  if (raw === "partial") return "partial";
  if (raw === "not_paid" || raw === "unpaid") return "unpaid";
  if (raw === "to invoice" || raw === "to_invoice") return "to_invoice";

  return "no_invoice";
}

const INVOICE_STATUS_META: Record<InvoiceStatus, StatusMeta> = {
  paid: { label: "Paid", tone: "lime" },
  partial: { label: "Partial", tone: "pink" },
  unpaid: { label: "Unpaid", tone: "danger" },
  to_invoice: { label: "To invoice", tone: "muted" },
  no_invoice: { label: "Nothing to invoice", tone: "muted" },
};

export function invoiceStatusMeta(status: InvoiceStatus): StatusMeta {
  return INVOICE_STATUS_META[status];
}

// --------------------------------------------------------
// CRM STAGE
// --------------------------------------------------------

export function crmStageMeta(stageName?: string | null): StatusMeta {
  const raw = (stageName || "").toLowerCase();

  if (raw.includes("won")) return { label: stageName || "Won", tone: "lime" };
  if (raw.includes("lost")) return { label: stageName || "Lost", tone: "danger" };
  if (raw.includes("negotiat") || raw.includes("proposal"))
    return { label: stageName || "Negotiation", tone: "pink" };

  return { label: stageName || "New", tone: "muted" };
}
