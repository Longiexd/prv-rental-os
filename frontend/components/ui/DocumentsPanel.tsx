"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { apiFetch } from "@/lib/api";

type TrackedDocument = {
  id: number | null; kind: string; label: string; filename: string | null;
  status: "missing" | "uploaded" | "verified" | "expired";
  number: string; expiry_date: string | null; verified: boolean;
};
type Checklist = { documents: TrackedDocument[]; ready: boolean };
const input = "w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text";
const button = "rounded-lg border border-border px-3 py-2 text-sm text-text hover:bg-surface-secondary disabled:opacity-50";

export type PaperworkStatus = { documents_ready: boolean; contract_current: boolean; contract_ready: boolean; contract_id: number | null; snapshot_ids: number[]; details: Record<string, string> };
type Template = { mode: "basic" | "image"; background: string | null; mime?: string; terms: string; positions: Record<string, { x: number; y: number; width: number; size: number }>; fields: Record<string, string> };

async function encodedFile(file: File) {
  if (file.size > 600 * 1024) throw new Error("Compress the scan to 600 KiB or less.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}

export function PaperworkPanel({ rentalId, customerId, confirmed, collected, status, refresh }: {
  rentalId: number; customerId: number; confirmed: boolean; collected: boolean; status: PaperworkStatus | null; refresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [error, setError] = useState("");
  const [template, setTemplate] = useState<Template | null>(null);
  const [selectedField, setSelectedField] = useState("customer");
  const [editedDetails, setDetails] = useState<Record<string, string> | null>(null);
  const details = editedDetails || status?.details || {};

  async function perform(operation: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    try { await operation(); await refresh(); }
    catch (err) { setError(err instanceof Error ? err.message : "Paperwork could not be saved."); }
    finally { pending.current = false; setBusy(false); }
  }

  function openContract() {
    if (pending.current) return;
    const tab = window.open("about:blank", "_blank");
    if (!tab) { setError("Allow pop-ups to print the contract."); return; }
    tab.opener = null;
    void perform(async () => {
      try {
        const result = collected
          ? await apiFetch<{ html: string }>(`/sales/${rentalId}/contract`)
          : await apiFetch<{ html: string }>(`/sales/${rentalId}/contract/prepare`, { method: "POST", body: JSON.stringify({ details }) });
        const url = URL.createObjectURL(new Blob([result.html], { type: "text/html;charset=utf-8" }));
        tab.location.href = url; setTimeout(() => URL.revokeObjectURL(url), 300000);
      } catch (err) { tab.close(); throw err; }
    });
  }

  return <section id="paperwork" className="mt-6 scroll-mt-5 rounded-xl border border-border bg-surface p-5">
    <h2 className="font-semibold text-text">Paperwork before handing over the keys</h2>
    <p className="mt-2 text-sm text-text-secondary">1. Review identity and licence. 2. Prepare and print the contract. 3. Confirm it is ready, then validate actual pickup.</p>
    {!confirmed && <p className="mt-2 text-sm text-muted">You can collect documents now. Record a payment and confirm the booking to prepare its contract.</p>}
    {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    <DocumentsPanel owner="customers" recordId={customerId} onChanged={() => void refresh().catch(err => setError(String(err)))} />
    {Boolean(status?.snapshot_ids.length) && <DocumentsPanel key={status?.contract_id} owner="sales" recordId={rentalId} />}
    <div className="mt-4 rounded-lg border border-border p-4">
      <h3 className="font-medium text-text">Rental contract</h3>
      <p className={`mt-1 text-sm ${status?.contract_ready ? "text-[var(--status-available-text)]" : "text-danger"}`}>
        {!status ? "Checking paperwork…" : !status.documents_ready ? "Identity or licence still missing, unverified or expired." : status.contract_ready ? "Contract ready. You can hand over the keys at actual pickup." : status.contract_current ? "Contract prepared. Print/save it and confirm below." : "Prepare the contract using the verified documents."}
      </p>
      {!collected && <details className="mt-3 text-sm text-text-secondary"><summary className="cursor-pointer">Optional contract details</summary><div className="mt-3 grid gap-3 sm:grid-cols-2">
        {Object.entries({birth_date: "Date of birth", nationality: "Nationality", license_issued: "Licence issue date", driver: "Additional driver", driver_identity: "Additional driver identity", driver_license: "Additional driver licence", deposit: "Security deposit (caution)", fuel: "Pickup fuel", notes: "Contract notes"}).map(([key, label]) => <label key={key}>{label}<input className={input} maxLength={key === "notes" ? 2000 : 250} value={details[key] || ""} onChange={event => setDetails({...details, [key]: event.target.value})} /></label>)}
      </div></details>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={button} disabled={busy || !confirmed || (!collected && !status?.documents_ready) || (collected && !status?.contract_id)} onClick={openContract}>{collected ? "View / print saved contract" : "Prepare / Print rental contract"}</button>
        {!collected && status?.contract_current && !status.contract_ready && <button className={`${button} bg-lime/15`} disabled={busy} onClick={() => void perform(async () => {
          await apiFetch(`/sales/${rentalId}/contract/printed`, {method: "POST", body: JSON.stringify({contract_id: status.contract_id})});
        })}>I printed / saved this contract</button>}
      </div>
    </div>
    {!collected && <details className="mt-4 text-sm text-text-secondary" onToggle={event => {
      if (event.currentTarget.open && !template) void perform(async () => { setTemplate(await apiFetch<Template>(`/sales/${rentalId}/contract/template`)); });
    }}><summary className="cursor-pointer font-medium text-text">Company contract template · setup once</summary>
      <p className="mt-2">Use a straight blank A4 portrait scan or a Canva PNG/JPEG export (600 KiB maximum). Select each field and click its blank position. This company template applies to future contracts; saved rental contracts stay unchanged.</p>
      {template && <div className="mt-3 space-y-3">
        <label>Template style<select className={input} value={template.mode} onChange={event => setTemplate({...template, mode: event.target.value as Template["mode"]})}><option value="basic">Basic bilingual form</option><option value="image">Scanned / Canva form</option></select></label>
        {template.mode === "image" && <>
          <label>Blank form image<input type="file" accept="image/png,image/jpeg" className={input} disabled={busy} onChange={event => {
            const file = event.target.files?.[0]; if (file) void perform(async () => setTemplate({...template, background: await encodedFile(file), mime: file.type, positions: {}}));
          }} /></label>
          <label>Field to place<select className={input} value={selectedField} onChange={event => setSelectedField(event.target.value)}>{Object.entries(template.fields).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          {template.background && <div className="relative aspect-[210/297] w-full max-w-xl cursor-crosshair border border-border bg-white text-black" role="img" aria-label="Contract template field placement" onClick={event => {
            const rect = event.currentTarget.getBoundingClientRect(); const x = Math.min(75, Math.max(0, (event.clientX - rect.left) / rect.width * 100));
            const y = Math.min(97, Math.max(0, (event.clientY - rect.top) / rect.height * 100));
            setTemplate({...template, positions: {...template.positions, [selectedField]: {x, y, width: 25, size: 10}}});
          }}>
            {/* A data image is restricted to the upload's bounded PNG/JPEG payload. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`data:${template.mime || "image/png"};base64,${template.background}`} alt="Blank agency contract" className="absolute inset-0 h-full w-full" />
            {Object.entries(template.positions).map(([key, position]) => <span key={key} className="pointer-events-none absolute overflow-hidden bg-yellow-100/90 text-[10px]" style={{left: `${position.x}%`, top: `${position.y}%`, width: `${position.width}%`}}>{template.fields[key]}</span>)}
          </div>}
          <div className="grid gap-2 sm:grid-cols-2">{Object.entries(template.positions).map(([key, position]) => <div key={key} className="rounded border border-border p-2">
            <p>{template.fields[key]} <button className="text-danger underline" onClick={() => { const positions = {...template.positions}; delete positions[key]; setTemplate({...template, positions}); }}>Remove</button></p>
            {(["x", "y", "width", "size"] as const).map(property => <label className="mr-2 inline-flex items-center gap-1" key={property}>{property}<input aria-label={`${template.fields[key]} ${property}`} type="number" step={property === "size" ? 1 : 0.1} className="w-16 rounded border border-border bg-surface-secondary p-1 text-text" value={position[property]} onChange={event => setTemplate({...template, positions: {...template.positions, [key]: {...position, [property]: Number(event.target.value)}}})} /></label>)}
          </div>)}</div>
        </>}
        <label>Company conditions (plain text; printed on the following page)<textarea className={input} maxLength={12000} value={template.terms} onChange={event => setTemplate({...template, terms: event.target.value})} /></label>
        <button className={button} disabled={busy} onClick={() => void perform(async () => { await apiFetch(`/sales/${rentalId}/contract/template`, {method: "PUT", body: JSON.stringify(template)}); })}>Save company template</button>
      </div>}
    </details>}
  </section>;
}

export default function DocumentsPanel({ owner, recordId, onChanged }: { owner: "customers" | "cars" | "sales"; recordId: number; onChanged?: () => void }) {
  const path = `/${owner}/${recordId}/documents`;
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let active = true;
    apiFetch<Checklist>(path).then(data => { if (active) setChecklist(data); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : "Documents could not load."); });
    return () => { active = false; };
  }, [path, revision]);

  async function save(event: FormEvent<HTMLFormElement>, document: TrackedDocument) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(""); setNotice("");
    const form = event.currentTarget;
    const fields = new FormData(form);
    const file = fields.get("file") as File | null;
    const number = String(fields.get("number") || "").trim();
    const expiry_date = String(fields.get("expiry_date") || "") || null;
    try {
      if (file?.size) {
        if (file.size > 600 * 1024) throw new Error("Compress the document to 600 KiB or less before uploading.");
        const content = await encodedFile(file);
        await apiFetch(path, { method: "POST", body: JSON.stringify({ kind: document.kind, filename: file.name,
          content, number, expiry_date }) });
        setNotice("Document uploaded. Review it, then mark it verified. Earlier versions remain in Odoo.");
      } else if (document.id) {
        await apiFetch(`${path}/${document.id}`, { method: "PATCH", body: JSON.stringify({ number, expiry_date,
          verified: fields.get("verified") === "on" }) });
        setNotice("Document checklist updated.");
      } else throw new Error("Choose a document to upload first.");
      // A successful save is kept even if the following refresh fails.
      form.reset(); setChecklist(null); setRevision(value => value + 1); onChanged?.();
    } catch (err) { setError(err instanceof Error ? err.message : "Document could not be saved."); }
    finally { pending.current = false; setBusy(false); }
  }

  async function download(document: TrackedDocument) {
    if (pending.current || !document.id) return;
    pending.current = true; setBusy(true); setError("");
    try {
      const result = await apiFetch<{ content: string; mime: string; filename: string }>(`${path}/${document.id}/download`);
      const bytes = Uint8Array.from(atob(result.content), character => character.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
      const link = window.document.createElement("a"); link.href = url; link.download = result.filename;
      link.click(); setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (err) { setError(err instanceof Error ? err.message : "Document could not be downloaded."); }
    finally { pending.current = false; setBusy(false); }
  }

  return <section className="mt-6 rounded-xl border border-border bg-surface p-5" aria-label={owner === "sales" ? "Rental document copies" : owner === "customers" ? "Customer documents" : "Vehicle documents"}>
    <h2 className="font-semibold text-text">{owner === "sales" ? "Documents saved with this rental" : owner === "customers" ? "Documents before pickup" : "Vehicle documents"}</h2>
    {owner === "customers" && <p className="mt-1 text-sm text-text-secondary">Verify either CIN or passport, plus the driving licence. These scans stay on the customer and can be reused for later rentals.</p>}
    <p className={`mt-1 text-sm ${checklist?.ready ? "text-[var(--status-available-text)]" : "text-muted"}`}>
      {!checklist ? "Loading document checklist…" : owner === "sales" ? "Copies retained with this rental. Customer originals can be updated separately." : checklist.ready ? (owner === "customers" ? "Client documents ready for pickup." : "Vehicle documents verified.")
        : "Review missing, unverified or expired documents before pickup."}
    </p>
    <p className="mt-1 text-xs text-muted">PDF, PNG or JPEG · maximum 600 KiB per file. Uploads require a separate verification.</p>
    {error && <p role="alert" className="mt-3 text-sm text-[var(--status-danger-text)]">{error} <button className={button} disabled={busy} onClick={() => { setError(""); setRevision(value => value + 1); }}>Refresh</button></p>}
    {notice && <p role="status" className="mt-3 text-sm text-text">{notice}</p>}
    <div className="mt-4 grid gap-4">
      {checklist?.documents.filter(document => owner !== "sales" || document.id).map(document => <form key={`${document.kind}-${document.id}-${revision}`} onSubmit={event => void save(event, document)} className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium text-text">{document.label}</h3>
          <span className={`text-sm ${document.status === "verified" ? "text-[var(--status-available-text)]" : document.status === "expired" ? "text-[var(--status-danger-text)]" : "text-muted"}`}>{document.status}</span></div>
        {owner !== "sales" && <fieldset disabled={busy} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-text">Document number<input name="number" maxLength={100} defaultValue={document.number} className={input} /></label>
          <label className="text-sm text-text">Expiry date (optional)<input name="expiry_date" type="date" defaultValue={document.expiry_date || ""} className={input} /></label>
          <label className="text-sm text-text sm:col-span-2">{document.id ? "Replace scan (optional)" : "Upload scan"}<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" className={input} /></label>
          {document.id && <label className="flex items-center gap-2 text-sm text-text"><input name="verified" type="checkbox" defaultChecked={document.verified} />Verified by agent</label>}
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button className={button} type="submit">{busy ? "Please wait…" : "Save document"}</button>
            {document.id && <button className={button} type="button" onClick={() => void download(document)}>Download / review</button>}</div>
        </fieldset>}
        {owner === "sales" && document.id && <button disabled={busy} className={`${button} mt-3`} type="button" onClick={() => void download(document)}>Download rental copy · {document.number}</button>}
      </form>)}
    </div>
  </section>;
}
