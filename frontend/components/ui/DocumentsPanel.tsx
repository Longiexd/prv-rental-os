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

export default function DocumentsPanel({ owner, recordId }: { owner: "customers" | "cars"; recordId: number }) {
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
        const bytes = new Uint8Array(await file.arrayBuffer());
        let binary = "";
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        await apiFetch(path, { method: "POST", body: JSON.stringify({ kind: document.kind, filename: file.name,
          content: btoa(binary), number, expiry_date }) });
        setNotice("Document uploaded. Review it, then mark it verified. Earlier versions remain in Odoo.");
      } else if (document.id) {
        await apiFetch(`${path}/${document.id}`, { method: "PATCH", body: JSON.stringify({ number, expiry_date,
          verified: fields.get("verified") === "on" }) });
        setNotice("Document checklist updated.");
      } else throw new Error("Choose a document to upload first.");
      // A successful save is kept even if the following refresh fails.
      form.reset(); setChecklist(null); setRevision(value => value + 1);
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

  return <section className="mt-6 rounded-xl border border-border bg-surface p-5" aria-label={owner === "customers" ? "Customer documents" : "Vehicle documents"}>
    <h2 className="font-semibold text-text">{owner === "customers" ? "Documents before pickup" : "Vehicle documents"}</h2>
    <p className={`mt-1 text-sm ${checklist?.ready ? "text-[var(--status-available-text)]" : "text-muted"}`}>
      {!checklist ? "Loading document checklist…" : checklist.ready ? (owner === "customers" ? "Client documents ready for pickup." : "Vehicle documents verified.")
        : "Review missing, unverified or expired documents before pickup."}
    </p>
    <p className="mt-1 text-xs text-muted">PDF, PNG or JPEG · maximum 600 KiB per file. Uploads require a separate verification.</p>
    {error && <p role="alert" className="mt-3 text-sm text-[var(--status-danger-text)]">{error} <button className={button} disabled={busy} onClick={() => { setError(""); setRevision(value => value + 1); }}>Refresh</button></p>}
    {notice && <p role="status" className="mt-3 text-sm text-text">{notice}</p>}
    <div className="mt-4 grid gap-4">
      {checklist?.documents.map(document => <form key={`${document.kind}-${document.id}-${revision}`} onSubmit={event => void save(event, document)} className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium text-text">{document.label}</h3>
          <span className={`text-sm ${document.status === "verified" ? "text-[var(--status-available-text)]" : document.status === "expired" ? "text-[var(--status-danger-text)]" : "text-muted"}`}>{document.status}</span></div>
        <fieldset disabled={busy} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-text">Document number<input name="number" maxLength={100} defaultValue={document.number} className={input} /></label>
          <label className="text-sm text-text">Expiry date (optional)<input name="expiry_date" type="date" defaultValue={document.expiry_date || ""} className={input} /></label>
          <label className="text-sm text-text sm:col-span-2">{document.id ? "Replace scan (optional)" : "Upload scan"}<input name="file" type="file" accept="application/pdf,image/png,image/jpeg" className={input} /></label>
          {document.id && <label className="flex items-center gap-2 text-sm text-text"><input name="verified" type="checkbox" defaultChecked={document.verified} />Verified by agent</label>}
          <div className="flex flex-wrap gap-2 sm:col-span-2"><button className={button} type="submit">{busy ? "Please wait…" : "Save document"}</button>
            {document.id && <button className={button} type="button" onClick={() => void download(document)}>Download / review</button>}</div>
        </fieldset>
      </form>)}
    </div>
  </section>;
}
