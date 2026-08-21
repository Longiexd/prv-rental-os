"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  Car,
  CircleDollarSign,
  FileText,
  LoaderCircle,
  Search,
  X,
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
  vehicle_id?: number | null;
};

type Vehicle = {
  id: number;
  name: string;
  license_plate: string | null;
};

type RentalOption = {
  id: number;
  name: string;
};

type RentalVehicleOption = Vehicle & {
  status: string | null;
};

type ProductOption = RentalOption & {
  list_price: number;
  suggested_product_ids: number[];
};

type RentalOptionsResponse = {
  customers: RentalOption[];
  vehicles: RentalVehicleOption[];
  products: ProductOption[];
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

type CarsResponse = {
  cars: Vehicle[];
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
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [options, setOptions] = useState<RentalOptionsResponse | null>(null);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [customerText, setCustomerText] = useState("");
  const [vehicleText, setVehicleText] = useState("");
  const [productText, setProductText] = useState("");
  const [optionalProductIds, setOptionalProductIds] = useState<number[]>([]);
  const [form, setForm] = useState({
    partner_id: "",
    vehicle_id: "",
    product_id: "",
    start_date: "",
    end_date: "",
    quantity: "1",
    unit_price: "",
  });

  useEffect(() => {
    async function loadRentals() {
      try {
        setLoading(true);

        const [salesResponse, invoicesResponse, carsResponse] =
          await Promise.all([
            fetch(`${API_URL}/sales`, {
              cache: "no-store",
            }),
            fetch(`${API_URL}/invoices`, {
              cache: "no-store",
            }),
            fetch(`${API_URL}/cars`, {
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

        if (!carsResponse.ok) {
          throw new Error(
            `Cars API returned ${carsResponse.status}`
          );
        }

        const salesData: SalesResponse =
          await salesResponse.json();

        const invoicesData: InvoicesResponse =
          await invoicesResponse.json();

        const carsData: CarsResponse = await carsResponse.json();

        setSales(salesData.sales || []);
        setInvoices(invoicesData.invoices || []);
        setVehicles(carsData.cars || []);
      } catch (err) {
        console.error(err);
        setError("Unable to load rental data.");
      } finally {
        setLoading(false);
      }
    }

    loadRentals();
  }, []);

  const openCreateForm = useCallback(async () => {
    setFormError(null);
    setOptionsLoading(true);
    setShowCreateForm(true);

    try {
      const response = await fetch(`${API_URL}/rentals/options`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`Rental options API returned ${response.status}`);
      }

      setOptions(await response.json());
    } catch (err) {
      console.error(err);
      setFormError("Unable to load rental choices.");
    } finally {
      setOptionsLoading(false);
    }
  }, []);

  useEffect(() => {
    const shouldOpenRentalForm = new URLSearchParams(
      window.location.search
    ).get("new") === "1";

    if (shouldOpenRentalForm) {
      void openCreateForm();
    }
  }, [openCreateForm]);

  async function createRental(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSubmitting(true);

    try {
      const response = await fetch(`${API_URL}/rentals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_id: Number(form.partner_id),
          vehicle_id: Number(form.vehicle_id),
          product_id: Number(form.product_id),
          start_date: form.start_date,
          end_date: form.end_date,
          quantity: Number(form.quantity),
          optional_product_ids: optionalProductIds,
          ...(form.unit_price === ""
            ? {}
            : { unit_price: Number(form.unit_price) }),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || "Unable to create rental.");
      }

      setSales((current) => [data.sale, ...current]);
      setShowCreateForm(false);
      setCustomerText("");
      setVehicleText("");
      setProductText("");
      setOptionalProductIds([]);
      setForm({
        partner_id: "", vehicle_id: "", product_id: "", start_date: "",
        end_date: "", quantity: "1", unit_price: "",
      });
    } catch (err) {
      console.error(err);
      setFormError(
        err instanceof Error ? err.message : "Unable to create rental."
      );
    } finally {
      setSubmitting(false);
    }
  }

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

        <button
          onClick={openCreateForm}
          className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[#C8F065] px-4 text-xs font-medium text-black transition hover:bg-[#d7ff80]"
        >
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

                      {sale.customer ? (
                        <Link
                          href={`/dashboard/customers/${sale.customer.id}`}
                          className="mt-1 block text-sm text-zinc-300 hover:text-[#C8F065]"
                        >
                          {sale.customer.name}
                        </Link>
                      ) : (
                        <div className="mt-1 text-sm text-zinc-300">
                          Unknown customer
                        </div>
                      )}

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
                        {sale.vehicle_id
                          ? vehicles.find(
                              (vehicle) => vehicle.id === sale.vehicle_id
                            )?.name || "Assigned vehicle"
                          : "Unassigned"}
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

      {showCreateForm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/70 p-0 sm:items-center sm:justify-center sm:p-6">
          <div
            className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-[#2B2B30] bg-[#111113] p-5 shadow-2xl sm:rounded-2xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-rental-title"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="new-rental-title" className="text-lg font-semibold text-white">
                  New rental
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Creates a draft sale order in Odoo. Its invoices remain linked by Odoo.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close new rental form"
                onClick={() => setShowCreateForm(false)}
                className="rounded-lg p-2 text-zinc-500 transition hover:bg-[#1B1B1E] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            {optionsLoading ? (
              <div className="flex h-56 items-center justify-center gap-2 text-sm text-zinc-500">
                <LoaderCircle size={17} className="animate-spin" />
                Loading Odoo options...
              </div>
            ) : (
              <form onSubmit={createRental} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-xs text-zinc-400">
                    Customer
                    <select
                      required
                      value={form.partner_id}
                      onChange={(event) => setForm({ ...form, partner_id: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                    >
                      <option value="">Select customer</option>
                      {options?.customers.map((customer) => (
                        <option key={customer.id} value={customer.id}>{customer.name}</option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5 text-xs text-zinc-400">
                    Fleet vehicle
                    <select
                      required
                      value={form.vehicle_id}
                      onChange={(event) => setForm({ ...form, vehicle_id: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                    >
                      <option value="">Select available vehicle</option>
                      {options?.vehicles.map((vehicle) => (
                        <option key={vehicle.id} value={vehicle.id}>
                          {vehicle.name}{vehicle.license_plate ? ` — ${vehicle.license_plate}` : ""}{vehicle.status ? ` (${vehicle.status})` : ""}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5 text-xs text-zinc-400">
                    Sale option
                    <select
                      required
                      value={form.product_id}
                      onChange={(event) => setForm({ ...form, product_id: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                    >
                      <option value="">Select product or service</option>
                      {options?.products.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name} — {product.list_price.toLocaleString()} TND
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1.5 text-xs text-zinc-400">
                    Quantity
                    <input
                      required
                      min="0.01"
                      step="0.01"
                      type="number"
                      value={form.quantity}
                      onChange={(event) => setForm({ ...form, quantity: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                    />
                  </label>

                  <label className="space-y-1.5 text-xs text-zinc-400">
                    Rental start
                    <input
                      required
                      type="date"
                      value={form.start_date}
                      onChange={(event) => setForm({ ...form, start_date: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                    />
                  </label>

                  <label className="space-y-1.5 text-xs text-zinc-400">
                    Return date
                    <input
                      required
                      type="date"
                      value={form.end_date}
                      onChange={(event) => setForm({ ...form, end_date: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                    />
                  </label>

                  <label className="space-y-1.5 text-xs text-zinc-400 sm:col-span-2">
                    Unit price (optional — uses the Odoo sales price when blank)
                    <input
                      min="0"
                      step="0.001"
                      type="number"
                      value={form.unit_price}
                      onChange={(event) => setForm({ ...form, unit_price: event.target.value })}
                      className="h-10 w-full rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-sm text-white outline-none focus:border-[#C8F065]/50"
                    />
                  </label>
                </div>

                {formError && (
                  <p className="rounded-lg border border-red-900/40 bg-red-950/20 px-3 py-2 text-sm text-red-300">
                    {formError}
                  </p>
                )}

                <div className="flex justify-end gap-3 border-t border-[#2B2B30] pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="h-9 rounded-lg px-4 text-xs font-medium text-zinc-400 transition hover:bg-[#1B1B1E] hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={submitting || !options}
                    className="flex h-9 items-center gap-2 rounded-lg bg-[#C8F065] px-4 text-xs font-medium text-black transition hover:bg-[#d7ff80] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting && <LoaderCircle size={14} className="animate-spin" />}
                    Create rental
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </main>
  );

  const selectedProduct = options?.products.find(
    (product) => product.id === Number(form.product_id)
  );
  const suggestedProducts = options?.products.filter((product) =>
    selectedProduct?.suggested_product_ids.includes(product.id)
  ) || [];
}
