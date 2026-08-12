"use client";

import { useEffect, useState } from "react";
import {
  ArrowUpRight,
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
  customer: string | null;
  phone: string | null;
  email: string | null;
  stage: string | null;
  expected_revenue: number;
  created: string | null;
};

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

// =========================================================
// LOAD LEADS
// =========================================================

  useEffect(() => {
    async function loadLeads() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_URL}/crm/leads`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Leads API returned ${response.status}`);
        }

        const data = await response.json();

        setLeads(data.leads || []);
      } catch (err) {
        console.error("Failed to load leads:", err);
        setError("Unable to load CRM leads.");
      } finally {
        setLoading(false);
      }
    }

    loadLeads();
  }, []);

// =========================================================
// FILTER
// =========================================================

  const filteredLeads = leads.filter((lead) => {
    const query = search.toLowerCase();

    return (
      lead.name?.toLowerCase().includes(query) ||
      lead.customer?.toLowerCase().includes(query) ||
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

// =========================================================
// HEADER
// =========================================================

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

// =========================================================
// STATS
// =========================================================

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

// =========================================================
// TOOLBAR
// =========================================================

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

      </div>

// =========================================================
// ERROR
// =========================================================

      {error && (
        <div className="mb-4 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

// =========================================================
// LEADS TABLE
// =========================================================

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
              ) : filteredLeads.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-12 text-center text-sm text-zinc-600"
                  >
                    No leads found.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
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
                      {lead.customer || "—"}
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

    </main>
  );
}