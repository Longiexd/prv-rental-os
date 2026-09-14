"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Check, Plus } from "lucide-react";
import { activityRequest, activityHref, noteText, type Activity } from "./api";

type Option = { id: number; name: string; category?: string };
const input = "w-full rounded-lg border border-[#3f3f46] bg-[#17171A] px-3 py-2.5 text-sm text-white";

export default function ActivitiesPanel({ leadId, saleId, compact = false, onCompleted }: {
  leadId?: number; saleId?: number; compact?: boolean; onCompleted?: () => void;
}) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filter, setFilter] = useState(compact ? "due" : "all");
  const [open, setOpen] = useState(false);
  const [types, setTypes] = useState<Option[]>([]);
  const [leads, setLeads] = useState<Option[]>([]);
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const load = useCallback(async () => {
    try {
      const result = await activityRequest<{ activities: Activity[] }>(`/activities${leadId ? `?lead_id=${leadId}` : saleId ? `?sale_id=${saleId}` : ""}`);
      setActivities(result.activities);
      setError("");
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load activities."); }
    finally { setLoading(false); }
  }, [leadId, saleId]);
  useEffect(() => {
    let active = true;
    activityRequest<{ activities: Activity[] }>(`/activities${leadId ? `?lead_id=${leadId}` : saleId ? `?sale_id=${saleId}` : ""}`)
      .then(result => { if (active) {
        setActivities(result.activities); setError("");
        const id = Number(new URLSearchParams(window.location.search).get("activity"));
        if (id > 0) setSelected(id);
      } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : "Unable to load activities."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [leadId, saleId]);

  async function startCreate() {
    setBusy(true);
    setError("");
    try {
      const [available, prospects] = await Promise.all([
        activityRequest<{ types: Option[] }>(`/activities/types?res_model=${saleId ? "sale.order" : "crm.lead"}`),
        (leadId || saleId) ? Promise.resolve({ leads: [] as Option[] }) : activityRequest<{ leads: Option[] }>("/crm/leads"),
      ]);
      setTypes(available.types); setLeads(prospects.leads); setOpen(true);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to load activity options."); }
    finally { setBusy(false); }
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true); setError(""); setNotice("");
    try {
      await activityRequest("/activities", { method: "POST", body: JSON.stringify({
        ...(saleId ? { sale_id: saleId } : { lead_id: leadId || Number(data.get("lead")) }), activity_type_id: Number(data.get("type")),
        summary: data.get("summary"), date_deadline: data.get("date"), note: data.get("note"),
      }) });
      setOpen(false); setNotice("Activity scheduled. It is also visible in the calendar."); await load();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to schedule activity."); }
    finally { setBusy(false); }
  }

  async function complete(id: number) {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await activityRequest<{ warning?: string }>(`/activities/${id}/complete`, {
        method: "POST", body: JSON.stringify({ feedback }),
      });
      setNotice(result.warning || "Activity completed. Continue from the linked record.");
      setSelected(null); setFeedback(""); await load(); onCompleted?.();
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to complete activity."); }
    finally { setBusy(false); }
  }

  const due = activities.filter(item => ["today", "overdue"].includes(item.state));
  const filtered = activities.filter(item => filter === "all" || (filter === "due" ? ["today", "overdue"].includes(item.state) : item.state === filter));
  const visible = compact ? filtered.slice(0, 5) : filtered;
  return (
    <section className="space-y-4 rounded-2xl border border-purple-400/25 bg-[#111114] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-lg font-semibold text-white">To do <span className="text-purple-300">{due.length} due</span></h2>
          <p className="mt-1 text-sm text-[#A1A1AA]">Schedule a call or email reminder, then continue from the linked record.</p></div>
        <button type="button" disabled={busy} onClick={startCreate} className="inline-flex items-center gap-2 rounded-lg bg-purple-400/15 px-4 py-2.5 text-sm text-purple-200 disabled:opacity-50"><Plus size={16} /> Schedule activity</button>
      </div>
      {error && <p role="alert" className="text-sm text-red-300">{error} <button type="button" onClick={load} className="underline">Refresh</button></p>}
      {notice && <p role="status" className="rounded-lg bg-emerald-400/10 p-3 text-sm text-emerald-200">{notice}</p>}
      <p className="text-sm text-purple-200">Email activities remind an agent to send the email; they do not send it automatically.</p>
      {open && <form onSubmit={create} className="grid gap-4 rounded-xl border border-purple-400/25 p-4 sm:grid-cols-2">
        {!leadId && !saleId && <label className="space-y-1 text-sm text-[#A1A1AA]">Prospect<select name="lead" required className={input} defaultValue=""><option value="" disabled>Select prospect</option>{leads.map(lead => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select></label>}
        <label className="space-y-1 text-sm text-[#A1A1AA]">Activity<select name="type" required className={input} defaultValue={types.find(type => type.category === "phonecall")?.id || ""}><option value="" disabled>Select activity type</option>{types.map(type => <option key={type.id} value={type.id}>{type.name}</option>)}</select></label>
        <label className="space-y-1 text-sm text-[#A1A1AA]">Due date<input name="date" type="date" required className={input} /></label>
        <label className="space-y-1 text-sm text-[#A1A1AA]">Title<input name="summary" required maxLength={250} placeholder={saleId ? "Email invoice to customer" : "Call Mariem about her booking"} className={input} /></label>
        <label className="space-y-1 text-sm text-[#A1A1AA] sm:col-span-2">Notes / instructions<textarea name="note" maxLength={10000} rows={3} className={input} /></label>
        <div className="flex gap-3 sm:col-span-2"><button disabled={busy} className="rounded-lg bg-purple-300 px-4 py-2.5 text-sm font-semibold text-black disabled:opacity-50">{busy ? "Saving…" : "Save activity"}</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="text-sm text-[#A1A1AA]">Cancel</button></div>
      </form>}
      <div className="flex flex-wrap gap-2">{[["all", "All"], ["due", "Due now"], ["today", "Today"], ["overdue", "Overdue"], ["planned", "Upcoming"]].map(([value, label]) => <button key={value} type="button" onClick={() => setFilter(value)} className={`rounded-lg px-3 py-2 text-sm ${filter === value ? "bg-purple-400/20 text-purple-200" : "text-[#A1A1AA] hover:bg-white/5"}`}>{label}</button>)}</div>
      {loading ? <p className="text-sm text-[#A1A1AA]">Loading activities…</p> : !visible.length && !error ? <p className="text-sm text-[#A1A1AA]">No activities in this view. Schedule the next follow-up above.</p> : visible.map(item => (
        <article key={item.id} className={`rounded-xl border p-4 ${item.state === "overdue" ? "border-red-400/30 bg-red-400/5" : item.state === "today" ? "border-amber-400/30 bg-amber-400/5" : "border-purple-400/25 bg-purple-400/5"}`}>
          <button type="button" onClick={() => { setSelected(selected === item.id ? null : item.id); setFeedback(""); }} className="flex w-full flex-wrap items-center justify-between gap-2 text-left">
            <span className="font-medium text-white">{item.summary || (item.activity_type_id && item.activity_type_id[1]) || "Follow up"} · {item.res_name}</span>
            <span className={`text-sm ${item.state === "overdue" ? "text-red-300" : item.state === "today" ? "text-amber-300" : "text-purple-300"}`}>{item.date_deadline} · {item.state}</span>
          </button>
          {selected === item.id && <div className="mt-3 space-y-3">
            <p className="whitespace-pre-wrap break-words text-sm text-[#D4D4D8]">{noteText(item.note) || "No instructions yet."}</p>
            <div className="flex flex-wrap justify-between gap-2 text-sm"><Link href={activityHref(item)} className="text-purple-200 underline">Open {item.res_model === "sale.order" ? "booking" : "prospect"} →</Link><span className="text-[#A1A1AA]">Assigned to {item.user_id ? item.user_id[1] : "—"}</span></div>
            <label className="block space-y-1 text-sm text-[#A1A1AA]">Outcome / call notes<textarea value={feedback} onChange={event => setFeedback(event.target.value)} maxLength={10000} rows={2} className={input} /></label>
            {item.res_model !== "sale.order" && item.activity_category === "phonecall" && <p className="text-sm text-[#A1A1AA]">Completing the call moves an earlier prospect to Contacté when that stage is configured.</p>}
            <button type="button" disabled={busy} onClick={() => complete(item.id)} className="inline-flex items-center gap-2 rounded-lg bg-emerald-400/15 px-4 py-2.5 text-sm text-emerald-200 disabled:opacity-50"><Check size={16} /> {busy ? "Saving…" : "Mark done"}</button>
          </div>}
        </article>
      ))}
      {compact && <Link href="/dashboard/activities" className="inline-block text-sm text-purple-200 underline">View all activities ({activities.length}) →</Link>}
    </section>
  );
}
