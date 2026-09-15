"use client";

import ActivitiesPanel from "@/components/activities/ActivitiesPanel";

import {
  Activity,
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  Car,
  Clock3,
  Plus,
  TrendingUp,
  Users,
} from "lucide-react";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardHeader } from "@/components/ui/Card";
import CreateRentalModal from "@/components/rentals/CreateRentalModal";

import { formatCurrency, formatDateShort, getInitials, isSameDay, parseDate } from "@/lib/format";
import { getFleetStatus, fleetStatusMeta, getRentalState, rentalStateMeta } from "@/lib/status";

// ============================================================
// TYPES
// (kept local — these mirror raw Odoo fields returned by /cars,
// /customers, /sales, /invoices, distinct from the shapes in
// lib/api.ts used by other flows)
// ============================================================

type RelationalValue =
  | string
  | number
  | { id?: number; name?: string }
  | null
  | false
  | undefined;

type CarData = {
  id: number;
  name: string;
  license_plate: string | null;
  model: string | null;
  category?: string | null;
  status: RelationalValue;
  active?: boolean;
};

type CustomerData = {
  id: number;
  name: string;
};

type SaleData = {
  id: number;
  name: string;
  customer: RelationalValue;
  state: string;
  date_order: string | null;
  commitment_date: string | null;
  amount_total: number;
  vehicle_id?: number | null;
  returned?: boolean;
  booking_status?: string;
};

type LeadData = { id: number; name: string; customer?: { name: string } | null; stage?: string; phone?: string; email?: string };

type InvoiceData = {
  id: number;
  state: string;
  payment_state: string;
  amount_residual: number;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://api.rental-os.klynx.net";

function displayValue(value: RelationalValue): string {
  if (value === null || value === undefined || value === false) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return value.name || "";
}

// ============================================================
// COMPONENT
// ============================================================

export default function DashboardPage() {
  const [cars, setCars] = useState<CarData[]>([]);
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [sales, setSales] = useState<SaleData[]>([]);
  const [leads, setLeads] = useState<LeadData[]>([]);
  const [leadsUnavailable, setLeadsUnavailable] = useState(false);
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);

  const [loading, setLoading] = useState(true);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Neutral on the server (and on the client's very first render,
  // before this effect runs) so SSR output and the initial client
  // render always match exactly. Filled in right after mount —
  // computing this directly during render was the actual bug:
  // the server renders in its own timezone while the browser
  // hydrates in the agent's local one, so near an hour boundary
  // they'd disagree on "Good morning" vs "Good evening" and React
  // would flag a hydration mismatch.
  const [greetingText, setGreetingText] = useState("Welcome back.");

  useEffect(() => {
    const hour = new Date().getHours();

    if (hour < 12) setGreetingText("Good morning.");
    else if (hour < 18) setGreetingText("Good afternoon.");
    else setGreetingText("Good evening.");
  }, []);

  async function loadDashboard() {
    try {
      setLoading(true);
      setError(null);

      try {
        await fetch(`${API_URL}/cars/sync`, { method: "POST" });
      } catch (syncError) {
        console.error("Fleet state sync failed:", syncError);
      }

      const [carsRes, customersRes, salesRes, invoicesRes, leadsRes] = await Promise.all([
        fetch(`${API_URL}/cars`, { cache: "no-store" }),
        fetch(`${API_URL}/customers`, { cache: "no-store" }),
        fetch(`${API_URL}/sales`, { cache: "no-store" }),
        fetch(`${API_URL}/invoices`, { cache: "no-store" }),
        fetch(`${API_URL}/crm/leads`, { cache: "no-store" }).catch(() => null),
      ]);

      if (!carsRes.ok) throw new Error(`Cars API returned ${carsRes.status}`);
      if (!customersRes.ok) throw new Error(`Customers API returned ${customersRes.status}`);
      if (!salesRes.ok) throw new Error(`Sales API returned ${salesRes.status}`);
      if (!invoicesRes.ok) throw new Error(`Invoices API returned ${invoicesRes.status}`);

      const carsData = await carsRes.json();
      const customersData = await customersRes.json();
      const salesData = await salesRes.json();
      const invoicesData = await invoicesRes.json();

      if (leadsRes?.ok) {
        const leadData = await leadsRes.json();
        setLeads(Array.isArray(leadData.leads) ? leadData.leads : []);
        setLeadsUnavailable(false);
      } else setLeadsUnavailable(true);
      setCars(Array.isArray(carsData.cars) ? carsData.cars : []);
      setCustomers(Array.isArray(customersData.customers) ? customersData.customers : []);
      setSales(Array.isArray(salesData.sales) ? salesData.sales : []);
      setInvoices(Array.isArray(invoicesData.invoices) ? invoicesData.invoices : []);
    } catch (err) {
      console.error("Dashboard API error:", err);
      setError(err instanceof Error ? err.message : "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  // Defaults to Nettoyage — this compact row doesn't have room
  // for the full 3-way choice the Fleet page offers; pick a
  // different next state there if needed.
  async function handleQuickReturn(
    vehicleId: number,
    nextState: "Nettoyage" | "Disponible"
  ) {
    try {
      const response = await fetch(
        `${API_URL}/cars/${vehicleId}/return`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ next_state: nextState }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.detail || `API returned ${response.status}`
        );
      }

      await loadDashboard();
    } catch (err) {
      console.error(
        `Failed to confirm return for vehicle ${vehicleId}:`,
        err
      );
      setError(
        err instanceof Error
          ? err.message
          : "Unable to confirm return."
      );
    }
  }

  // --------------------------------------------------------
  // DERIVED DATA
  // --------------------------------------------------------

  const carsById = useMemo(() => {
    const map = new Map<number, CarData>();
    cars.forEach((car) => map.set(car.id, car));
    return map;
  }, [cars]);

  const availableCars = useMemo(
    () =>
      cars.filter(
        (car) =>
          getFleetStatus({ status: displayValue(car.status), active: car.active }) ===
          "available"
      ).length,
    [cars]
  );

  const activeSales = useMemo(
    () => sales.filter((sale) => sale.state !== "cancel"),
    [sales]
  );

  const totalSales = activeSales.reduce(
    (sum, sale) => sum + (Number(sale.amount_total) || 0),
    0
  );

  const unpaidInvoices = invoices.filter(
    (invoice) => invoice.payment_state !== "paid" && invoice.state === "posted"
  );

  const outstandingAmount = unpaidInvoices.reduce(
    (sum, invoice) => sum + (Number(invoice.amount_residual) || 0),
    0
  );

  const today = new Date();

  // Pickups due today: rental starts today, not yet completed/cancelled.
  const pickupsToday = useMemo(() => {
    return activeSales.filter((sale) => {
      const date = parseDate(sale.date_order);
      return date && isSameDay(date, today) && sale.state !== "done";
    });
  }, [activeSales]); // eslint-disable-line react-hooks/exhaustive-deps

  // Returns due today: commitment date is today, order still open.
  const returnsToday = useMemo(() => {
    return activeSales.filter((sale) => {
      const date = parseDate(sale.commitment_date);
      return (
        date &&
        isSameDay(date, today) &&
        sale.state !== "done" &&
        !sale.returned
      );
    });
  }, [activeSales]); // eslint-disable-line react-hooks/exhaustive-deps

  // Overdue: commitment date has passed and order is still open — this
  // is what actually needs a sales agent's attention, not a generic feed.
  const overdue = useMemo(() => {
    return activeSales.filter((sale) => {
      const date = parseDate(sale.commitment_date);
      return (
        date &&
        date < today &&
        !isSameDay(date, today) &&
        sale.state !== "done" &&
        !sale.returned
      );
    });
  }, [activeSales]); // eslint-disable-line react-hooks/exhaustive-deps

  function vehicleLabel(sale: SaleData): string {
    if (!sale.vehicle_id) return "No vehicle assigned";
    const car = carsById.get(sale.vehicle_id);
    return car ? car.name : `Vehicle #${sale.vehicle_id}`;
  }

  return (
    <main className="mx-auto max-w-[1400px] p-5 sm:p-8">
      <PageHeader
        breadcrumb="Overview"
        title={greetingText}
        subtitle="Here’s what’s happening with your rental operation."
        action={
          <button
            type="button"
            onClick={() => setBookingOpen(true)}
            className="flex h-11 items-center gap-2 rounded-xl bg-lime px-5 text-sm font-semibold text-background shadow-glow-lime transition hover:bg-lime-dark"
          >
            <Plus size={16} />
            New rental
          </button>
        }
      />

      <CreateRentalModal
        open={bookingOpen}
        onClose={() => setBookingOpen(false)}
        onCreated={() => {
          setBookingOpen(false);
          loadDashboard();
        }}
      />

      {error && (
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
          Unable to load live dashboard data: {error}
        </div>
      )}

      <section aria-label="Overview metrics" className="mt-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Link href="/dashboard/fleet" className="rounded-xl"><StatCard icon={<Car size={15} />} label="Fleet" value={cars.length.toString()} detail="vehicles in Odoo" loading={loading} /></Link>
        <Link href="/dashboard/customers" className="rounded-xl"><StatCard icon={<Users size={15} />} label="Customers" value={customers.length.toString()} detail="customer records" tone="pink" loading={loading} /></Link>
        <Link href="/dashboard/fleet" className="rounded-xl"><StatCard icon={<Activity size={15} />} label="Available" value={availableCars.toString()} detail="ready to rent" loading={loading} /></Link>
        <Link href="/crm/leads" className="rounded-xl"><StatCard icon={<Users size={15} />} label="CRM leads" value={leadsUnavailable ? "—" : leads.length.toString()} detail={leadsUnavailable ? "CRM temporarily unavailable" : "active prospects"} tone="pink" loading={loading} /></Link>
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <Card className="overview-fleet">
          <CardHeader title="Fleet overview" subtitle="Your vehicles in Odoo" action={<Link href="/dashboard/fleet" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary transition hover:border-lime/40 hover:text-lime">View fleet</Link>} />
          <div className="px-5 pb-2">
            <div className="flex items-end justify-between border-b border-border py-4"><div><p className="text-[30px] font-semibold tracking-tight">{loading ? "—" : cars.length}</p><p className="mt-1 text-xs text-muted">vehicles in your fleet</p></div><span className="mb-1 inline-flex items-center gap-1.5 text-xs text-lime"><span className="h-1.5 w-1.5 rounded-full bg-lime" />{loading ? "Loading" : error ? "Check connection" : "Odoo"}</span></div>
            {loading ? <div className="py-4"><LoadingRows /></div> : !cars.length ? <p className="py-6 text-sm text-muted">No vehicles to display.</p> : cars.slice(0, 4).map(car => <Link key={car.id} href={`/dashboard/calendar?vehicle=${car.id}`} className="flex min-w-0 items-center gap-3 border-b border-border py-3 last:border-0 hover:bg-white/[0.02]">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-lime/[0.07] text-lime"><Car size={19} strokeWidth={1.5} /></span>
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{car.name}</p><p className="mt-1 truncate text-xs text-muted">{[car.category, car.license_plate].filter(Boolean).join(" · ") || "Vehicle details"}</p></div>
              <StatusBadge meta={fleetStatusMeta(getFleetStatus({ status: displayValue(car.status), active: car.active }))} withDot={false} className="shrink-0 normal-case tracking-normal" />
            </Link>)}
          </div>
        </Card>
        <Card className="overview-crm">
          <CardHeader title="CRM leads" subtitle="Your latest prospects" action={<Link href="/crm/leads" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary transition hover:border-pink/40 hover:text-pink">View CRM</Link>} />
          <div className="px-5 py-2">{loading ? <div className="py-4"><LoadingRows /></div> : leadsUnavailable ? <p className="py-6 text-sm text-muted">CRM could not load. <Link className="text-pink underline" href="/crm/leads">Open prospects</Link></p> : !leads.length ? <p className="py-6 text-sm text-muted">No prospects yet. Start a new rental to capture a demand.</p> : leads.slice(0, 4).map((lead, index) => <Link key={lead.id} href={`/crm/leads/${lead.id}`} className="flex min-w-0 items-center gap-3 border-b border-border py-4 last:border-0 hover:bg-white/[0.02]">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium ${index % 2 ? "bg-lime/[0.08] text-lime" : "bg-pink/[0.08] text-pink"}`}>{getInitials(lead.customer?.name || lead.name)}</span>
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{lead.customer?.name || lead.name}</p><p className="mt-1 truncate text-xs text-muted">{lead.phone || lead.email || lead.name}</p></div>
            <span className="max-w-28 truncate rounded-md border border-border bg-surface-secondary px-2 py-1 text-[10px] text-text-secondary">{lead.stage || "No stage"}</span>
          </Link>)}</div>
        </Card>
      </section>

      <section className="mt-4"><Card>
        <CardHeader title="Recent rentals" subtitle="Continue from the latest booking" action={<Link href="/dashboard/rentals" className="rounded-lg border border-border px-3 py-2 text-xs text-text-secondary transition hover:text-lime">View all →</Link>} />
        <div className="overflow-x-auto"><table className="w-full min-w-[660px] text-left text-sm"><thead className="border-b border-border text-[10px] uppercase tracking-wider text-muted"><tr><th className="px-5 py-3 font-normal">Customer</th><th className="px-4 py-3 font-normal">Vehicle</th><th className="px-4 py-3 font-normal">Pickup</th><th className="px-4 py-3 font-normal">Return</th><th className="px-5 py-3 font-normal">Status</th></tr></thead><tbody className="divide-y divide-border">
          {loading ? <tr><td colSpan={5} className="p-5 text-muted">Loading rentals…</td></tr> : !activeSales.length ? <tr><td colSpan={5} className="p-5 text-muted">No rentals yet. Create your first booking above.</td></tr> : activeSales.slice(0, 5).map(sale => <tr key={sale.id} className="hover:bg-white/[0.02]"><td className="max-w-64 px-5 py-4"><Link href={`/dashboard/rentals/${sale.id}`} className="block truncate font-medium hover:text-lime">{displayValue(sale.customer) || sale.name}</Link></td><td className="max-w-64 truncate px-4 py-4 text-text-secondary">{sale.vehicle_id ? <Link href={`/dashboard/calendar?vehicle=${sale.vehicle_id}`} className="hover:text-lime">{vehicleLabel(sale)}</Link> : "Not assigned"}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-text-secondary">{formatDateShort(sale.date_order)}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-text-secondary">{formatDateShort(sale.commitment_date)}</td><td className="px-5 py-4"><StatusBadge meta={rentalStateMeta(getRentalState(sale))} withDot={false} className="normal-case tracking-normal" /></td></tr>)}
        </tbody></table></div>
      </Card></section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <StatCard icon={<TrendingUp size={15} />} label="Quotation & order value" value={formatCurrency(totalSales)} detail="excluding cancelled orders" loading={loading} />
        <StatCard icon={<ArrowUpRight size={15} />} label="Outstanding" value={formatCurrency(outstandingAmount)} detail="posted invoices to collect" tone="danger" loading={loading} />
      </section>
      <div className="mt-4"><ActivitiesPanel compact /></div>

      {/* TODAY */}
      <section className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader
            title="Pickups today"
            subtitle="Rentals starting today"
          />

          <div className="p-4">
            {loading ? (
              <LoadingRows />
            ) : pickupsToday.length === 0 ? (
              <EmptyState
                icon={<Clock3 />}
                title="No pickups today"
                description="Nothing scheduled to go out today."
              />
            ) : (
              <div className="space-y-1">
                {pickupsToday.map((sale) => (
                  <ScheduleRow
                    key={sale.id}
                    sale={sale}
                    vehicleLabel={vehicleLabel(sale)}
                    icon={<ArrowUpRight size={14} />}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Returns today"
            subtitle="Rentals due back today"
          />

          <div className="p-4">
            {loading ? (
              <LoadingRows />
            ) : returnsToday.length === 0 ? (
              <EmptyState
                icon={<Clock3 />}
                title="No returns today"
                description="Nothing due back today."
              />
            ) : (
              <div className="space-y-1">
                {returnsToday.map((sale) => (
                  <ScheduleRow
                    key={sale.id}
                    sale={sale}
                    vehicleLabel={vehicleLabel(sale)}
                    icon={<ArrowDownLeft size={14} />}
                    onReturn={handleQuickReturn}
                  />
                ))}
              </div>
            )}
          </div>
        </Card>
      </section>

      {/* NEEDS ATTENTION */}
      {!loading && overdue.length > 0 && (
        <section className="mt-4">
          <Card className="border-danger/20">
            <CardHeader
              title="Needs attention"
              subtitle={`${overdue.length} rental${overdue.length === 1 ? "" : "s"} overdue for return`}
            />

            <div className="p-4">
              <div className="space-y-1">
                {overdue.map((sale) => (
                  <ScheduleRow
                    key={sale.id}
                    sale={sale}
                    vehicleLabel={vehicleLabel(sale)}
                    icon={<AlertTriangle size={14} />}
                    urgent
                    onReturn={handleQuickReturn}
                  />
                ))}
              </div>
            </div>
          </Card>
        </section>
      )}
    </main>
  );
}

// ============================================================
// SUBCOMPONENTS
// ============================================================

function ScheduleRow({
  sale,
  vehicleLabel,
  icon,
  urgent = false,
  onReturn,
}: {
  sale: SaleData;
  vehicleLabel: string;
  icon: React.ReactNode;
  urgent?: boolean;
  onReturn?: (
    vehicleId: number,
    nextState: "Nettoyage" | "Disponible"
  ) => void;
}) {
  const [showChoices, setShowChoices] = useState(false);

  const customerName = displayValue(sale.customer) || "Unknown customer";
  const rentalMeta = rentalStateMeta(getRentalState(sale));
  const dateLabel = urgent
    ? `Due ${formatDateShort(sale.commitment_date)}`
    : sale.name;

  return (
    <div className="rounded-lg transition hover:bg-surface-secondary/50">
      <Link
        href={`/dashboard/rentals/${sale.id}`}
        className="flex items-center gap-3 px-2 py-2.5"
      >
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            urgent ? "bg-danger/10 text-danger" : "bg-lime/10 text-lime"
          }`}
        >
          {icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-text">
            {customerName}
          </div>
          <div className="mt-0.5 truncate text-[10px] text-muted">
            {vehicleLabel} · {dateLabel}
          </div>
        </div>

        <StatusBadge meta={rentalMeta} withDot={false} />

        {onReturn && sale.vehicle_id && !showChoices && (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              setShowChoices(true);
            }}
            className="shrink-0 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-text-secondary transition hover:border-lime/40 hover:text-lime"
          >
            Confirm return
          </button>
        )}
      </Link>

      {onReturn && sale.vehicle_id && showChoices && (
        <div
          className="flex items-center gap-1.5 px-2 pb-2.5"
          onClick={(event) => event.preventDefault()}
        >
          <span className="text-[10px] text-muted">Send to:</span>

          <button
            type="button"
            onClick={() => onReturn(sale.vehicle_id!, "Nettoyage")}
            className="rounded-md border border-blue-400/30 bg-blue-400/10 px-2 py-1 text-[10px] font-medium text-blue-300 transition hover:bg-blue-400/20"
          >
            Nettoyage
          </button>

          <button
            type="button"
            onClick={() => onReturn(sale.vehicle_id!, "Disponible")}
            className="rounded-md border border-lime/30 bg-lime/10 px-2 py-1 text-[10px] font-medium text-lime transition hover:bg-lime/20"
          >
            Disponible
          </button>

          <button
            type="button"
            onClick={() => setShowChoices(false)}
            className="text-[10px] text-muted hover:text-text-secondary"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="space-y-2">
      {[1, 2, 3].map((item) => (
        <div key={item} className="h-12 animate-pulse rounded-lg bg-surface-secondary" />
      ))}
    </div>
  );
}
