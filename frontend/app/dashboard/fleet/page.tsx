"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Car,
  Search,
  SlidersHorizontal,
  ArrowUpRight,
  Gauge,
} from "lucide-react";

type CarData = {
  id: number;
  name: string;
  license_plate: string | null;
  model: string | null;
  status: string | null;
};

type CarsResponse = {
  count: number;
  cars: CarData[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

// ==========================================================
// STATUS MAPPING
// ==========================================================

function getStatus(status: string | null) {
  const value = status?.toLowerCase().trim() || "";

  // DISPONIBLE / AVAILABLE
  if (
    value.includes("dispon") ||
    value.includes("available") ||
    value.includes("ready")
  ) {
    return {
      label: "Disponible",
      className:
        "border-[#C8F065]/20 bg-[#C8F065]/10 text-[#C8F065]",
      dot: "bg-[#C8F065]",
    };
  }

  // LOUÉ / RENTED
  if (
    value.includes("lou") ||
    value.includes("rented") ||
    value.includes("rent")
  ) {
    return {
      label: "Loué",
      className:
        "border-[#F06AAA]/20 bg-[#F06AAA]/10 text-[#F06AAA]",
      dot: "bg-[#F06AAA]",
    };
  }

  // INDISPONIBLE / UNAVAILABLE
  if (
    value.includes("indispon") ||
    value.includes("unavailable") ||
    value.includes("inactive")
  ) {
    return {
      label: "Indisponible",
      className:
        "border-red-400/20 bg-red-500/10 text-red-400",
      dot: "bg-red-400",
    };
  }

  // NETTOYAGE / CLEANING
  if (
    value.includes("nettoyage") ||
    value.includes("clean") ||
    value.includes("cleaning")
  ) {
    return {
      label: "Nettoyage",
      className:
        "border-blue-400/20 bg-blue-500/10 text-blue-400",
      dot: "bg-blue-400",
    };
  }

  // MAINTENANCE
  if (
    value.includes("maintenance") ||
    value.includes("repair")
  ) {
    return {
      label: "Maintenance",
      className:
        "border-violet-400/20 bg-violet-500/10 text-violet-400",
      dot: "bg-violet-400",
    };
  }

  // UNKNOWN
  return {
    label: status || "Non défini",
    className:
      "border-[#2B2B30] bg-[#17171A] text-[#A1A1AA]",
    dot: "bg-[#71717A]",
  };
}

// ==========================================================
// FLEET PAGE
// ==========================================================

export default function FleetPage() {
  const [cars, setCars] = useState<CarData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // ========================================================
  // FETCH CARS
  // ========================================================

  useEffect(() => {
    async function loadCars() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch(`${API_URL}/cars`, {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(
            `Cars API returned ${response.status}`
          );
        }

        const data: CarsResponse =
          await response.json();

        setCars(data.cars || []);
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load fleet data."
        );
      } finally {
        setLoading(false);
      }
    }

    loadCars();
  }, []);

  // ========================================================
  // FILTER
  // ========================================================

  const filteredCars = useMemo(() => {
    const query = search.toLowerCase().trim();

    if (!query) return cars;

    return cars.filter((car) =>
      [
        car.name,
        car.license_plate,
        car.model,
        car.status,
      ]
        .filter(Boolean)
        .some((value) =>
          value!.toLowerCase().includes(query)
        )
    );
  }, [cars, search]);

  // ========================================================
  // STATUS COUNTS
  // ========================================================

  const available = cars.filter((car) => {
    const status = car.status?.toLowerCase() || "";

    return (
      status.includes("dispon") ||
      status.includes("available") ||
      status.includes("ready")
    );
  }).length;

  const maintenance = cars.filter((car) => {
    const status = car.status?.toLowerCase() || "";

    return (
      status.includes("maintenance") ||
      status.includes("repair")
    );
  }).length;

  return (
    <main className="mx-auto max-w-[1500px] p-5 sm:p-8">

      {/* HEADER */}

      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

        <div>

          <div className="mb-2 flex items-center gap-2 text-[11px] text-[#71717A]">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#A1A1AA]">
              Fleet
            </span>
          </div>

          <h1 className="font-[Syne] text-[28px] font-semibold tracking-[-0.035em] text-white sm:text-[32px]">
            Fleet
          </h1>

          <p className="mt-1 text-sm text-[#71717A]">
            Vehicle availability and operational status.
          </p>

        </div>

        <button className="flex h-9 items-center justify-center gap-2 rounded-lg border border-[#2B2B30] bg-[#111113] px-4 text-xs font-medium text-white transition hover:bg-[#17171A]">
          <SlidersHorizontal size={14} />
          Filters
        </button>

      </section>

      {/* KPI CARDS */}

      <section className="mt-7 grid gap-3 sm:grid-cols-3">

        {/* TOTAL */}

        <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">

          <div className="flex items-center justify-between">

            <span className="text-xs text-zinc-500">
              Total Fleet
            </span>

            <Car
              size={16}
              className="text-zinc-500"
            />

          </div>

          <div className="mt-3 text-3xl font-semibold text-white">
            {loading ? "—" : cars.length}
          </div>

          <div className="mt-1 text-xs text-zinc-600">
            vehicles
          </div>

        </div>

        {/* DISPONIBLE */}

        <div className="rounded-2xl border border-[#C8F065]/20 bg-[#C8F065]/[0.04] p-5">

          <div className="flex items-center justify-between">

            <span className="text-xs text-[#C8F065]">
              Disponible
            </span>

            <Gauge
              size={16}
              className="text-[#C8F065]"
            />

          </div>

          <div className="mt-3 text-3xl font-semibold text-white">
            {loading ? "—" : available}
          </div>

          <div className="mt-1 text-xs text-[#C8F065]/50">
            ready to rent
          </div>

        </div>

        {/* MAINTENANCE */}

        <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.04] p-5">

          <div className="flex items-center justify-between">

            <span className="text-xs text-violet-400">
              Maintenance
            </span>

            <ArrowUpRight
              size={16}
              className="text-violet-400"
            />

          </div>

          <div className="mt-3 text-3xl font-semibold text-white">
            {loading ? "—" : maintenance}
          </div>

          <div className="mt-1 text-xs text-violet-400/50">
            unavailable
          </div>

        </div>

      </section>

      {/* SEARCH */}

      <section className="mt-5">

        <div className="relative">

          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-600"
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search vehicles, plates, models..."
            className="h-10 w-full rounded-xl border border-[#2B2B30] bg-[#111113] pl-10 pr-4 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-[#C8F065]/50"
          />

        </div>

      </section>

      {/* ERROR */}

      {error && (
        <div className="mt-4 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* FLEET TABLE */}

      <section className="mt-5 overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113]">

        <div className="overflow-x-auto">

          <table className="w-full min-w-[850px]">

            <thead>

              <tr className="border-b border-[#2B2B30] text-left text-[10px] uppercase tracking-[0.12em] text-zinc-600">

                <th className="px-5 py-4 font-medium">
                  Vehicle
                </th>

                <th className="px-5 py-4 font-medium">
                  Plate
                </th>

                <th className="px-5 py-4 font-medium">
                  Model
                </th>

                <th className="px-5 py-4 font-medium">
                  Availability
                </th>

                <th className="px-5 py-4 text-right font-medium">
                  ID
                </th>

              </tr>

            </thead>

            <tbody>

              {loading ? (

                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-14 text-center text-sm text-zinc-600"
                  >
                    Loading fleet...
                  </td>
                </tr>

              ) : filteredCars.length === 0 ? (

                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-14 text-center text-sm text-zinc-600"
                  >
                    No vehicles found.
                  </td>
                </tr>

              ) : (

                filteredCars.map((car) => {

                  const status = getStatus(car.status);

                  return (

                    <tr
                      key={car.id}
                      className="border-b border-[#2B2B30] transition last:border-0 hover:bg-[#17171A]"
                    >

                      <td className="px-5 py-5">

                        <div className="flex items-center gap-3">

                          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2B2B30] bg-[#17171A]">

                            <Car
                              size={16}
                              className="text-zinc-400"
                            />

                          </div>

                          <div>

                            <div className="font-medium text-white">
                              {car.model || car.name}
                            </div>

                            <div className="mt-0.5 text-xs text-zinc-600">
                              {car.name}
                            </div>

                          </div>

                        </div>

                      </td>

                      <td className="px-5 py-5 font-mono text-xs text-zinc-400">
                        {car.license_plate || "—"}
                      </td>

                      <td className="px-5 py-5 text-sm text-zinc-400">
                        {car.model || "—"}
                      </td>

                      <td className="px-5 py-5">

                        <span
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${status.className}`}
                        >

                          <span
                            className={`h-1.5 w-1.5 rounded-full ${status.dot}`}
                          />

                          {status.label}

                        </span>

                      </td>

                      <td className="px-5 py-5 text-right font-mono text-xs text-zinc-600">
                        #{car.id}
                      </td>

                    </tr>

                  );

                })

              )}

            </tbody>

          </table>

        </div>

      </section>

    </main>
  );
}