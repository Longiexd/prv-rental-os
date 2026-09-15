"use client";

import { ArrowLeft, Calendar, Car, Check, FileText, Receipt, User } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { FormEvent, useCallback, useEffect, useState } from "react";
import ActivitiesPanel from "@/components/activities/ActivitiesPanel";
import CreateRentalModal from "@/components/rentals/CreateRentalModal";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card, CardHeader } from "@/components/ui/Card";
import { apiFetch } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import { getRentalState, rentalStateMeta } from "@/lib/status";

type QuotationLine = {
  id: number; is_downpayment?: boolean; product: { id: number; name: string } | null; description: string;
  quantity: number; unit_price: number; discount_percent: number; total: number;
};
type QuotationInvoice = {
  id: number; name: string; draft: boolean; state: string; type: string;
  payment_status: string; date: string | null; due_date: string | null;
  total: number; paid: number; outstanding: number;
};
type Quotation = {
  id: number; name: string; customer: { id: number; name: string } | null;
  state: string; date_order: string | null; commitment_date: string | null;
  amount_untaxed: number; amount_tax: number; amount_total: number;
  amount_invoiced: number; amount_to_invoice: number; amount_paid: number; amount_outstanding: number;
  opportunity?: { id: number; name: string } | null; lines: QuotationLine[]; invoices: QuotationInvoice[]; vehicle_id: number | null;
  booking_status: "quotation" | "confirmed" | "cancelled"; returned: boolean;
};
type Payment = { amount: number; date: string | null; reference: string | null };
type Product = { id: number; name: string; list_price: number };
const inputClass = "h-10 min-w-0 rounded-lg border border-border bg-surface-secondary px-3 text-sm text-text outline-none focus:border-lime/60";
const buttonClass = "rounded-lg border border-border px-3 py-2 text-sm text-text transition hover:bg-surface-secondary disabled:opacity-50";
const primaryClass = `${buttonClass} border-lime/40 bg-lime/15 text-lime`;

export default function RentalDetailPage() {
  const { id } = useParams<{ id: string }>();
  const rentalId = Number(id);
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [cars, setCars] = useState<{ id: number; name: string; license_plate: string | null }[]>([]);
  const [journals, setJournals] = useState<{ id: number; name: string }[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");
  const [editingBooking, setEditingBooking] = useState(false);
  const [editingLineId, setEditingLineId] = useState<number | null>(null);
  const [lineEdit, setLineEdit] = useState({ quantity: "1", unit_price: "0", discount_percent: "0" });
  const [newProduct, setNewProduct] = useState("");
  const [newQuantity, setNewQuantity] = useState("1");
  const [discount, setDiscount] = useState("0");
  const [depositAmount, setDepositAmount] = useState("");
  const [paymentAmounts, setPaymentAmounts] = useState<Record<number, string>>({});
  const [paymentJournals, setPaymentJournals] = useState<Record<number, string>>({});
  const [paymentHistory, setPaymentHistory] = useState<Record<number, Payment[]>>({});
  const [expandedInvoiceId, setExpandedInvoiceId] = useState<number | null>(null);

  const loadQuotation = useCallback(async () => {
    const data = await apiFetch<Quotation>(`/sales/${rentalId}`);
    setQuotation(data);
  }, [rentalId]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      apiFetch<Quotation>(`/sales/${rentalId}`),
      apiFetch<{ cars: typeof cars }>("/cars"),
      apiFetch<{ journals: typeof journals }>("/invoices/payment-journals"),
      apiFetch<{ products: Product[] }>("/rentals/options"),
    ]).then(([quote, fleet, accounts, options]) => {
      if (!active) return;
      if (quote.status === "rejected") throw quote.reason;
      setQuotation(quote.value);
      if (fleet.status === "fulfilled") setCars(fleet.value.cars);
      if (accounts.status === "fulfilled") setJournals(accounts.value.journals);
      if (options.status === "fulfilled") setProducts(options.value.products);
      const unavailable = [fleet.status === "rejected" && "vehicle list", accounts.status === "rejected" && "payment accounts", options.status === "rejected" && "product options"].filter(Boolean);
      if (unavailable.length) setError(`This rental is available, but ${unavailable.join(", ")} could not load. Refresh to retry those options.`);
    }).catch((err: unknown) => {
      if (active) setError(err instanceof Error ? err.message : "Unable to load this rental.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [rentalId]);

  async function act(path: string, method = "POST", body?: unknown, message = "Saved in Odoo.") {
    if (busy) return;
    setBusy(path); setError(""); setNotice("");
    try {
      await apiFetch(path, { method, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
      if (path.endsWith("/payments")) setPaymentAmounts({});
      await loadQuotation();
      setPaymentHistory({}); setNotice(message); setEditingLineId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save this action.");
    } finally { setBusy(""); }
  }

  async function printDocument(path: string) {
    const tab = window.open("about:blank", "_blank");
    if (tab) tab.opener = null;
    try {
      const result = await apiFetch<{ url: string }>(path);
      if (tab) tab.location.href = result.url;
      else setError("Allow pop-ups to open the Odoo PDF, then select Print again.");
    } catch (err) {
      tab?.close(); setError(err instanceof Error ? err.message : "Unable to open the PDF.");
    }
  }

  async function toggleHistory(invoiceId: number) {
    if (expandedInvoiceId === invoiceId) { setExpandedInvoiceId(null); return; }
    try {
      const result = await apiFetch<{ payments: Payment[] }>(`/invoices/${invoiceId}/payments`);
      setPaymentHistory((current) => ({ ...current, [invoiceId]: result.payments }));
      setExpandedInvoiceId(invoiceId);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load payment history."); }
  }

  function addLine(event: FormEvent) {
    event.preventDefault();
    void act(`/sales/${rentalId}/lines`, "POST", { product_id: Number(newProduct), quantity: Number(newQuantity) });
  }

  if (loading) return <main className="mx-auto max-w-[1200px] p-5 sm:p-8"><p className="text-muted">Loading rental...</p></main>;
  if (!quotation) return <main className="p-8"><EmptyState icon={<FileText />} title="Rental not found" description={error || "This rental could not load."} /></main>;

  const vehicle = cars.find((car) => car.id === quotation.vehicle_id);
  const editable = ["draft", "sent"].includes(quotation.state);
  const cancelled = quotation.booking_status === "cancelled";
  const confirmed = quotation.booking_status === "confirmed";
  const paid = quotation.amount_paid;
  const requiredDeposit = Math.round(quotation.amount_total * 30) / 100;
  const depositRemaining = Math.max(0, Math.round((requiredDeposit - paid) * 100) / 100);
  const committed = paid > 0 && depositRemaining === 0;
  const printableInvoice = quotation.invoices.find(invoice => invoice.type === "out_invoice" && invoice.state === "posted");
  const fullyPaid = quotation.amount_total > 0 && quotation.amount_outstanding <= 0.01;
  const pendingInvoice = quotation.invoices.find((invoice) => invoice.draft && invoice.type === "out_invoice");
  const financeColor = fullyPaid ? "border-green-500/30 bg-green-500/10 text-green-400" : editable ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400" : "border-blue-500/30 bg-blue-500/10 text-blue-400";
  const nextStep = cancelled ? "Booking cancelled. Financial records remain available below."
    : quotation.returned ? "Rental completed. Review the balance and payment history below."
    : editable ? "Review, print or email the quotation. When the client agrees, confirm the quotation to prepare their deposit."
    : !confirmed && committed ? "30% commitment reached. Confirm the booking to secure the vehicle, then print the invoice."
    : pendingInvoice ? "Validate the draft invoice below, then record the amount actually received."
    : !confirmed ? `Reservation incomplete: ${formatCurrency(depositRemaining)} more is needed to reach the 30% deposit. Record the payment below.`
    : fullyPaid ? "Payment complete. Print the invoice and continue to pickup from the vehicle calendar."
    : "Reservation secured. Print the invoice, prepare pickup and collect the remaining balance when due.";
  const workflowStep = quotation.returned ? 6 : confirmed ? 5 : committed ? 4 : editable ? 2 : 3;
  const steps = ["Demand & client", "Rental requirements", "Quotation", "30% commitment", "Confirm booking", "Invoice & pickup", "Fulfilment"];


  return (
    <main className="mx-auto max-w-[1200px] p-5 sm:p-8">
      <Link href="/dashboard/rentals" className="mb-4 inline-flex items-center gap-2 text-sm text-muted hover:text-text"><ArrowLeft size={16} />Back to rentals</Link>
      <PageHeader breadcrumb="Rentals" title={quotation.customer?.name || quotation.name} subtitle={quotation.name} action={<StatusBadge meta={rentalStateMeta(getRentalState(quotation))} />} />
      {error && <div role="alert" className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">{error}</div>}
      {notice && <div role="status" className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-400">{notice}</div>}
      <nav aria-label="Booking progress" className="mt-5 rounded-xl border border-border p-4">
        <ol className="flex flex-wrap gap-2">{steps.map((step, index) => <li key={step} aria-current={index === workflowStep ? "step" : undefined} className={`rounded-lg px-3 py-2 text-sm ${index < workflowStep ? "bg-green-500/10 text-green-300" : index === workflowStep ? "bg-blue-500/20 font-semibold text-blue-200" : "text-text-secondary"}`}>{index < workflowStep ? "✓" : index + 1} {step}</li>)}</ol>
        <p className="mt-3 text-sm text-text-secondary">Progress is saved in Odoo. Resume here anytime, or use the actions below directly.</p>
      </nav>
      <section className={`mt-5 rounded-xl border p-5 ${financeColor}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="font-semibold">{cancelled ? "Cancelled" : fullyPaid ? "Paid" : editable ? "Quotation" : "Quotation confirmed"}</p><p className="mt-1 text-sm">{nextStep}</p></div>
          <span className={`rounded-full px-3 py-1 text-sm ${confirmed ? "bg-green-500/15 text-green-400" : "bg-zinc-500/20 text-zinc-300"}`}>{confirmed ? "Booking confirmed" : cancelled ? "Booking cancelled" : "Booking unconfirmed"}</span>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {printableInvoice && <button className="rounded-lg bg-blue-500 px-5 py-3 font-semibold text-white hover:bg-blue-400" onClick={() => printDocument(`/invoices/${printableInvoice.id}/print-link`)}>Print invoice · {printableInvoice.name}</button>}
          <a className={buttonClass} href="#follow-ups">Schedule call / email</a>
          <button className={buttonClass} onClick={() => printDocument(`/sales/${rentalId}/print-link`)}>Print quotation</button>
          {!cancelled && <button disabled={!!busy} className={buttonClass} onClick={() => { if (window.confirm("Send this quotation to the customer's saved Odoo email address?")) void act(`/sales/${rentalId}/send`, "POST", undefined, "Quotation sent through Odoo."); }}>Email quotation</button>}
          {!cancelled && <button disabled={!!busy} className={buttonClass} onClick={() => setEditingBooking(true)}>Edit booking</button>}
          {editable && <button disabled={!!busy || !quotation.lines.length} className={primaryClass} onClick={() => act(`/sales/${rentalId}/confirm`, "POST", undefined, "Quotation confirmed. Generate the invoice next.")}>Confirm quotation</button>}
          {!editable && !cancelled && quotation.amount_to_invoice > 0 && !pendingInvoice && <button disabled={!!busy} className={primaryClass} onClick={() => act(`/sales/${rentalId}/invoice`, "POST", undefined, "Invoice created. Validate it below to record payment.")}>Generate invoice</button>}
          {!cancelled && !confirmed && <button disabled={!!busy || !committed} title={!committed ? "Record at least 30% of the booking total first" : "Secure this paid reservation"} className={primaryClass} onClick={() => act(`/rentals/${rentalId}/confirm`, "POST", undefined, "Booking confirmed.")}>Confirm booking</button>}
          {!cancelled && <button disabled={!!busy} className={`${buttonClass} text-danger`} onClick={() => { if (window.confirm("Cancel this booking and mark its prospect as lost? Odoo will keep any financial records.")) void act(`/rentals/${rentalId}/cancel`, "POST", undefined, "Booking cancelled and removed from the calendar."); }}>Cancel booking</button>}
        </div>
        {!cancelled && !confirmed && <div className="mt-4 rounded-lg bg-black/20 p-4"><div className="flex flex-wrap justify-between gap-2 font-semibold"><span>Deposit target · 30%</span><span>{formatCurrency(paid)} / {formatCurrency(requiredDeposit)}</span></div><progress aria-label="Deposit progress" className="mt-2 h-3 w-full accent-green-400" value={Math.min(paid, requiredDeposit)} max={requiredDeposit || 1} /><p className="mt-2 text-sm">{committed ? "Ready to confirm the reservation." : `${formatCurrency(depositRemaining)} still required. This booking stays incomplete until the deposit is recorded and the reservation is confirmed.`}</p>{!editable && <a href="#payments" className="mt-3 inline-block rounded-lg bg-blue-500 px-4 py-2 font-semibold text-white">Continue to payment →</a>}</div>}
      </section>
      {!editable && !cancelled && quotation.amount_to_invoice > 0 && !pendingInvoice && <form className="mt-3 flex flex-wrap items-end gap-3 rounded-xl border border-border p-4" onSubmit={event => { event.preventDefault(); void act(`/sales/${rentalId}/invoice`, "POST", { deposit_amount: Number(depositAmount || Math.min(depositRemaining, quotation.amount_to_invoice)) }, "Deposit invoice created. Validate it below, then record the amount received."); }}>
        <label className="text-sm text-text-secondary">Invoice a deposit<input required type="number" min="0.01" max={quotation.amount_to_invoice} step="0.01" className={`${inputClass} ml-3 w-32`} value={depositAmount || String(Math.min(depositRemaining, quotation.amount_to_invoice))} onChange={event => setDepositAmount(event.target.value)} /></label><button disabled={!!busy} className={buttonClass}>Create deposit invoice</button><p className="text-sm text-muted">Suggested: the remaining 30% deposit. Odoo records advances on a deposit invoice before the final invoice.</p>
      </form>}
      {quotation.opportunity && <Link href={`/crm/leads/${quotation.opportunity.id}`} className="mt-4 inline-block text-sm text-lime">Open prospect & follow-ups →</Link>}
      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={<Receipt size={17} />} label="Total" value={formatCurrency(quotation.amount_total)} />
        <StatCard icon={<FileText size={17} />} label="Invoiced" value={formatCurrency(quotation.amount_invoiced)} tone="pink" />
        <StatCard icon={<Check size={17} />} label="Paid" value={formatCurrency(paid)} tone="lime" />
        <StatCard icon={<Receipt size={17} />} label="Outstanding" value={formatCurrency(quotation.amount_outstanding)} tone={quotation.amount_outstanding > 0 ? "danger" : "lime"} />
      </section>
      <section className="mt-4 grid min-w-0 gap-3 md:grid-cols-3">
        <Card className="min-w-0 p-5"><div className="flex items-center gap-2 text-sm text-muted"><User size={16} />Customer</div>{quotation.customer ? <Link href={`/dashboard/customers/${quotation.customer.id}`} className="mt-2 block break-words text-base font-medium text-text hover:text-lime">{quotation.customer.name}</Link> : <p className="mt-2 text-muted">—</p>}</Card>
        <Card className="min-w-0 p-5"><div className="flex items-center gap-2 text-sm text-muted"><Car size={16} />Vehicle</div><Link href={`/dashboard/calendar?vehicle=${quotation.vehicle_id}`} className="mt-2 block break-words text-base font-medium text-text hover:text-lime">{vehicle?.name || "—"} →</Link>{vehicle?.license_plate && <p className="mt-1 break-words text-sm text-muted">{vehicle.license_plate}</p>}</Card>
        <Card className="min-w-0 p-5"><div className="flex items-center gap-2 text-sm text-muted"><Calendar size={16} />Dates</div><dl className="mt-2 space-y-2 text-sm"><div><dt className="text-muted">Pickup</dt><dd className="break-words text-text">{formatDate(quotation.date_order)}</dd></div><div><dt className="text-muted">Return</dt><dd className="break-words text-text">{formatDate(quotation.commitment_date)}</dd></div></dl></Card>
      </section>
      <section className="mt-4"><Card>
        <CardHeader title="Quotation" subtitle={editable ? "Add products, adjust prices and discounts, then confirm." : "Quotation confirmed. Financial changes are protected after invoicing."} />
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead><tr className="border-b border-border text-muted"><th className="px-5 py-3">Item</th><th className="p-3">Qty</th><th className="p-3">Unit price</th><th className="p-3">Discount</th><th className="p-3 text-right">Total</th>{editable && <th className="p-3">Actions</th>}</tr></thead><tbody className="divide-y divide-border">
          {quotation.lines.map((line) => <tr key={line.id} className="text-text-secondary">
            <td className="max-w-[300px] break-words px-5 py-3 text-text">{line.description}</td>
            {(["quantity", "unit_price", "discount_percent"] as const).map((field) => <td key={field} className="p-3">{editingLineId === line.id ? <input aria-label={field.replaceAll("_", " ")} type="number" min={field === "quantity" ? "0.01" : "0"} max={field === "discount_percent" ? "100" : undefined} step="0.01" className={`${inputClass} w-24`} value={lineEdit[field]} onChange={(event) => setLineEdit({ ...lineEdit, [field]: event.target.value })} /> : field === "unit_price" ? formatCurrency(line.unit_price) : field === "discount_percent" ? `${line.discount_percent}%` : line.quantity}</td>)}
            <td className="p-3 text-right font-medium text-text">{formatCurrency(line.total)}</td>
            {editable && <td className="p-3"><div className="flex gap-2">{editingLineId === line.id ? <><button disabled={!!busy || !lineEdit.quantity || !lineEdit.unit_price || !lineEdit.discount_percent || Number(lineEdit.quantity) <= 0 || Number(lineEdit.unit_price) < 0 || Number(lineEdit.discount_percent) < 0 || Number(lineEdit.discount_percent) > 100} className={primaryClass} onClick={() => act(`/sales/${rentalId}/lines/${line.id}`, "PATCH", Object.fromEntries(Object.entries(lineEdit).map(([key, value]) => [key, Number(value)])))}>Save</button><button className={buttonClass} onClick={() => setEditingLineId(null)}>Cancel</button></> : <><button disabled={!!busy} className={buttonClass} onClick={() => { setEditingLineId(line.id); setLineEdit({ quantity: String(line.quantity), unit_price: String(line.unit_price), discount_percent: String(line.discount_percent) }); }}>Edit</button><button disabled={!!busy} className={`${buttonClass} text-danger`} onClick={() => act(`/sales/${rentalId}/lines/${line.id}`, "DELETE")}>Remove</button></>}</div></td>}
          </tr>)}
        </tbody></table></div>
        {editable && <div className="space-y-4 border-t border-border p-5">
          <form onSubmit={addLine} className="flex flex-wrap items-end gap-3"><label className="min-w-0 flex-1 text-sm text-muted">Odoo product<select required className={`${inputClass} mt-1 w-full`} value={newProduct} onChange={(event) => setNewProduct(event.target.value)}><option value="">Choose an item...</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label><label className="text-sm text-muted">Quantity<input required type="number" min="0.01" step="0.01" value={newQuantity} onChange={(event) => setNewQuantity(event.target.value)} className={`${inputClass} mt-1 block w-24`} /></label><button disabled={!!busy} className={primaryClass}>Add item</button></form>
          <form className="flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); if (window.confirm("Apply this percentage to every quotation line? This replaces existing line discounts.")) void act(`/sales/${rentalId}/discount`, "PATCH", { discount_percent: Number(discount) }); }}><label className="text-sm text-muted">Discount on total (%)<input required type="number" min="0" max="100" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} className={`${inputClass} mt-1 block w-28`} /></label><button disabled={!!busy} className={buttonClass}>Apply to all items</button><p className="text-sm text-muted">Replaces line discounts; Odoo recalculates taxes and total.</p></form>
        </div>}
        <div className="flex flex-wrap justify-end gap-5 border-t border-border px-5 py-4 text-sm text-muted"><span>Untaxed: {formatCurrency(quotation.amount_untaxed)}</span><span>Tax: {formatCurrency(quotation.amount_tax)}</span><strong className="text-text">Total: {formatCurrency(quotation.amount_total)}</strong></div>
      </Card></section>
      <section id="payments" className="mt-6 scroll-mt-5 rounded-xl border border-blue-400/40 bg-blue-500/5"><Card><CardHeader title="Invoices & payments" subtitle="Validate the invoice, record each instalment, then print the final invoice." />
        {!quotation.invoices.length && <div className="p-6"><EmptyState icon={<Receipt />} title="No invoice yet" description={editable ? "Confirm the quotation above to generate an invoice." : "Generate the invoice above to record payment."} /></div>}
        {quotation.invoices.map((invoice) => <div key={invoice.id} className="border-t border-border p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="break-words text-base font-medium text-text">{invoice.name || "Draft invoice"}{invoice.type === "out_refund" ? " · Credit note" : ""}</p><p className="mt-1 text-sm text-muted">{formatDate(invoice.date)}{invoice.due_date ? ` · Due ${formatDate(invoice.due_date)}` : ""}</p></div><span className={`rounded-full px-3 py-1 text-sm ${invoice.draft ? "bg-yellow-500/10 text-yellow-400" : invoice.outstanding <= 0.01 ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400"}`}>{invoice.draft ? "Draft · validate next" : invoice.payment_status === "in_payment" ? "Payment recorded · clearing" : invoice.outstanding <= 0.01 ? "Paid" : invoice.paid > 0 ? "Partly paid" : "Confirmed · awaiting payment"}</span></div>
          <div className="mt-4 grid gap-3 text-lg font-semibold text-text sm:grid-cols-3"><span>Total: {formatCurrency(invoice.total)}</span><span>Paid: {formatCurrency(invoice.paid)}</span><span>Outstanding: {formatCurrency(invoice.outstanding)}</span></div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {invoice.type === "out_invoice" && <button className="rounded-lg bg-blue-500 px-5 py-3 font-semibold text-white hover:bg-blue-400" onClick={() => printDocument(`/invoices/${invoice.id}/print-link`)}>Print invoice</button>}
            {invoice.draft && invoice.type === "out_invoice" && <button disabled={!!busy} className={primaryClass} onClick={() => act(`/invoices/${invoice.id}/post`, "POST", undefined, "Invoice validated. Record payment below.")}>Validate invoice</button>}
          </div>
          {!invoice.draft && invoice.type === "out_invoice" && invoice.outstanding > 0 && <form className="mt-4 flex flex-wrap items-end gap-3" onSubmit={(event) => { event.preventDefault(); const amount = Number(paymentAmounts[invoice.id]); if (window.confirm(`Record ${formatCurrency(amount)} as received from the customer?`)) void act(`/invoices/${invoice.id}/payments`, "POST", { amount, journal_id: Number(paymentJournals[invoice.id]) }, "Payment recorded in Odoo. Balances updated."); }}>
            <label className="font-medium text-text">Amount received<input required aria-label="Amount received" type="number" min="0.01" max={invoice.outstanding} step="0.01" className={`${inputClass} mt-1 block w-36`} value={paymentAmounts[invoice.id] || ""} onChange={(event) => setPaymentAmounts({ ...paymentAmounts, [invoice.id]: event.target.value })} /></label>
            <button type="button" className={buttonClass} onClick={() => setPaymentAmounts({ ...paymentAmounts, [invoice.id]: String(invoice.outstanding) })}>Full balance</button>
            <label className="min-w-0 font-medium text-text">Received into<select required className={`${inputClass} mt-1 block max-w-full`} value={paymentJournals[invoice.id] || ""} onChange={(event) => setPaymentJournals({ ...paymentJournals, [invoice.id]: event.target.value })}><option value="">Select account...</option>{journals.map((journal) => <option key={journal.id} value={journal.id}>{journal.name}</option>)}</select></label>
            <button disabled={!!busy} className={primaryClass}>Record payment</button>
          </form>}
          <button className="mt-4 text-sm text-muted underline hover:text-text" onClick={() => toggleHistory(invoice.id)}>{expandedInvoiceId === invoice.id ? "Hide" : "View"} payment history</button>
          {expandedInvoiceId === invoice.id && <div className="mt-2 space-y-2 rounded-lg bg-surface-secondary p-3 text-sm text-muted">{!paymentHistory[invoice.id]?.length ? "No payments recorded yet." : paymentHistory[invoice.id].map((payment, index) => <div key={index} className="flex flex-wrap justify-between gap-2"><span>{formatDate(payment.date)} · {payment.reference}</span><span>{formatCurrency(payment.amount)}</span></div>)}</div>}
        </div>)}
      </Card></section>
      <div id="follow-ups" className="mt-5 scroll-mt-5"><ActivitiesPanel saleId={rentalId} /></div>
      {quotation.customer && quotation.vehicle_id && <CreateRentalModal open={editingBooking} onClose={() => setEditingBooking(false)} rentalId={rentalId} initialRental={{ partner_id: quotation.customer.id, vehicle_id: quotation.vehicle_id, start_date: (quotation.date_order || "").slice(0, 10) || "", end_date: (quotation.commitment_date || "").slice(0, 10) || "", products: quotation.lines.filter((line) => line.product && !line.is_downpayment && line.quantity > 0).map((line) => ({ product_id: line.product!.id, quantity: line.quantity, unit_price: line.unit_price, discount_percent: line.discount_percent, line_id: line.id })) }} onCreated={() => { setEditingBooking(false); void loadQuotation().catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to refresh the booking.")); }} />}
    </main>
  );
}
