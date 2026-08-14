"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight,
  LayoutGrid,
  List,
  Mail,
  Phone,
  Plus,
  Search,
  TrendingUp,
  UserRound,
} from "lucide-react";

// =========================================================
// TYPES
// =========================================================

type Lead = {
  id: number;
  name: string;
  customer: { id: number; name: string } | null;
  phone: string | null;
  email: string | null;
  stage: string | null;
  stage_id: number | null;
  expected_revenue: number;
  created: string | null;
};

type Stage = {
  id: number;
  name: string;
  sequence: number;
};

type View = "list" | "kanban";

// =========================================================
// CONFIG
// =========================================================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

// =========================================================
// PAGE
// =========================================================

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<View>("list");

  // =========================================================
  // LOAD LEADS + STAGES
  // =========================================================

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [leadsResponse, stagesResponse] = await Promise.all([
        fetch(`${API_URL}/crm/leads`, { cache: "no-store" }),
        fetch(`${API_URL}/crm/stages`, { cache: "no-store" }),
      ]);

      if (!leadsResponse.ok) {
        throw new Error(`Leads API returned ${leadsResponse.status}`);
      }

      if (!stagesResponse.ok) {
        throw new Error(`Stages API returned ${stagesResponse.status}`);
      }

      const leadsData = await leadsResponse.json();
      const stagesData = await stagesResponse.json();

      setLeads(leadsData.leads || []);
      setStages(stagesData.stages || []);
    } catch (err) {
      console.error("Failed to load CRM data:", err);
      setError("Unable to load CRM data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =========================================================
  // MOVE LEAD TO A NEW STAGE (kanban drag & drop)
  // =========================================================

  async function moveLeadToStage(leadId: number, stageId: number, stageName: string) {
    // Optimistic update so the drag feels instant.
    setLeads((prev) =>
      prev.map((lead) =>
        lead.id === leadId
          ? { ...lead, stage_id: stageId, stage: stageName }
          : lead
      )
    );

    try {
      const response = await fetch(
        `${API_URL}/crm/leads/${leadId}/stage`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage_id: stageId }),
        }
      );

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }
    } catch (err) {
      console.error("Failed to update lead stage:", err);
      // Re-sync with the server since the optimistic update
      // may no longer reflect reality.
      loadData();
    }
  }

  // =========================================================
  // FILTER
  // =========================================================

  const filteredLeads = leads.filter((lead) => {
    const query = search.toLowerCase();

    return (
      lead.name?.toLowerCase().includes(query) ||
      lead.customer?.name?.toLowerCase().includes(query) ||
      lead.phone?.toLowerCase().includes(query) ||
      lead.email?.toLowerCase().includes(query) ||
      lead.stage?.toLowerCase().includes(query)
    );
  });

  // =========================================================
  // STATS
  // =========================================================

  const totalRevenue = leads.reduce(
    (sum, lead) => sum + (lead.expected_revenue || 0),
    0
  );

  const activeLeads = leads.filter(
    (lead) =>
      lead.stage &&
      !["won", "lost", "gagné", "perdu"].includes(
        lead.stage.toLowerCase()
      )
  ).length;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="min-h-screen p-6 lg:p-8">

      {/* HEADER */}

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-zinc-500">
            <span>CRM</span>
            <span>/</span>
            <span className="text-zinc-300">Leads</span>
          </div>

          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Leads
          </h1>

          <p className="mt-1 text-sm text-zinc-500">
            Manage potential customers and rental opportunities.
          </p>
        </div>

        <button className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#C8F065] px-4 text-sm font-semibold text-black transition hover:bg-[#b8df55]">
          <Plus size={17} />
          New Lead
        </button>
      </div>

      {/* STATS */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              Total Leads
            </span>

            <TrendingUp size={18} className="text-[#C8F065]" />
          </div>

          <div className="text-3xl font-semibold text-white">
            {loading ? "—" : leads.length}
          </div>

          <div className="mt-1 text-xs text-zinc-600">
            CRM opportunities
          </div>
        </div>

        <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              Active Leads
            </span>

            <UserRound size={18} className="text-[#F06AAA]" />
          </div>

          <div className="text-3xl font-semibold text-white">
            {loading ? "—" : activeLeads}
          </div>

          <div className="mt-1 text-xs text-zinc-600">
            Open opportunities
          </div>
        </div>

        <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-zinc-500">
              Expected Revenue
            </span>

            <ArrowUpRight size={18} className="text-[#C8F065]" />
          </div>

          <div className="text-3xl font-semibold text-white">
            {loading
              ? "—"
              : `${totalRevenue.toLocaleString()} TND`}
          </div>

          <div className="mt-1 text-xs text-zinc-600">
            Total pipeline value
          </div>
        </div>

      </div>

      {/* TOOLBAR */}

      <div className="mb-4 flex items-center gap-3">

        <div className="relative flex-1">
          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search leads..."
            className="h-10 w-full rounded-xl border border-[#2B2B30] bg-[#111113] pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#C8F065]"
          />
        </div>

        <div className="flex h-10 items-center rounded-xl border border-[#2B2B30] bg-[#111113] p-1">
          <button
            onClick={() => setView("list")}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
              view === "list"
                ? "bg-[#C8F065] text-black"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <List size={14} />
            List
          </button>

          <button
            onClick={() => setView("kanban")}
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
              view === "kanban"
                ? "bg-[#C8F065] text-black"
                : "text-zinc-500 hover:text-white"
            }`}
          >
            <LayoutGrid size={14} />
            Kanban
          </button>
        </div>

      </div>

      {/* ERROR */}

      {error && (
        <div className="mb-4 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* VIEWS */}

      {view === "list" ? (
        <LeadsTable leads={filteredLeads} loading={loading} />
      ) : (
        <LeadsKanban
          leads={filteredLeads}
          stages={stages}
          loading={loading}
          onMoveLead={moveLeadToStage}
        />
      )}

    </main>
  );
}

// =========================================================
// LIST VIEW
// =========================================================

function LeadsTable({
  leads,
  loading,
}: {
  leads: Lead[];
  loading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113]">

      <div className="overflow-x-auto">

        <table className="w-full min-w-[850px]">

          <thead>
            <tr className="border-b border-[#2B2B30] text-left text-xs uppercase tracking-wider text-zinc-600">
              <th className="px-5 py-4 font-medium">
                Lead
              </th>

              <th className="px-5 py-4 font-medium">
                Customer
              </th>

              <th className="px-5 py-4 font-medium">
                Contact
              </th>

              <th className="px-5 py-4 font-medium">
                Stage
              </th>

              <th className="px-5 py-4 text-right font-medium">
                Expected Revenue
              </th>
            </tr>
          </thead>

          <tbody>

            {loading ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-zinc-600"
                >
                  Loading leads...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-zinc-600"
                >
                  No leads found.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr
                  key={lead.id}
                  className="border-b border-[#2B2B30] last:border-0 transition hover:bg-[#17171A]"
                >

                  <td className="px-5 py-4">
                    <div className="font-medium text-white">
                      {lead.name}
                    </div>

                    <div className="mt-1 text-xs text-zinc-600">
                      #{lead.id}
                    </div>
                  </td>

                  <td className="px-5 py-4 text-sm text-zinc-300">
                    {lead.customer?.name || "—"}
                  </td>

                  <td className="px-5 py-4">

                    {lead.phone && (
                      <div className="flex items-center gap-2 text-xs text-zinc-400">
                        <Phone size={13} />
                        {lead.phone}
                      </div>
                    )}

                    {lead.email && (
                      <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                        <Mail size={13} />
                        {lead.email}
                      </div>
                    )}

                  </td>

                  <td className="px-5 py-4">

                    <span className="inline-flex rounded-full border border-[#2B2B30] bg-[#17171A] px-2.5 py-1 text-xs text-zinc-300">
                      {lead.stage || "No Stage"}
                    </span>

                  </td>

                  <td className="px-5 py-4 text-right text-sm font-medium text-white">
                    {(lead.expected_revenue || 0).toLocaleString()} TND
                  </td>

                </tr>
              ))
            )}

          </tbody>

        </table>

      </div>

    </div>
  );
}

// =========================================================
// KANBAN VIEW
// =========================================================

function LeadsKanban({
  leads,
  stages,
  loading,
  onMoveLead,
}: {
  leads: Lead[];
  stages: Stage[];
  loading: boolean;
  onMoveLead: (leadId: number, stageId: number, stageName: string) => void;
}) {
  const [dragLeadId, setDragLeadId] = useState<number | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<number | null>(null);

  const leadsByStage = useMemo(() => {
    const map = new Map<number, Lead[]>();

    for (const stage of stages) {
      map.set(stage.id, []);
    }

    // Leads with no stage_id (shouldn't normally happen, but
    // the API can return one) get bucketed separately below.
    for (const lead of leads) {
      if (lead.stage_id && map.has(lead.stage_id)) {
        map.get(lead.stage_id)!.push(lead);
      }
    }

    return map;
  }, [leads, stages]);

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] px-5 py-16 text-center text-sm text-zinc-600">
        Loading pipeline...
      </div>
    );
  }

  if (stages.length === 0) {
    return (
      <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] px-5 py-16 text-center text-sm text-zinc-600">
        No CRM stages configured in Odoo.
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {stages.map((stage) => {
        const stageLeads = leadsByStage.get(stage.id) || [];
        const isDragOver = dragOverStageId === stage.id;

        return (
          <div
            key={stage.id}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStageId(stage.id);
            }}
            onDragLeave={() => setDragOverStageId(null)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOverStageId(null);

              if (dragLeadId != null) {
                onMoveLead(dragLeadId, stage.id, stage.name);
              }

              setDragLeadId(null);
            }}
            className={`flex w-72 shrink-0 flex-col rounded-2xl border bg-[#111113] transition ${
              isDragOver
                ? "border-[#C8F065]/50 bg-[#C8F065]/[0.03]"
                : "border-[#2B2B30]"
            }`}
          >
            <div className="flex items-center justify-between border-b border-[#2B2B30] px-4 py-3">
              <span className="text-xs font-semibold text-white">
                {stage.name}
              </span>
              <span className="rounded-full bg-[#17171A] px-2 py-0.5 text-[10px] text-zinc-500">
                {stageLeads.length}
              </span>
            </div>

            <div className="flex flex-1 flex-col gap-2 p-3">
              {stageLeads.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#2B2B30] px-3 py-6 text-center text-[11px] text-zinc-600">
                  No leads
                </div>
              )}

              {stageLeads.map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => setDragLeadId(lead.id)}
                  onDragEnd={() => setDragLeadId(null)}
                  className="cursor-grab rounded-xl border border-[#2B2B30] bg-[#17171A] p-3 transition hover:border-[#3b3b42] active:cursor-grabbing"
                >
                  <div className="text-xs font-medium text-white">
                    {lead.name}
                  </div>

                  {lead.customer?.name && (
                    <div className="mt-1 text-[11px] text-zinc-500">
                      {lead.customer.name}
                    </div>
                  )}

                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-600">
                      #{lead.id}
                    </span>

                    <span className="text-[11px] font-medium text-[#C8F065]">
                      {(lead.expected_revenue || 0).toLocaleString()} TND
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}