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

import AddLeadModal from "@/components/crm/AddLeadModal";

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
// API
// =========================================================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

// =========================================================
// STAGE COLORS
// =========================================================

function getStageColors(stageName: string | null) {
  const stage = (stageName || "").trim().toLowerCase();

  // =========================================================
  // NEW LEAD — PINK
  // =========================================================

  if (
    stage === "new lead" ||
    stage === "new" ||
    stage === "nouveau" ||
    stage === "nouvelle" ||
    stage === "nouveau prospect"
  ) {
    return {
      dot: "bg-[#F06AAA]",
      text: "text-[#F06AAA]",
      tag: "border-[#F06AAA]/30 bg-[#F06AAA]/10",
      count: "bg-[#F06AAA]/10 text-[#F06AAA]",
    };
  }

  // =========================================================
  // CONTACTÉ — VIOLET
  // =========================================================

  if (
    stage === "contacté" ||
    stage === "contacte" ||
    stage === "contacted"
  ) {
    return {
      dot: "bg-[#A78BFA]",
      text: "text-[#A78BFA]",
      tag: "border-[#A78BFA]/30 bg-[#A78BFA]/10",
      count: "bg-[#A78BFA]/10 text-[#A78BFA]",
    };
  }

  // =========================================================
  // DEVIS ENVOYÉ — ORANGE
  // =========================================================

  if (
    stage === "devis envoyé" ||
    stage === "devis envoye" ||
    stage === "quotation sent"
  ) {
    return {
      dot: "bg-[#FB923C]",
      text: "text-[#FB923C]",
      tag: "border-[#FB923C]/30 bg-[#FB923C]/10",
      count: "bg-[#FB923C]/10 text-[#FB923C]",
    };
  }

  // =========================================================
  // RÉSERVATION CONFIRMÉE — GREEN
  // =========================================================

  if (
    stage === "réservation confirmée" ||
    stage === "reservation confirmée" ||
    stage === "reservation confirmee" ||
    stage === "reservation confirmed"
  ) {
    return {
      dot: "bg-[#C8F065]",
      text: "text-[#C8F065]",
      tag: "border-[#C8F065]/30 bg-[#C8F065]/10",
      count: "bg-[#C8F065]/10 text-[#C8F065]",
    };
  }

  // =========================================================
  // VÉHICULE REMIS — BLUE
  // =========================================================

  if (
    stage === "véhicule remis" ||
    stage === "vehicule remis" ||
    stage === "vehicle delivered"
  ) {
    return {
      dot: "bg-[#60A5FA]",
      text: "text-[#60A5FA]",
      tag: "border-[#60A5FA]/30 bg-[#60A5FA]/10",
      count: "bg-[#60A5FA]/10 text-[#60A5FA]",
    };
  }

  // =========================================================
  // WON / GAGNÉ — GREEN
  // =========================================================

  if (
    stage === "won" ||
    stage === "gagné" ||
    stage === "gagne"
  ) {
    return {
      dot: "bg-[#C8F065]",
      text: "text-[#C8F065]",
      tag: "border-[#C8F065]/30 bg-[#C8F065]/10",
      count: "bg-[#C8F065]/10 text-[#C8F065]",
    };
  }

  // =========================================================
  // LOST / PERDU — RED
  // =========================================================

  if (
    stage === "lost" ||
    stage === "perdu"
  ) {
    return {
      dot: "bg-[#EF4444]",
      text: "text-[#EF4444]",
      tag: "border-[#EF4444]/30 bg-[#EF4444]/10",
      count: "bg-[#EF4444]/10 text-[#EF4444]",
    };
  }

  // =========================================================
  // FALLBACK
  // =========================================================

  return {
    dot: "bg-[#A1A1AA]",
    text: "text-[#A1A1AA]",
    tag: "border-[#2B2B30] bg-[#17171A]",
    count: "bg-[#17171A] text-[#71717A]",
  };
}

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

  const [addLeadOpen, setAddLeadOpen] = useState(false);

  // =========================================================
  // LOAD DATA FROM ODOO / API
  // =========================================================

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      const [
        leadsResponse,
        stagesResponse,
      ] = await Promise.all([
        fetch(`${API_URL}/crm/leads`, {
          cache: "no-store",
        }),

        fetch(`${API_URL}/crm/stages`, {
          cache: "no-store",
        }),
      ]);

      if (!leadsResponse.ok) {
        throw new Error(
          `Leads API returned ${leadsResponse.status}`
        );
      }

      if (!stagesResponse.ok) {
        throw new Error(
          `Stages API returned ${stagesResponse.status}`
        );
      }

      const leadsData = await leadsResponse.json();
      const stagesData = await stagesResponse.json();

      setLeads(
        Array.isArray(leadsData.leads)
          ? leadsData.leads
          : []
      );

      setStages(
        Array.isArray(stagesData.stages)
          ? stagesData.stages
          : []
      );
    } catch (err) {
      console.error(
        "Failed to load CRM data:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load CRM data."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // =========================================================
  // MOVE LEAD BETWEEN ODOO STAGES
  // =========================================================

  async function moveLeadToStage(
    leadId: number,
    stageId: number,
    stageName: string
  ) {
    const previousLeads = leads;

    // Optimistic UI update
    setLeads((current) =>
      current.map((lead) =>
        lead.id === leadId
          ? {
              ...lead,
              stage_id: stageId,
              stage: stageName,
            }
          : lead
      )
    );

    try {
      const response = await fetch(
        `${API_URL}/crm/leads/${leadId}/stage`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            stage_id: stageId,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(
          `Stage API returned ${response.status}`
        );
      }
    } catch (err) {
      console.error(
        "Failed to update lead stage:",
        err
      );

      // Restore previous state
      setLeads(previousLeads);

      setError(
        "Unable to update lead stage."
      );
    }
  }

  // =========================================================
  // SEARCH
  // =========================================================

  const filteredLeads = leads.filter(
    (lead) => {
      const query = search
        .toLowerCase()
        .trim();

      if (!query) {
        return true;
      }

      return (
        lead.name
          ?.toLowerCase()
          .includes(query) ||

        lead.customer?.name
          ?.toLowerCase()
          .includes(query) ||

        lead.phone
          ?.toLowerCase()
          .includes(query) ||

        lead.email
          ?.toLowerCase()
          .includes(query) ||

        lead.stage
          ?.toLowerCase()
          .includes(query)
      );
    }
  );

  // =========================================================
  // STATS
  // =========================================================

  const totalRevenue = leads.reduce(
    (sum, lead) =>
      sum +
      (Number(
        lead.expected_revenue
      ) || 0),
    0
  );

  const activeLeads = leads.filter(
    (lead) => {
      if (!lead.stage) {
        return true;
      }

      const stage =
        lead.stage.toLowerCase();

      return ![
        "won",
        "lost",
        "gagné",
        "gagne",
        "perdu",
      ].includes(stage);
    }
  ).length;

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <main className="min-h-screen p-5 sm:p-7 lg:p-8">

      {/* =====================================================
          HEADER
      ===================================================== */}

      <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] text-[#71717A]">
            <span>CRM</span>
            <span>/</span>
            <span className="text-[#A1A1AA]">
              Leads
            </span>
          </div>

          <h1 className="font-[Syne] text-3xl font-semibold tracking-tight text-white">
            Leads
          </h1>

          <p className="mt-1 text-sm text-[#71717A]">
            Manage potential customers and rental opportunities.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setAddLeadOpen(true)
          }
          className="flex h-10 items-center justify-center gap-2 rounded-xl bg-[#C8F065] px-4 text-sm font-semibold text-black transition hover:bg-[#d7ff80]"
        >
          <Plus size={17} />
          New Lead
        </button>
      </div>

      {/* =====================================================
          STATS
      ===================================================== */}

      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">

        {/* TOTAL */}

        <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">

          <div className="mb-4 flex items-center justify-between">

            <span className="text-sm text-[#71717A]">
              Total Leads
            </span>

            <TrendingUp
              size={18}
              className="text-[#C8F065]"
            />

          </div>

          <div className="text-3xl font-semibold text-white">
            {loading
              ? "—"
              : leads.length}
          </div>

          <div className="mt-1 text-xs text-[#52525B]">
            CRM opportunities
          </div>

        </div>

        {/* ACTIVE */}

        <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">

          <div className="mb-4 flex items-center justify-between">

            <span className="text-sm text-[#71717A]">
              Active Leads
            </span>

            <UserRound
              size={18}
              className="text-[#F06AAA]"
            />

          </div>

          <div className="text-3xl font-semibold text-white">
            {loading
              ? "—"
              : activeLeads}
          </div>

          <div className="mt-1 text-xs text-[#52525B]">
            Open opportunities
          </div>

        </div>

        {/* REVENUE */}

        <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">

          <div className="mb-4 flex items-center justify-between">

            <span className="text-sm text-[#71717A]">
              Expected Revenue
            </span>

            <ArrowUpRight
              size={18}
              className="text-[#C8F065]"
            />

          </div>

          <div className="text-3xl font-semibold text-white">
            {loading
              ? "—"
              : `${totalRevenue.toLocaleString()} TND`}
          </div>

          <div className="mt-1 text-xs text-[#52525B]">
            Total pipeline value
          </div>

        </div>

      </div>

      {/* =====================================================
          TOOLBAR
      ===================================================== */}

      <div className="mb-4 flex items-center gap-3">

        <div className="relative flex-1">

          <Search
            size={17}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]"
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Search leads..."
            className="h-10 w-full rounded-xl border border-[#2B2B30] bg-[#111113] pl-10 pr-4 text-sm text-white outline-none placeholder:text-[#52525B] focus:border-[#C8F065]/50"
          />

        </div>

        <div className="flex h-10 items-center rounded-xl border border-[#2B2B30] bg-[#111113] p-1">

          <button
            type="button"
            onClick={() =>
              setView("list")
            }
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
              view === "list"
                ? "bg-[#C8F065] text-black"
                : "text-[#71717A] hover:text-white"
            }`}
          >
            <List size={14} />
            List
          </button>

          <button
            type="button"
            onClick={() =>
              setView("kanban")
            }
            className={`flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium transition ${
              view === "kanban"
                ? "bg-[#C8F065] text-black"
                : "text-[#71717A] hover:text-white"
            }`}
          >
            <LayoutGrid size={14} />
            Kanban
          </button>

        </div>

      </div>

      {/* =====================================================
          ERROR
      ===================================================== */}

      {error && (
        <div className="mb-4 rounded-xl border border-[#F06AAA]/30 bg-[#F06AAA]/5 px-4 py-3 text-sm text-[#F06AAA]">
          {error}
        </div>
      )}

      {/* =====================================================
          VIEW
      ===================================================== */}

      {view === "list" ? (
        <LeadsTable
          leads={filteredLeads}
          loading={loading}
        />
      ) : (
        <LeadsKanban
          leads={filteredLeads}
          stages={stages}
          loading={loading}
          onMoveLead={
            moveLeadToStage
          }
        />
      )}

      {/* =====================================================
          ADD LEAD MODAL
      ===================================================== */}

      <AddLeadModal
        open={addLeadOpen}
        onClose={() =>
          setAddLeadOpen(false)
        }
        onCreated={loadData}
      />

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

            <tr className="border-b border-[#2B2B30] text-left text-xs uppercase tracking-wider text-[#52525B]">

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
                  className="px-5 py-12 text-center text-sm text-[#52525B]"
                >
                  Loading leads...
                </td>
              </tr>

            ) : leads.length === 0 ? (

              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-12 text-center text-sm text-[#52525B]"
                >
                  No leads found.
                </td>
              </tr>

            ) : (

              leads.map((lead) => {

                const colors =
                  getStageColors(
                    lead.stage
                  );

                return (
                  <tr
                    key={lead.id}
                    className="border-b border-[#2B2B30] last:border-0 transition hover:bg-[#17171A]"
                  >

                    {/* LEAD */}

                    <td className="px-5 py-4">

                      <div className="font-medium text-white">
                        {lead.name}
                      </div>

                      <div className="mt-1 text-xs text-[#52525B]">
                        #{lead.id}
                      </div>

                    </td>

                    {/* CUSTOMER */}

                    <td className="px-5 py-4 text-sm text-[#A1A1AA]">
                      {lead.customer?.name ||
                        "—"}
                    </td>

                    {/* CONTACT */}

                    <td className="px-5 py-4">

                      {lead.phone && (
                        <div className="flex items-center gap-2 text-xs text-[#A1A1AA]">

                          <Phone size={13} />

                          {lead.phone}

                        </div>
                      )}

                      {lead.email && (
                        <div className="mt-1 flex items-center gap-2 text-xs text-[#71717A]">

                          <Mail size={13} />

                          {lead.email}

                        </div>
                      )}

                      {!lead.phone &&
                        !lead.email && (
                          <span className="text-xs text-[#52525B]">
                            —
                          </span>
                        )}

                    </td>

                    {/* STAGE */}

                    <td className="px-5 py-4">

                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${colors.tag} ${colors.text}`}
                      >

                        <span
                          className={`h-1.5 w-1.5 rounded-full ${colors.dot}`}
                        />

                        {lead.stage ||
                          "No Stage"}

                      </span>

                    </td>

                    {/* REVENUE */}

                    <td className="px-5 py-4 text-right text-sm font-medium text-white">

                      {(
                        lead.expected_revenue ||
                        0
                      ).toLocaleString()}{" "}
                      TND

                    </td>

                  </tr>
                );
              })

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
  onMoveLead: (
    leadId: number,
    stageId: number,
    stageName: string
  ) => void;
}) {

  const [
    dragLeadId,
    setDragLeadId,
  ] = useState<number | null>(
    null
  );

  const [
    dragOverStageId,
    setDragOverStageId,
  ] = useState<number | null>(
    null
  );

  // =========================================================
  // GROUP LEADS BY ODOO STAGE ID
  // =========================================================

  const leadsByStage =
    useMemo(() => {

      const map =
        new Map<
          number,
          Lead[]
        >();

      // Create every Odoo stage
      for (const stage of stages) {
        map.set(
          stage.id,
          []
        );
      }

      // Put every lead into its actual Odoo stage
      for (const lead of leads) {

        if (
          lead.stage_id !==
            null &&
          map.has(
            lead.stage_id
          )
        ) {
          map
            .get(
              lead.stage_id
            )!
            .push(lead);
        }

      }

      return map;

    }, [leads, stages]);

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] px-5 py-16 text-center text-sm text-[#52525B]">
        Loading pipeline...
      </div>
    );
  }

  // =========================================================
  // NO STAGES
  // =========================================================

  if (stages.length === 0) {
    return (
      <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] px-5 py-16 text-center text-sm text-[#52525B]">
        No CRM stages configured in Odoo.
      </div>
    );
  }

  // =========================================================
  // KANBAN
  // =========================================================

  return (
    <div className="flex gap-4 overflow-x-auto pb-3">

      {stages.map((stage) => {

        const stageLeads =
          leadsByStage.get(
            stage.id
          ) || [];

        const isDragOver =
          dragOverStageId ===
          stage.id;

        const colors =
          getStageColors(
            stage.name
          );

        return (
          <div
            key={stage.id}
            className={`w-[300px] shrink-0 rounded-2xl border bg-[#111113] transition ${
              isDragOver
                ? "border-[#C8F065]/50 bg-[#C8F065]/[0.03]"
                : "border-[#2B2B30]"
            }`}
            onDragOver={(event) => {
              event.preventDefault();

              setDragOverStageId(
                stage.id
              );
            }}
            onDragLeave={() => {
              setDragOverStageId(
                null
              );
            }}
            onDrop={(event) => {

              event.preventDefault();

              if (
                dragLeadId !==
                null
              ) {
                onMoveLead(
                  dragLeadId,
                  stage.id,
                  stage.name
                );
              }

              setDragLeadId(
                null
              );

              setDragOverStageId(
                null
              );
            }}
          >

            {/* =================================================
                STAGE HEADER
            ================================================= */}

            <div className="flex items-center justify-between border-b border-[#2B2B30] px-4 py-3">

              <div className="flex items-center gap-2">

                <span
                  className={`h-2.5 w-2.5 rounded-full ${colors.dot}`}
                />

                <span
                  className={`text-xs font-semibold ${colors.text}`}
                >
                  {stage.name}
                </span>

              </div>

              <span
                className={`rounded-md px-2 py-1 text-[10px] font-medium ${colors.count}`}
              >
                {stageLeads.length}
              </span>

            </div>

            {/* =================================================
                STAGE CONTENT
            ================================================= */}

            <div className="min-h-[180px] space-y-3 p-3">

              {stageLeads.length === 0 ? (

                <div className="flex min-h-[140px] items-center justify-center rounded-xl border border-dashed border-[#2B2B30] text-[11px] text-[#52525B]">
                  Drop leads here
                </div>

              ) : (

                stageLeads.map(
                  (lead) => (

                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => {
                        setDragLeadId(
                          lead.id
                        );
                      }}
                      onDragEnd={() => {
                        setDragLeadId(
                          null
                        );

                        setDragOverStageId(
                          null
                        );
                      }}
                      className={`cursor-grab rounded-xl border border-[#2B2B30] bg-[#17171A] p-4 transition hover:border-[#3b3b42] active:cursor-grabbing ${
                        dragLeadId ===
                        lead.id
                          ? "opacity-50"
                          : ""
                      }`}
                    >

                      {/* LEAD NAME */}

                      <div className="text-sm font-medium text-white">
                        {lead.name}
                      </div>

                      {/* CUSTOMER */}

                      <div className="mt-1 text-[11px] text-[#71717A]">
                        {lead.customer
                          ?.name ||
                          "No customer"}
                      </div>

                      {/* STAGE TAG */}

                      <div className="mt-3">

                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-medium ${colors.tag} ${colors.text}`}
                        >

                          <span
                            className={`h-1.5 w-1.5 rounded-full ${colors.dot}`}
                          />

                          {stage.name}

                        </span>

                      </div>

                      {/* FOOTER */}

                      <div className="mt-3 flex items-center justify-between">

                        <span className="text-[10px] text-[#52525B]">
                          #{lead.id}
                        </span>

                        <span className="text-[10px] font-medium text-[#C8F065]">
                          {(
                            lead.expected_revenue ||
                            0
                          ).toLocaleString()}{" "}
                          TND
                        </span>

                      </div>

                    </div>

                  )
                )

              )}

            </div>

          </div>
        );
      })}

    </div>
  );
}