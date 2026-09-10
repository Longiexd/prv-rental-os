"use client";

import {
  ArrowLeft,
  Calendar,
  Car,
  Check,
  FileText,
  LoaderCircle,
  Plus,
  Receipt,
  User,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardHeader } from "@/components/ui/Card";

import { formatCurrency, formatDate } from "@/lib/format";
import {
  getRentalState,
  rentalStateMeta,
  getInvoiceStatus,
  invoiceStatusMeta,
} from "@/lib/status";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

// ============================================================
// TYPES — mirrors GET /sales/{id}
// ============================================================

type QuotationLine = {
  id: number;
  product: { id: number; name: string } | null;
  description: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  subtotal: number;
  total: number;
};

type QuotationInvoice = {
  id: number;
  name: string;
  draft: boolean;
  payment_status: string;
  date: string | null;
  due_date: string | null;
  total: number;
  paid: number;
  outstanding: number;
};

type Quotation = {
  id: number;
  name: string;
  customer: { id: number; name: string } | null;
  state: string;
  date_order: string | null;
  commitment_date: string | null;
  amount_untaxed: number;
  amount_tax: number;
  amount_total: number;
  invoice_status: string;
  amount_invoiced: number;
  amount_to_invoice: number;
  lines: QuotationLine[];
  invoices: QuotationInvoice[];
  opportunity: { id: number; name: string } | null;
  vehicle_id: number | null;
};

type CarData = {
  id: number;
  name: string;
  license_plate: string | null;
};

type Journal = { id: number; name: string };

type Payment = {
  amount: number;
  date: string | null;
  reference: string | null;
};

// ============================================================
// COMPONENT
// ============================================================

export default function RentalDetailPage() {
  const params = useParams();
  const rentalId = Number(params.id);

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [cars, setCars] = useState<CarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [generatingInvoice, setGeneratingInvoice] = useState(false);

  // Line editing — draft quotations only.
  const [editingLineId, setEditingLineId] = useState<number | null>(
    null
  );
  const [editQuantity, setEditQuantity] = useState("");
  const [editDiscount, setEditDiscount] = useState("");
  const [savingLine, setSavingLine] = useState(false);

  // Payments.
  const [journals, setJournals] = useState<Journal[]>([]);
  const [paymentAmount, setPaymentAmount] = useState<
    Record<number, string>
  >({});
  const [paymentJournalId, setPaymentJournalId] = useState<
    Record<number, string>
  >({});
  const [payingInvoiceId, setPayingInvoiceId] = useState<
    number | null
  >(null);
  const [paymentHistory, setPaymentHistory] = useState<
    Record<number, Payment[]>
  >({});
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<
    number | null
  >(null);

  async function loadQuotation() {
    try {
      setLoading(true);
      setError(null);

      const [quotationRes, carsRes, journalsRes] =
        await Promise.all([
          fetch(`${API_URL}/sales/${rentalId}`, {
            cache: "no-store",
          }),
          fetch(`${API_URL}/cars`, { cache: "no-store" }),
          fetch(`${API_URL}/invoices/payment-journals`, {
            cache: "no-store",
          }),
        ]);

      if (!quotationRes.ok) {
        throw new Error(`API returned ${quotationRes.status}`);
      }

      setQuotation(await quotationRes.json());

      if (carsRes.ok) {
        const carsData = await carsRes.json();
        setCars(carsData.cars || []);
      }

      if (journalsRes.ok) {
        const journalsData = await journalsRes.json();
        setJournals(journalsData.journals || []);
      }
    } catch (err) {
      console.error("Failed to load rental:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load this rental."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (rentalId) loadQuotation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rentalId]);

  const vehicle = quotation?.vehicle_id
    ? cars.find((car) => car.id === quotation.vehicle_id)
    : null;

  // ==========================================================
  // GENERATE INVOICE
  // ==========================================================

  async function handleGenerateInvoice() {
    try {
      setGeneratingInvoice(true);

      const response = await fetch(
        `${API_URL}/sales/${rentalId}/invoice`,
        { method: "POST" }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.detail || `API returned ${response.status}`
        );
      }

      await loadQuotation();
    } catch (err) {
      console.error("Failed to generate invoice:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to generate invoice."
      );
    } finally {
      setGeneratingInvoice(false);
    }
  }

  // ==========================================================
  // EDIT LINE (draft quotations only)
  // ==========================================================

  function startEditLine(line: QuotationLine) {
    setEditingLineId(line.id);
    setEditQuantity(String(line.quantity));
    setEditDiscount(String(line.discount_percent));
  }

  async function saveLine(lineId: number) {
    try {
      setSavingLine(true);

      const response = await fetch(
        `${API_URL}/sales/${rentalId}/lines/${lineId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity: Number(editQuantity) || 1,
            discount_percent: Number(editDiscount) || 0,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.detail || `API returned ${response.status}`
        );
      }

      setEditingLineId(null);
      await loadQuotation();
    } catch (err) {
      console.error("Failed to update line:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update this line."
      );
    } finally {
      setSavingLine(false);
    }
  }

  // ==========================================================
  // PAYMENTS
  // ==========================================================

  async function handleRecordPayment(invoiceId: number) {
    const amount = Number(paymentAmount[invoiceId]);
    const journalId = Number(paymentJournalId[invoiceId]);

    if (!amount || amount <= 0) {
      setError("Enter a payment amount first.");
      return;
    }

    if (!journalId) {
      setError("Select which account this payment went into.");
      return;
    }

    try {
      setPayingInvoiceId(invoiceId);

      const response = await fetch(
        `${API_URL}/invoices/${invoiceId}/payments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount,
            journal_id: journalId,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.detail || `API returned ${response.status}`
        );
      }

      setPaymentAmount((current) => ({
        ...current,
        [invoiceId]: "",
      }));

      await loadQuotation();
    } catch (err) {
      console.error("Failed to record payment:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to record this payment."
      );
    } finally {
      setPayingInvoiceId(null);
    }
  }

  async function toggleHistory(invoiceId: number) {
    if (expandedInvoiceId === invoiceId) {
      setExpandedInvoiceId(null);
      return;
    }

    setExpandedInvoiceId(invoiceId);

    if (!paymentHistory[invoiceId]) {
      try {
        const response = await fetch(
          `${API_URL}/invoices/${invoiceId}/payments`,
          { cache: "no-store" }
        );

        if (response.ok) {
          const data = await response.json();
          setPaymentHistory((current) => ({
            ...current,
            [invoiceId]: data.payments || [],
          }));
        }
      } catch (err) {
        console.error("Failed to load payment history:", err);
      }
    }
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  if (loading) {
    return (
      <main className="mx-auto max-w-[1100px] p-5 sm:p-8">
        <div className="text-xs text-muted">Loading rental...</div>
      </main>
    );
  }

  if (!quotation) {
    return (
      <main className="mx-auto max-w-[1100px] p-5 sm:p-8">
        <EmptyState
          icon={<FileText />}
          title="Rental not found"
          description={
            error || "This rental doesn't exist or couldn't load."
          }
        />
      </main>
    );
  }

  const rentalMeta = rentalStateMeta(getRentalState(quotation));
  const isDraft = quotation.state === "draft";
  const canInvoice =
    !isDraft && quotation.amount_to_invoice > 0;

  return (
    <main className="mx-auto max-w-[1100px] p-5 sm:p-8">
      <Link
        href="/dashboard/rentals"
        className="mb-4 inline-flex items-center gap-1.5 text-[11px] text-muted transition hover:text-text"
      >
        <ArrowLeft size={13} />
        Back to rentals
      </Link>

      <PageHeader
        breadcrumb="Rentals"
        title={quotation.customer?.name || quotation.name}
        subtitle={quotation.name}
        action={<StatusBadge meta={rentalMeta} />}
      />

      {error && (
        <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger">
          {error}
        </div>
      )}

      {/* SUMMARY */}

      <section className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={<Receipt size={15} />}
          label="Total"
          value={formatCurrency(quotation.amount_total)}
        />
        <StatCard
          icon={<FileText size={15} />}
          label="Invoiced"
          value={formatCurrency(quotation.amount_invoiced)}
          tone="pink"
        />
        <StatCard
          icon={<Check size={15} />}
          label="Paid"
          value={formatCurrency(
            quotation.invoices.reduce(
              (sum, invoice) => sum + invoice.paid,
              0
            )
          )}
        />
        <StatCard
          icon={<Receipt size={15} />}
          label="Outstanding"
          value={formatCurrency(
            quotation.invoices.reduce(
              (sum, invoice) => sum + invoice.outstanding,
              0
            )
          )}
          tone={
            quotation.invoices.some(
              (invoice) => invoice.outstanding > 0
            )
              ? "danger"
              : "lime"
          }
        />
      </section>

      {/* WHO / WHAT / WHEN */}

      <section className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
            <User size={12} /> Customer
          </div>
          {quotation.customer ? (
            <Link
              href={`/dashboard/customers/${quotation.customer.id}`}
              className="mt-1.5 block text-sm text-text hover:text-lime"
            >
              {quotation.customer.name}
            </Link>
          ) : (
            <div className="mt-1.5 text-sm text-muted">—</div>
          )}
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
            <Car size={12} /> Vehicle
          </div>
          <div className="mt-1.5 text-sm text-text">
            {vehicle
              ? `${vehicle.name}${
                  vehicle.license_plate
                    ? ` — ${vehicle.license_plate}`
                    : ""
                }`
              : "—"}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted">
            <Calendar size={12} /> Dates
          </div>
          <div className="mt-1.5 text-sm text-text">
            {formatDate(quotation.date_order)} →{" "}
            {formatDate(quotation.commitment_date)}
          </div>
        </Card>
      </section>

      {/* QUOTATION LINES */}

      <section className="mt-4">
        <Card>
          <CardHeader
            title="Quotation"
            subtitle={
              isDraft
                ? "Draft — quantities and discounts can be edited."
                : "Confirmed — line items are locked."
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-left">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">Qty</th>
                  <th className="px-5 py-3 font-medium">
                    Unit price
                  </th>
                  <th className="px-5 py-3 font-medium">Discount</th>
                  <th className="px-5 py-3 text-right font-medium">
                    Total
                  </th>
                  {isDraft && <th className="px-5 py-3" />}
                </tr>
              </thead>

              <tbody className="divide-y divide-border">
                {quotation.lines.map((line) => {
                  const editing = editingLineId === line.id;

                  return (
                    <tr key={line.id} className="text-xs">
                      <td className="px-5 py-3 text-text">
                        {line.description}
                      </td>

                      <td className="px-5 py-3 text-text-secondary">
                        {editing ? (
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={editQuantity}
                            onChange={(event) =>
                              setEditQuantity(event.target.value)
                            }
                            className="h-7 w-16 rounded-md border border-border bg-surface-secondary px-2 text-xs text-text outline-none focus:border-lime/50"
                          />
                        ) : (
                          line.quantity
                        )}
                      </td>

                      <td className="px-5 py-3 text-text-secondary">
                        {formatCurrency(line.unit_price)}
                      </td>

                      <td className="px-5 py-3 text-text-secondary">
                        {editing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="1"
                              value={editDiscount}
                              onChange={(event) =>
                                setEditDiscount(event.target.value)
                              }
                              className="h-7 w-14 rounded-md border border-border bg-surface-secondary px-2 text-xs text-text outline-none focus:border-lime/50"
                            />
                            %
                          </div>
                        ) : line.discount_percent ? (
                          `${line.discount_percent}%`
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="px-5 py-3 text-right font-medium text-text">
                        {formatCurrency(line.total)}
                      </td>

                      {isDraft && (
                        <td className="px-5 py-3 text-right">
                          {editing ? (
                            <div className="flex justify-end gap-1.5">
                              <button
                                type="button"
                                disabled={savingLine}
                                onClick={() => saveLine(line.id)}
                                className="rounded-md bg-lime px-2 py-1 text-[10px] font-semibold text-background disabled:opacity-50"
                              >
                                {savingLine ? "..." : "Save"}
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setEditingLineId(null)
                                }
                                className="rounded-md border border-border px-2 py-1 text-[10px] text-muted"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => startEditLine(line)}
                              className="text-[10px] text-muted underline-offset-2 hover:text-lime hover:underline"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-6 border-t border-border px-5 py-3 text-xs">
            <div className="text-muted">
              Untaxed:{" "}
              <span className="text-text-secondary">
                {formatCurrency(quotation.amount_untaxed)}
              </span>
            </div>
            <div className="text-muted">
              Tax:{" "}
              <span className="text-text-secondary">
                {formatCurrency(quotation.amount_tax)}
              </span>
            </div>
            <div className="font-medium text-text">
              Total: {formatCurrency(quotation.amount_total)}
            </div>
          </div>
        </Card>
      </section>

      {/* INVOICES + PAYMENTS */}

      <section className="mt-4">
        <Card>
          <CardHeader
            title="Invoices & payments"
            action={
              canInvoice && (
                <button
                  type="button"
                  disabled={generatingInvoice}
                  onClick={handleGenerateInvoice}
                  className="flex items-center gap-1.5 rounded-lg bg-lime px-3 py-1.5 text-[11px] font-semibold text-background transition hover:bg-lime-dark disabled:opacity-60"
                >
                  {generatingInvoice ? (
                    <LoaderCircle
                      size={12}
                      className="animate-spin"
                    />
                  ) : (
                    <Plus size={12} />
                  )}
                  Generate invoice
                </button>
              )
            }
          />

          {quotation.invoices.length === 0 && (
            <div className="p-6">
              <EmptyState
                icon={<Receipt />}
                title="No invoice yet"
                description={
                  isDraft
                    ? "Confirm this rental first, then an invoice can be generated."
                    : "Generate an invoice once this rental is ready to bill."
                }
              />
            </div>
          )}

          {quotation.invoices.map((invoice) => {
            const meta = invoiceStatusMeta(
              getInvoiceStatus(invoice.payment_status)
            );

            return (
              <div
                key={invoice.id}
                className="border-t border-border p-5 first:border-t-0"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-sm font-medium text-text">
                      {invoice.name}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted">
                      {formatDate(invoice.date)}
                      {invoice.due_date &&
                        ` · due ${formatDate(invoice.due_date)}`}
                    </div>
                  </div>

                  <StatusBadge meta={meta} />
                </div>

                <div className="mt-3 flex gap-6 text-xs">
                  <div className="text-muted">
                    Total:{" "}
                    <span className="text-text-secondary">
                      {formatCurrency(invoice.total)}
                    </span>
                  </div>
                  <div className="text-muted">
                    Paid:{" "}
                    <span className="text-text-secondary">
                      {formatCurrency(invoice.paid)}
                    </span>
                  </div>
                  <div className="text-muted">
                    Outstanding:{" "}
                    <span
                      className={
                        invoice.outstanding > 0
                          ? "text-danger"
                          : "text-lime"
                      }
                    >
                      {formatCurrency(invoice.outstanding)}
                    </span>
                  </div>
                </div>

                {invoice.outstanding > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Amount"
                      value={paymentAmount[invoice.id] || ""}
                      onChange={(event) =>
                        setPaymentAmount((current) => ({
                          ...current,
                          [invoice.id]: event.target.value,
                        }))
                      }
                      className="h-8 w-28 rounded-lg border border-border bg-surface-secondary px-2.5 text-xs text-text outline-none focus:border-lime/50"
                    />

                    <select
                      value={paymentJournalId[invoice.id] || ""}
                      onChange={(event) =>
                        setPaymentJournalId((current) => ({
                          ...current,
                          [invoice.id]: event.target.value,
                        }))
                      }
                      className="h-8 rounded-lg border border-border bg-surface-secondary px-2.5 text-xs text-text outline-none focus:border-lime/50"
                    >
                      <option value="">Account...</option>
                      {journals.map((journal) => (
                        <option key={journal.id} value={journal.id}>
                          {journal.name}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      disabled={payingInvoiceId === invoice.id}
                      onClick={() =>
                        handleRecordPayment(invoice.id)
                      }
                      className="h-8 rounded-lg bg-lime px-3 text-[11px] font-semibold text-background transition hover:bg-lime-dark disabled:opacity-60"
                    >
                      {payingInvoiceId === invoice.id
                        ? "Recording..."
                        : "Record payment"}
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => toggleHistory(invoice.id)}
                  className="mt-2 text-[10px] text-muted underline-offset-2 hover:text-text hover:underline"
                >
                  {expandedInvoiceId === invoice.id
                    ? "Hide payment history"
                    : "View payment history"}
                </button>

                {expandedInvoiceId === invoice.id && (
                  <div className="mt-2 space-y-1 rounded-lg bg-surface-secondary/50 p-3">
                    {(paymentHistory[invoice.id] || []).length ===
                    0 ? (
                      <div className="text-[11px] text-muted">
                        No payments recorded yet.
                      </div>
                    ) : (
                      paymentHistory[invoice.id].map(
                        (payment, index) => (
                          <div
                            key={index}
                            className="flex justify-between text-[11px] text-text-secondary"
                          >
                            <span>{formatDate(payment.date)}</span>
                            <span>
                              {formatCurrency(payment.amount)}
                            </span>
                          </div>
                        )
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      </section>
    </main>
  );
}
