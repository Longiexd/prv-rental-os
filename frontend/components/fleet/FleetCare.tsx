"use client";

import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { apiFetch } from "@/lib/api";
import { useKlynxUI } from "@/components/providers/UIProvider";
import DocumentsPanel from "@/components/ui/DocumentsPanel";

type Plan = { next_odometer: number | null; next_date: string | null; reminder_distance: number };
type Alert = { kind: string; reason: string; severity: "danger" | "warning"; date: string | null; remaining?: number | null };
type Document = { kind: string; id: number | null; expiry_date: string | null; status: string };
type Vehicle = { id: number; name: string; plate: string; state: string; odometer: number; unit: string; plan: Plan | null; alerts: Alert[]; documents: Document[]; missing_count: number };
type Data = { vehicles: Vehicle[] };
export function prioritizedVehicles(vehicles: Vehicle[]) {
  const priority = (vehicle: Vehicle) => vehicle.alerts.some(alert => alert.severity === "danger") ? 0 : vehicle.alerts.length ? 1 : 2;
  return [...vehicles].sort((a, b) => priority(a) - priority(b) || (a.plate || a.name).localeCompare(b.plate || b.name));
}
function primaryAlert(vehicle: Vehicle) {
  return vehicle.alerts.find(alert => alert.severity === "danger") || vehicle.alerts[0];
}
function needsToday(vehicle: Vehicle) {
  return vehicle.alerts.some(alert => alert.severity === "danger" || alert.reason === "uploaded" || alert.reason === "date_missing");
}
const Context = createContext<{ data: Data | null; error: boolean; reload: () => Promise<void> }>({ data: null, error: false, reload: async () => {} });
const changedEvent = "klynx-fleet-care-changed";
export function notifyFleetCareChanged() { window.dispatchEvent(new Event(changedEvent)); }

export function FleetCareProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const mounted = useRef(false);
  const reload = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try { const result = await apiFetch<Data>("/cars/care"); if (mounted.current) { setData(result); setError(false); } }
    catch { if (mounted.current) setError(true); }
    finally { pending.current = false; }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const refresh = () => { if (document.visibilityState === "visible") void reload(); };
    refresh();
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    window.addEventListener(changedEvent, refresh);
    return () => { mounted.current = false; clearInterval(interval); window.removeEventListener("focus", refresh); window.removeEventListener(changedEvent, refresh); };
  }, [reload]);
  return <Context.Provider value={{ data, error, reload }}>{children}</Context.Provider>;
}

function useWords() {
  const { locale, t } = useKlynxUI();
  const fr = locale === "fr";
  const text = (en: string, french: string) => fr ? french : en;
  const kind = (value: string) => ({ insurance: text("Insurance", "Assurance"), registration: text("Registration", "Carte grise"), technical_inspection: text("Technical inspection", "Visite technique"), lease: text("Lease contract", "Contrat de leasing"), service_contract: text("Service contract", "Contrat de service"), oil_change: text("Oil change", "Vidange"), documents: text("Documents", "Documents") }[value] || value);
  const reason = (value: string) => ({ missing: text("Scan missing", "Document manquant"), expired: text("Expired — renew", "Expiré — à renouveler"), uploaded: text("Awaiting verification", "À vérifier"), renewal: text("Renewal due soon", "Renouvellement à prévoir"), date_missing: text("Add expiry date", "Renseigner la date de fin"), due: text("Due now", "Échéance atteinte"), soon: text("Due soon", "Échéance proche"), review: text("Stored information needs review", "Informations enregistrées à vérifier") }[value] || value);
  return { text, kind, reason, t };
}

export function VehicleAttentionBadge({ vehicleId }: { vehicleId: number }) {
  const { data, error } = useContext(Context);
  const { text } = useWords();
  const vehicle = data?.vehicles.find(item => item.id === vehicleId);
  if (error) return <span data-i18n-ignore="true" className="text-xs text-muted" title={text("Fleet alerts could not refresh", "Impossible d’actualiser les alertes du parc")}>?</span>;
  if (!vehicle?.alerts.length) return null;
  const danger = vehicle.alerts.some(alert => alert.severity === "danger");
  return <span data-i18n-ignore="true" className={`ml-2 inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] ${danger ? "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]" : "bg-[var(--status-reserved-bg)] text-[var(--status-reserved-text)]"}`} title={text(`${vehicle.missing_count} missing documents; ${vehicle.alerts.length} fleet alerts`, `${vehicle.missing_count} documents manquants ; ${vehicle.alerts.length} alertes du parc`)}><span aria-hidden="true">●</span>{vehicle.alerts.length}<span className="sr-only">{text("Fleet alerts", "Alertes du parc")}</span></span>;
}

function AlertRow({ alert, vehicle }: { alert: Alert; vehicle: Vehicle }) {
  const { kind, reason, text } = useWords();
  const unit = vehicle.unit === "miles" ? "mi" : "km";
  return <div className={`rounded-lg border px-3 py-2 text-sm ${alert.severity === "danger" ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]" : "border-[var(--status-reserved-border)] bg-[var(--status-reserved-bg)] text-[var(--status-reserved-text)]"}`}>
    <strong>{kind(alert.kind)}</strong><span> · {reason(alert.reason)}</span>
    {alert.date && <span> · {alert.date}</span>}
    {alert.remaining != null && <span> · {Math.max(0, Math.round(alert.remaining))} {unit} {text("remaining", "restants")}</span>}
  </div>;
}

export function FleetCareSummary() {
  const { data, error, reload } = useContext(Context);
  const { text, kind, reason } = useWords();
  const vehicles = prioritizedVehicles(data?.vehicles.filter(vehicle => vehicle.alerts.length) || []);
  const today = vehicles.filter(needsToday);
  const upcoming = vehicles.filter(vehicle => !today.includes(vehicle));
  return <section data-i18n-ignore="true" className="os-card mt-8 rounded-2xl border border-border bg-surface p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-text">{text("Fleet care & renewals", "Suivi du parc et renouvellements")}</h2><p className="text-sm text-text-secondary">{text("Vehicle documents, insurance and maintenance — separate from customer follow-ups.", "Documents des véhicules, assurances et entretien — séparés du suivi client.")}</p></div><Link href="/dashboard/fleet-care" className="rounded-lg border border-border px-3 py-2 text-sm text-text">{text("View fleet care", "Voir le suivi du parc")} →</Link></div>
    {error ? <p role="alert" className="mt-4 text-danger">{text("Fleet alerts could not refresh.", "Impossible d’actualiser les alertes du parc.")} <button onClick={() => void reload()} className="underline">{text("Retry", "Réessayer")}</button></p> : !data ? <p className="mt-4 text-muted">{text("Loading…", "Chargement…")}</p> : !vehicles.length ? <p className="mt-4 text-text-secondary">{text("No document or scheduled maintenance alerts.", "Aucune alerte documentaire ou d’entretien programmé.")}</p> : <>
      <div className="mt-4 flex flex-wrap gap-4 text-sm"><span className="font-medium text-text">{text("Look into today", "À vérifier aujourd’hui")} · {today.length}</span><span className="text-text-secondary">{text("Upcoming renewals / service", "Renouvellements / entretien à prévoir")} · {upcoming.length}</span></div>
      <div className="mt-3 space-y-2">{vehicles.slice(0, 3).map(vehicle => <Link key={vehicle.id} href={`/dashboard/fleet-care#vehicle-${vehicle.id}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:bg-surface-secondary"><span className="font-medium text-text">{vehicle.plate || vehicle.name}<VehicleAttentionBadge vehicleId={vehicle.id} /></span><span className="text-sm text-text-secondary">{kind(primaryAlert(vehicle).kind)} · {reason(primaryAlert(vehicle).reason)} →</span></Link>)}</div>
      {vehicles.length > 3 && <p className="mt-3 text-sm text-muted">{text(`${vehicles.length - 3} more vehicles in fleet care.`, `${vehicles.length - 3} autres véhicules dans le suivi du parc.`)}</p>}
    </>}
  </section>;
}

export function MaintenanceEditor({ vehicle }: { vehicle: Vehicle }) {
  const { text } = useWords();
  const { reload } = useContext(Context);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const unit = vehicle.unit === "miles" ? "mi" : "km";
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    const fields = new FormData(event.currentTarget);
    const target = String(fields.get("next_odometer") || "");
    try {
      await apiFetch(`/cars/${vehicle.id}/maintenance-plan`, { method: "PUT", body: JSON.stringify({ next_odometer: target === "" ? null : Number(target), next_date: fields.get("next_date") || null, reminder_distance: Number(fields.get("reminder_distance")) }) });
      await reload(); setMessage(text("Maintenance reminder saved.", "Rappel d’entretien enregistré."));
    } catch { setMessage(text("Could not save. Check the values and your permissions.", "Enregistrement impossible. Vérifiez les valeurs et vos droits.")); }
    finally { pending.current = false; setBusy(false); }
  }
  const input = "mt-1 w-full rounded-lg border border-border bg-surface-secondary px-3 py-2 text-text";
  return <form data-i18n-ignore="true" onSubmit={event => void save(event)} className="mt-5 rounded-xl border border-border p-4">
    <h3 className="font-semibold text-text">{text("Next oil change", "Prochaine vidange")}</h3><p className="mt-1 text-sm text-text-secondary">{text(`Current odometer: ${vehicle.odometer} ${unit}. Set a target reading, a date, or both. After service, save the next target. Clear both to disable.`, `Compteur actuel : ${vehicle.odometer} ${unit}. Renseignez un kilométrage cible, une date, ou les deux. Après la vidange, enregistrez la prochaine échéance. Effacez les deux pour désactiver.`)}</p>
    <fieldset disabled={busy} className="mt-3 grid gap-3 sm:grid-cols-3" key={JSON.stringify(vehicle.plan)}><label className="text-sm text-text">{text("Target odometer", "Kilométrage cible")} ({unit})<input className={input} name="next_odometer" type="number" min="0" max="100000000" step="any" defaultValue={vehicle.plan?.next_odometer ?? ""} /></label><label className="text-sm text-text">{text("Target date", "Date cible")}<input className={input} name="next_date" type="date" defaultValue={vehicle.plan?.next_date ?? ""} /></label><label className="text-sm text-text">{text("Remind before", "Rappel avant")} ({unit})<input className={input} name="reminder_distance" type="number" min="0" max="1000000" step="any" required defaultValue={vehicle.plan?.reminder_distance ?? 500} /></label><button className="rounded-lg border border-border bg-surface-secondary px-3 py-2 text-sm text-text" type="submit">{busy ? text("Saving…", "Enregistrement…") : text("Save reminder", "Enregistrer le rappel")}</button></fieldset>{message && <p role="status" className="mt-3 text-sm text-text">{message}</p>}
  </form>;
}

export default function FleetCarePage() {
  const { data, error, reload } = useContext(Context);
  const { text, kind, t } = useWords();
  const [filter, setFilter] = useState("attention");
  const [search, setSearch] = useState("");
  const states = Object.entries((data?.vehicles || []).reduce<Record<string, number>>((counts, vehicle) => {
    const state = vehicle.state || text("Unspecified state", "État non renseigné");
    counts[state] = (counts[state] || 0) + 1;
    return counts;
  }, {}));
  const vehicles = prioritizedVehicles(data?.vehicles.filter(v => (!search || `${v.name} ${v.plate}`.toLowerCase().includes(search.toLowerCase())) &&
    (filter === "all" || filter === "today" && needsToday(v) || filter === "upcoming" && v.alerts.length && !needsToday(v) || filter === "attention" && v.alerts.length || filter === "documents" && v.alerts.some(a => a.kind !== "oil_change") || filter === "maintenance" && v.alerts.some(a => a.kind === "oil_change"))) || []);
  return <main className="mx-auto max-w-[1500px] p-5 sm:p-8"><header data-i18n-ignore="true"><h1 className="text-2xl font-semibold text-text">{text("Fleet care & renewals", "Suivi du parc et renouvellements")}</h1><p className="mt-2 text-text-secondary">{text("Upload the document, enter its expiry date, then verify it. Renewal reminders start one month before expiry. Replace the scan and date after renewal; the old version stays archived.", "Ajoutez le document, sa date de fin, puis vérifiez-le. Les rappels commencent un mois avant l’échéance. Après renouvellement, remplacez le fichier et la date ; l’ancienne version reste archivée.")}</p><p className="mt-2 text-sm text-muted">{text("Lease and service contracts are optional. Reminders appear here and on the dashboard; they are not email or push notifications.", "Les contrats de leasing et de service sont facultatifs. Les rappels apparaissent ici et sur le tableau de bord ; ils ne sont pas envoyés par e-mail ou notification push.")}</p></header>
    {data && <div data-i18n-ignore="true" className="mt-5 flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 text-sm text-text-secondary"><strong className="text-text">{text("Fleet overview", "Vue du parc")} · {data.vehicles.length}</strong>{states.map(([state, count]) => <span key={state}>{t(state)} · {count}</span>)}<Link href="/dashboard/fleet" className="ml-auto text-text underline">{text("Open vehicles", "Voir les véhicules")} →</Link></div>}
    <div data-i18n-ignore="true" className="my-5 flex flex-wrap gap-2">{[["attention", text("Needs attention", "À traiter")], ["today", text("Today", "Aujourd’hui")], ["upcoming", text("Upcoming", "À prévoir")], ["documents", text("Documents & renewals", "Documents et renouvellements")], ["maintenance", text("Maintenance", "Entretien")], ["all", text("All vehicles", "Tous les véhicules")]].map(([key, label]) => <button key={key} onClick={() => setFilter(key)} aria-pressed={filter === key} className={`rounded-lg border px-3 py-2 text-sm ${filter === key ? "border-[var(--status-available-border)] bg-[var(--status-available-bg)] text-[var(--status-available-text)]" : "border-border text-text"}`}>{label}</button>)}<input value={search} onChange={event => setSearch(event.target.value)} aria-label={text("Search vehicles", "Rechercher des véhicules")} placeholder={text("Search name or plate…", "Rechercher un nom ou une immatriculation…")} className="rounded-lg border border-border bg-surface px-3 py-2 text-text" /><button onClick={() => void reload()} className="rounded-lg border border-border px-3 py-2 text-text">{text("Refresh", "Actualiser")}</button></div>
    {error && <p data-i18n-ignore="true" role="alert" className="mb-4 text-danger">{text("Fleet information could not refresh. Retry before relying on these reminders.", "Impossible d’actualiser le parc. Réessayez avant de vous fier à ces rappels.")}</p>}
    {!data ? <p data-i18n-ignore="true" className="text-muted">{text("Loading…", "Chargement…")}</p> : !vehicles.length ? <p data-i18n-ignore="true" className="text-text-secondary">{text("No vehicles in this view. Use All vehicles to set up documents and maintenance.", "Aucun véhicule dans cette vue. Choisissez Tous les véhicules pour renseigner les documents et l’entretien.")}</p> : <div className="space-y-4">{vehicles.map(vehicle => <section key={vehicle.id} id={`vehicle-${vehicle.id}`} className="os-card scroll-mt-24 rounded-2xl border border-border bg-surface p-5">
      <div data-i18n-ignore="true" className="mb-3"><h2 className="font-semibold text-text">{vehicle.name}<VehicleAttentionBadge vehicleId={vehicle.id} /></h2><p className="text-sm text-text-secondary">{vehicle.plate} · {t(vehicle.state)} · {vehicle.odometer} {vehicle.unit === "miles" ? "mi" : "km"}</p></div><div data-i18n-ignore="true" className="grid gap-2 sm:grid-cols-2">{vehicle.alerts.map((alert, i) => <AlertRow key={`${alert.kind}-${alert.reason}-${i}`} alert={alert} vehicle={vehicle} />)}</div>
      <div data-i18n-ignore="true" className="mt-3 flex flex-wrap gap-3 text-xs text-text-secondary">{vehicle.documents.filter(doc => doc.id && doc.expiry_date).map(doc => <span key={doc.kind}>{kind(doc.kind)} · {text("Expires", "Fin de validité")} {doc.expiry_date}</span>)}</div>
      <details className="mt-4"><summary data-i18n-ignore="true" className="cursor-pointer font-medium text-text">{text("Manage documents, contracts and maintenance", "Gérer les documents, contrats et l’entretien")}</summary><DocumentsPanel owner="cars" recordId={vehicle.id} onChanged={notifyFleetCareChanged} /><MaintenanceEditor vehicle={vehicle} /></details>
    </section>)}</div>}
  </main>;
}
