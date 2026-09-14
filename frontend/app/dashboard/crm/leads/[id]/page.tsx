"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ActivitiesPanel from "@/components/activities/ActivitiesPanel";
import { activityRequest, noteText } from "@/components/activities/api";
import { PageHeader } from "@/components/ui/PageHeader";
import CreateRentalModal from "@/components/rentals/CreateRentalModal";
import { formatCurrency } from "@/lib/format";

type Prospect = {
  id: number; name: string; partner_id: [number, string] | false; phone: string | false;
  mobile: string | false; email_from: string | false; stage_id: [number, string] | false;
  description: string | false; expected_revenue: number;
  rentals: { id: number; name: string; state: string; amount_total: number }[];
};

export default function ProspectPage() {
  const { id } = useParams<{ id: string }>();
  const [lead, setLead] = useState<Prospect | null>(null);
  const [error, setError] = useState("");
  const [creatingBooking, setCreatingBooking] = useState(false);
  const load = useCallback(async () => {
    try { setLead(await activityRequest<Prospect>(`/crm/leads/${id}`)); setError(""); }
    catch (err) { setError(err instanceof Error ? err.message : "Unable to load prospect."); }
  }, [id]);
  useEffect(() => {
    let active = true;
    activityRequest<Prospect>(`/crm/leads/${id}`)
      .then(result => { if (active) { setLead(result); setError(""); } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load prospect."); });
    return () => { active = false; };
  }, [id]);
  return <main className="mx-auto max-w-[1400px] space-y-6 p-5 sm:p-8">
    <Link href="/crm/leads" className="text-sm text-[#A1A1AA] hover:text-white">← All prospects</Link>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    {!lead ? <p className="text-[#A1A1AA]">{error ? "Prospect unavailable." : "Loading prospect…"}</p> : <>
      <PageHeader breadcrumb="CRM / Prospect" title={lead.name} subtitle={lead.stage_id ? lead.stage_id[1] : "No stage"} action={<button onClick={() => setCreatingBooking(true)} className="rounded-lg bg-lime px-4 py-2 text-sm font-medium text-background">Prepare quotation</button>} />
      <section className="grid gap-5 rounded-2xl border border-[#2B2B30] bg-[#111114] p-5 sm:grid-cols-3">
        <div className="min-w-0"><p className="text-sm text-[#A1A1AA]">Customer</p><p className="mt-1 break-words font-medium text-white">{lead.partner_id ? lead.partner_id[1] : lead.name}</p></div>
        <div className="min-w-0"><p className="text-sm text-[#A1A1AA]">Phone</p><p className="mt-1 break-words text-white">{lead.phone || lead.mobile || "—"}</p></div>
        <div className="min-w-0"><p className="text-sm text-[#A1A1AA]">Email</p><p className="mt-1 break-words text-white">{lead.email_from || "—"}</p></div>
        <div className="sm:col-span-3"><h2 className="font-semibold text-white">Prospect notes</h2><p className="mt-2 whitespace-pre-wrap break-words text-[#D4D4D8]">{noteText(lead.description) || "No notes available."}</p></div>
      </section>
      <div className="flex flex-wrap gap-4 text-sm">
        {lead.partner_id && <Link href={`/dashboard/customers/${lead.partner_id[0]}`} className="text-lime">Open customer →</Link>}
        {(lead.phone || lead.mobile) && <a href={`tel:${lead.phone || lead.mobile}`} className="text-lime">Call prospect</a>}
        {lead.email_from && <a href={`mailto:${lead.email_from}`} className="text-lime">Email prospect</a>}
      </div>
      <section className="rounded-xl border border-border bg-surface p-5"><h2 className="font-semibold text-text">Quotations & bookings</h2><p className="mt-1 text-sm text-text-secondary">Continue from quotation to invoice and payment in the booking card.</p>
        {lead.rentals?.length ? lead.rentals.map(rental => <Link key={rental.id} href={`/dashboard/rentals/${rental.id}`} className="mt-3 flex flex-wrap justify-between gap-2 rounded-lg bg-surface-secondary p-3 text-sm text-text hover:text-lime"><span>{rental.name} · {rental.state === "cancel" ? "Cancelled" : ["draft", "sent"].includes(rental.state) ? "Quotation" : "Sales order"}</span><span>{formatCurrency(rental.amount_total)} →</span></Link>) : <p className="mt-3 text-sm text-muted">No quotation yet. Prepare one above.</p>}
      </section>
      <ActivitiesPanel key={lead.id} leadId={lead.id} onCompleted={load} />
      <CreateRentalModal open={creatingBooking} onClose={() => setCreatingBooking(false)} opportunityId={lead.id} customerId={lead.partner_id ? lead.partner_id[0] : null} initialCustomerName={lead.name} />
    </>}
  </main>;
}
