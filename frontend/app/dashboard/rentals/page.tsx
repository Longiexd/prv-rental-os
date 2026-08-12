"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  Car,
  CircleDollarSign,
  FileText,
  Search,
} from "lucide-react";

type Customer = {
  id: number;
  name: string;
};

type Opportunity = {
  id: number;
  name: string;
};

type Sale = {
  id: number;
  name: string;
  customer: Customer | null;
  state: string;
  date_order: string | null;
  commitment_date: string | null;
  amount_total: number;
  invoice_status: string;
  opportunity: Opportunity | null;
  order_line_ids: number[];
};

type Invoice = {
  id: number;
  name: string | false;
  customer: Customer | null;
  state: string;
  invoice_date: string | false;
  due_date: string | false;
  amount_total: number;
  amount_residual: number;
  payment_state: string;
  origin: string | false;
};

type SalesResponse = {
  count: number;
  sales: Sale[];
};

type InvoicesResponse = {
  count: number;
  invoices: Invoice[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

function formatDate(value: string | null | false) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value.toString();

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function getInvoiceForSale(
  sale: Sale,
  invoices: Invoice[]
) {
  return invoices.find(
    (invoice) => invoice.origin === sale.name
  );
}

function getRentalState(sale: Sale) {
  if (sale.state === "cancel") {
    return {
      label: "Cancelled",
      className:
        "border-red-400/20 bg-red-400/10 text-red-300",
    };
  }

  if (sale.state === "sale") {
    return {
      label: "Confirmed",
      className:
        "border-[#C8F065]/20 bg-[#C8F065]/10 text-[#C8F065]",
    };
  }

  return {
    label: "Quotation",
    className:
      "border-blue-400/20 bg-blue-400/10 text-blue-300",
  };
}

export default function RentalsPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function loadRentals() {
      try {
        setLoading(true);

        const [salesResponse, invoicesResponse] =
          await Promise.all([
            fetch(`${API_URL}/sales`, {
              cache: "no-store",
            }),
            fetch(`${API_URL}/invoices`, {
              cache: "no-store",
            }),
          ]);

        if (!salesResponse.ok) {
          throw new Error(
            `Sales API returned ${salesResponse.status}`
          );
        }

        if (!invoicesResponse.ok) {
          throw new Error(
            `Invoices API returned ${invoicesResponse.status}`
          );
        }

        const salesData: SalesResponse =
          await salesResponse.json();

        const invoicesData: InvoicesResponse =
          await invoicesResponse.json();

        setSales(salesData.sales || []);
        setInvoices(invoicesData.invoices || []);
      } catch (err) {
        console.error(err);
        setError("Unable to load rental data.");
      } finally {
        setLoading(false);
      }
    }

    loadRentals();
  }, []);

  const filteredSales = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return sales;

    return sales.filter((sale) =>
      [
        sale.name,
        sale.customer?.name,
        sale.opportunity?.name,
        sale.state,
        sale.invoice_status,
      ]
        .filter(Boolean)
        .some((value) =>
          value!.toLowerCase().includes(query)
        )
    );
  }, [sales, search]);

  const confirmed = sales.filter(
    (sale) => sale.state === "sale"
  ).length;

  const totalValue = sales.reduce(
    (sum, sale) => sum + (sale.amount_total || 0),
    0
  );

  const outstanding = invoices.reduce(
    (sum, invoice) =>
      sum + (invoice.amount_residual || 0),
    0
  );

  return (
    <main className="mx-auto max-w-[1500px] p-5 sm:p-8">

      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] text-[#71717A]">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#A1A1AA]">Rentals</span>
          </div>

          <h1 className="font-[Syne] text-[28px] font-semibold tracking-[-0.035em] text-white sm:text-[32px]">
            Rentals
          </h1>

          <p className="mt-1 text-sm text-[#71717A]">
            Rental operations, sales and invoicing.
          </p>
        </div>

        <button className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[#C8F065] px-4 text-xs font-medium text-black transition hover:bg-[#d7ff80]">
          <CalendarDays size={14} />
          New rental
        </button>
      </section>

      <section className="mt-7 grid gap-3 sm:grid-cols-3">

        <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Rentals
            </span>
            <Car size={16} className="text-[#C8F065]" />
          </div>

          <div className="mt-3 text-3xl font-semibold text-white">
            {loading ? "—" : confirmed}
          </div>

          <div className="mt-1 text-xs text-zinc-600">
            confirmed orders
          </div>
        </div>

        <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              Rental Value
            </span>
            <CircleDollarSign
              size={16}
              className="text-[#C8F065]"
            />
          </div>

          <div className="mt-3 text-3xl font-semibold text-white">
            {loading
              ? "—"
              : `${totalValue.toLocaleString()} TND`}
          </div>

          <div className="mt-1 text-xs text-zinc-600">
            sales total
          </div>
        </div>

        <div className="rounded-2xl border border-orange-400/20 bg-orange-400/[0.04] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-orange-300">
              Outstanding
            </span>
            <FileText
              size={16}
              className="text-orange-400"
            />
          </div>

          <div className="mt-3 text-3xl font-semibold text-white">
            {loading
              ? "—"
              : `${outstanding.toLocaleString()} TND`}
          </div>

          <div className="mt-1 text-xs text-orange-300/50">
            unpaid invoice balance
          </div>
        </div>

      </section>

      <section className="mt-5">
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search rentals, customers, orders..."
            className="h-10 w-full rounded-xl border border-[#2B2B30] bg-[#111113] pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#C8F065]/50"
          />
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <section className="mt-5 space-y-3">

        {loading ? (
          <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] px-5 py-14 text-center text-sm text-zinc-600">
            Loading rentals...
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] px-5 py-14 text-center text-sm text-zinc-600">
            No rentals found.
          </div>
        ) : (
          filteredSales.map((sale) => {
            const rentalState = getRentalState(sale);
            const invoice = getInvoiceForSale(
              sale,
              invoices
            );

            return (
              <article
                key={sale.id}
                className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5 transition hover:border-[#3A3A40] hover:bg-[#151517]"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

                  <div className="flex min-w-0 items-start gap-4">

                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2B2B30] bg-[#17171A]">
                      <Car
                        size={19}
                        className="text-zinc-400"
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-medium text-white">
                          {sale.name}
                        </span>

                        <span
                          className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider ${rentalState.className}`}
                        >
                          {rentalState.label}
                        </span>
                      </div>

                      <div className="mt-1 text-sm text-zinc-300">
                        {sale.customer?.name ||
                          "Unknown customer"}
                      </div>

                      <div className="mt-1 text-xs text-zinc-600">
                        {sale.opportunity?.name ||
                          "Rental opportunity"}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm sm:grid-cols-4">

                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                        Rental Start
                      </div>
                      <div className="mt-1 text-zinc-300">
                        {formatDate(sale.date_order)}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                        Vehicle
                      </div>
                      <div className="mt-1 text-zinc-500">
                        Unassigned
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                        Invoice
                      </div>
                      <div className="mt-1">
                        {invoice ? (
                          <span
                            className={
                              invoice.payment_state ===
                              "paid"
                                ? "text-[#C8F065]"
                                : "text-orange-300"
                            }
                          >
                            {invoice.payment_state ===
                            "paid"
                              ? "Paid"
                              : invoice.payment_state}
                          </span>
                        ) : (
                          <span className="text-zinc-500">
                            No invoice
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-zinc-600">
                        Total
                      </div>
                      <div className="mt-1 font-medium text-white">
                        {sale.amount_total.toLocaleString()}{" "}
                        TND
                      </div>
                    </div>

                  </div>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#2B2B30] pt-4">

                  <div className="flex items-center gap-2 text-xs text-zinc-600">
                    <CalendarDays size={13} />
                    Ordered {formatDate(sale.date_order)}

                    {sale.commitment_date && (
                      <>
                        <span>→</span>
                        <span className="text-zinc-400">
                          Return{" "}
                          {formatDate(
                            sale.commitment_date
                          )}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="text-xs text-zinc-600">
                    Invoice status:{" "}
                    <span className="text-zinc-400">
                      {sale.invoice_status}
                    </span>
                  </div>

                </div>
              </article>
            );
          })
        )}

      </section>
    </main>
  );
}
