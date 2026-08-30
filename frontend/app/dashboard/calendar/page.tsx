"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock3,
  UserRound,
  X,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

type Customer = {
  id: number;
  name: string;
};

type Sale = {
  id: number;
  name: string;
  customer: Customer | null;
  state: string;
  date_order: string | null;
  commitment_date: string | null;
  amount_total: number;
  invoice_status: string;
  opportunity: {
    id: number;
    name: string;
  } | null;
  order_line_ids: number[];
  vehicle_id?: number | null;
};

type Vehicle = {
  id: number;
  name: string;
  license_plate: string | null;
  model?: string | null;
  status?: string | null;
};

type CarsResponse = {
  count?: number;
  cars: Vehicle[];
};

type SalesResponse = {
  count: number;
  sales: Sale[];
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

// ============================================================
// DATE HELPERS
// ============================================================

function startOfDay(date: Date) {
  const result = new Date(date);

  result.setHours(0, 0, 0, 0);

  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);

  result.setHours(23, 59, 59, 999);

  return result;
}

function parseDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function formatDate(value: string | null) {
  const date = parseDate(value);

  if (!date) return "—";

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonth(date: Date) {
  return date.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function isSameDay(
  a: Date,
  b: Date
) {
  return (
    a.getFullYear() ===
      b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(
      2,
      "0"
    ),
    String(date.getDate()).padStart(
      2,
      "0"
    ),
  ].join("-");
}

// ============================================================
// CALENDAR RANGE
// ============================================================

function getCalendarDays(month: Date) {
  const firstDay = new Date(
    month.getFullYear(),
    month.getMonth(),
    1
  );

  const lastDay = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  );

  // Monday-based calendar.
  const mondayIndex =
    (firstDay.getDay() + 6) % 7;

  const daysInMonth =
    lastDay.getDate();

  const totalCells =
    Math.ceil(
      (mondayIndex +
        daysInMonth) /
        7
    ) * 7;

  const days: Date[] = [];

  for (
    let index = 0;
    index < totalCells;
    index++
  ) {
    const day = new Date(firstDay);

    day.setDate(
      1 - mondayIndex + index
    );

    days.push(day);
  }

  return days;
}

// ============================================================
// RENTAL STATE
// ============================================================

function getRentalState(
  sale: Sale
) {
  if (sale.state === "cancel") {
    return {
      label: "Cancelled",
      className:
        "border-red-400/20 bg-red-400/10 text-red-300",
      dot: "bg-red-400",
    };
  }

  if (sale.state === "sale") {
    return {
      label: "Confirmed",
      className:
        "border-[#C8F065]/20 bg-[#C8F065]/10 text-[#C8F065]",
      dot: "bg-[#C8F065]",
    };
  }

  return {
    label: "Quotation",
    className:
      "border-blue-400/20 bg-blue-400/10 text-blue-300",
    dot: "bg-blue-400",
  };
}

// ============================================================
// EVENT OVERLAP
// ============================================================

function rentalOverlapsDay(
  rental: Sale,
  day: Date
) {
  const start =
    parseDate(rental.date_order);

  const end =
    parseDate(rental.commitment_date);

  if (!start || !end) {
    return false;
  }

  return (
    startOfDay(day) <= endOfDay(end) &&
    endOfDay(day) >= startOfDay(start)
  );
}

// ============================================================
// RENTAL MODAL
// ============================================================

function RentalModal({
  rental,
  vehicle,
  onClose,
}: {
  rental: Sale;
  vehicle: Vehicle | null;
  onClose: () => void;
}) {
  const state =
    getRentalState(rental);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close rental"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#2B2B30] bg-[#0D0D0F] shadow-2xl shadow-black/50">
        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-[#2B2B30] px-5 py-4 sm:px-6">
          <div>
            <div className="text-sm font-semibold text-white">
              Rental details
            </div>

            <div className="mt-1 font-mono text-xs text-zinc-600">
              {rental.name}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2B2B30] bg-[#111113] text-zinc-500 transition hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 sm:p-6">
          {/* STATUS */}

          <div className="flex items-center justify-between gap-4">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${state.className}`}
            >
              {state.label}
            </span>

            <span className="text-xs text-zinc-600">
              Odoo Sale #{rental.id}
            </span>
          </div>

          {/* VEHICLE */}

          <div className="mt-5 rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
              Vehicle
            </div>

            {vehicle ? (
              <>
                <Link
                  href={`/dashboard/fleet?vehicle=${vehicle.id}`}
                  onClick={onClose}
                  className="mt-2 flex items-center gap-3"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2B2B30] bg-[#17171A]">
                    <Car
                      size={17}
                      className="text-zinc-400"
                    />
                  </div>

                  <div>
                    <div className="text-sm font-medium text-white transition hover:text-[#C8F065]">
                      {vehicle.model ||
                        vehicle.name}
                    </div>

                    <div className="mt-1 text-xs text-zinc-600">
                      {vehicle.name}

                      {vehicle.license_plate && (
                        <>
                          {" "}
                          •{" "}
                          <span className="font-mono">
                            {
                              vehicle.license_plate
                            }
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </Link>
              </>
            ) : (
              <div className="mt-2 text-sm text-zinc-500">
                Vehicle not found
              </div>
            )}
          </div>

          {/* CUSTOMER */}

          <div className="mt-3 rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
              Customer
            </div>

            {rental.customer ? (
              <Link
                href={`/dashboard/customers/${rental.customer.id}`}
                onClick={onClose}
                className="mt-2 flex items-center gap-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#F06AAA]/20 bg-[#F06AAA]/10">
                  <UserRound
                    size={17}
                    className="text-[#F06AAA]"
                  />
                </div>

                <div className="text-sm font-medium text-white transition hover:text-[#C8F065]">
                  {rental.customer.name}
                </div>
              </Link>
            ) : (
              <div className="mt-2 text-sm text-zinc-500">
                No customer
              </div>
            )}
          </div>

          {/* DATES */}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                Pickup
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-white">
                <CalendarDays
                  size={15}
                  className="text-zinc-500"
                />

                {formatDate(
                  rental.date_order
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
              <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                Return
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm font-medium text-white">
                <Clock3
                  size={15}
                  className="text-zinc-500"
                />

                {formatDate(
                  rental.commitment_date
                )}
              </div>
            </div>
          </div>

          {/* RENTALS LINK */}

          <Link
            href="/dashboard/rentals"
            onClick={onClose}
            className="mt-4 flex h-11 items-center justify-between rounded-xl bg-[#C8F065] px-4 text-xs font-semibold text-black transition hover:bg-[#d7ff80]"
          >
            <span>
              View all rentals
            </span>

            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function CalendarPage() {
  const [sales, setSales] =
    useState<Sale[]>([]);

  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [month, setMonth] =
    useState(() => new Date());

  const [selectedVehicle, setSelectedVehicle] =
    useState<string>("all");

  const [selectedRental, setSelectedRental] =
    useState<Sale | null>(null);

  // ==========================================================
  // URL VEHICLE FILTER
  // ==========================================================

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const vehicle =
      params.get("vehicle");

    if (vehicle) {
      setSelectedVehicle(vehicle);
    }
  }, []);

  // ==========================================================
  // FETCH
  // ==========================================================

  useEffect(() => {
    async function loadCalendar() {
      try {
        setLoading(true);
        setError(null);

        const [
          salesResponse,
          carsResponse,
        ] = await Promise.all([
          fetch(`${API_URL}/sales`, {
            cache: "no-store",
          }),
          fetch(`${API_URL}/cars`, {
            cache: "no-store",
          }),
        ]);

        if (!salesResponse.ok) {
          throw new Error(
            `Sales API returned ${salesResponse.status}`
          );
        }

        if (!carsResponse.ok) {
          throw new Error(
            `Cars API returned ${carsResponse.status}`
          );
        }

        const salesData: SalesResponse =
          await salesResponse.json();

        const carsData: CarsResponse =
          await carsResponse.json();

        setSales(
          salesData.sales || []
        );

        setVehicles(
          carsData.cars || []
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load calendar data."
        );
      } finally {
        setLoading(false);
      }
    }

    void loadCalendar();
  }, []);

  // ==========================================================
  // CALENDAR DAYS
  // ==========================================================

  const days = useMemo(
    () => getCalendarDays(month),
    [month]
  );

  // ==========================================================
  // FILTERED RENTALS
  // ==========================================================

  const filteredSales = useMemo(() => {
    if (
      selectedVehicle === "all"
    ) {
      return sales;
    }

    const vehicleId =
      Number(selectedVehicle);

    return sales.filter(
      (sale) =>
        sale.vehicle_id ===
        vehicleId
    );
  }, [sales, selectedVehicle]);

  // ==========================================================
  // VEHICLE LOOKUP
  // ==========================================================

  const vehicleMap = useMemo(() => {
    return new Map(
      vehicles.map((vehicle) => [
        vehicle.id,
        vehicle,
      ])
    );
  }, [vehicles]);

  // ==========================================================
  // NAVIGATION
  // ==========================================================

  function previousMonth() {
    setMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() - 1,
          1
        )
    );
  }

  function nextMonth() {
    setMonth(
      (current) =>
        new Date(
          current.getFullYear(),
          current.getMonth() + 1,
          1
        )
    );
  }

  function goToday() {
    setMonth(new Date());
  }

  // ==========================================================
  // RENDER
  // ==========================================================

  return (
    <>
      <main className="mx-auto max-w-[1500px] p-5 sm:p-8">
        {/* HEADER */}

        <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-[11px] text-[#71717A]">
              <span>Workspace</span>
              <span>/</span>
              <span className="text-[#A1A1AA]">
                Calendar
              </span>
            </div>

            <h1 className="font-[Syne] text-[28px] font-semibold tracking-[-0.035em] text-white sm:text-[32px]">
              Rental Calendar
            </h1>

            <p className="mt-1 text-sm text-[#71717A]">
              Rental schedule synced from Odoo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/rentals"
              className="flex h-9 items-center gap-2 rounded-lg border border-[#2B2B30] bg-[#111113] px-3 text-xs font-medium text-zinc-300 transition hover:bg-[#17171A] hover:text-white"
            >
              <ArrowLeft size={13} />
              Rentals
            </Link>

            <Link
              href="/dashboard/fleet"
              className="flex h-9 items-center gap-2 rounded-lg border border-[#2B2B30] bg-[#111113] px-3 text-xs font-medium text-zinc-300 transition hover:bg-[#17171A] hover:text-white"
            >
              <Car size={13} />
              Fleet
            </Link>
          </div>
        </section>

        {/* TOOLBAR */}

        <section className="mt-7 flex flex-col justify-between gap-4 rounded-2xl border border-[#2B2B30] bg-[#111113] p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={previousMonth}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2B2B30] bg-[#17171A] text-zinc-500 transition hover:text-white"
            >
              <ChevronLeft
                size={16}
              />
            </button>

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2B2B30] bg-[#17171A] text-zinc-500 transition hover:text-white"
            >
              <ChevronRight
                size={16}
              />
            </button>

            <button
              type="button"
              onClick={goToday}
              className="ml-1 h-9 rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-xs font-medium text-zinc-300 transition hover:text-white"
            >
              Today
            </button>

            <div className="ml-2 font-[Syne] text-lg font-semibold text-white">
              {formatMonth(month)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Car
              size={14}
              className="text-zinc-600"
            />

            <select
              value={selectedVehicle}
              onChange={(event) =>
                setSelectedVehicle(
                  event.target.value
                )
              }
              className="h-9 min-w-[210px] rounded-lg border border-[#2B2B30] bg-[#17171A] px-3 text-xs text-zinc-300 outline-none focus:border-[#C8F065]/40"
            >
              <option value="all">
                All vehicles
              </option>

              {vehicles.map(
                (vehicle) => (
                  <option
                    key={vehicle.id}
                    value={vehicle.id}
                  >
                    {vehicle.name}
                    {vehicle.license_plate
                      ? ` — ${vehicle.license_plate}`
                      : ""}
                  </option>
                )
              )}
            </select>
          </div>
        </section>

        {/* ERROR */}

        {error && (
          <div className="mt-4 rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* CALENDAR */}

        <section className="mt-4 overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113]">
          {loading ? (
            <div className="px-5 py-20 text-center text-sm text-zinc-600">
              Loading rental calendar from Odoo...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[1050px]">
                {/* WEEKDAYS */}

                <div className="grid grid-cols-7 border-b border-[#2B2B30]">
                  {[
                    "Monday",
                    "Tuesday",
                    "Wednesday",
                    "Thursday",
                    "Friday",
                    "Saturday",
                    "Sunday",
                  ].map(
                    (day) => (
                      <div
                        key={day}
                        className="px-3 py-3 text-[10px] font-medium uppercase tracking-[0.12em] text-zinc-600"
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>

                {/* DAYS */}

                <div className="grid grid-cols-7">
                  {days.map((day) => {
                    const inMonth =
                      day.getMonth() ===
                      month.getMonth();

                    const today =
                      isSameDay(
                        day,
                        new Date()
                      );

                    const dayRentals =
                      filteredSales.filter(
                        (rental) =>
                          rentalOverlapsDay(
                            rental,
                            day
                          )
                      );

                    return (
                      <div
                        key={dateKey(day)}
                        className={`min-h-[145px] border-b border-r border-[#2B2B30] p-2 ${
                          !inMonth
                            ? "bg-[#0D0D0F]/60"
                            : ""
                        }`}
                      >
                        {/* DAY NUMBER */}

                        <div className="flex items-center justify-between">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                              today
                                ? "bg-[#C8F065] font-semibold text-black"
                                : inMonth
                                  ? "text-zinc-400"
                                  : "text-zinc-700"
                            }`}
                          >
                            {day.getDate()}
                          </span>

                          {dayRentals.length >
                            0 && (
                            <span className="text-[9px] text-zinc-700">
                              {
                                dayRentals.length
                              }{" "}
                              rental
                              {dayRentals.length >
                              1
                                ? "s"
                                : ""}
                            </span>
                          )}
                        </div>

                        {/* RENTALS */}

                        <div className="mt-2 space-y-1.5">
                          {dayRentals
                            .slice(0, 4)
                            .map(
                              (
                                rental
                              ) => {
                                const state =
                                  getRentalState(
                                    rental
                                  );

                                const vehicle =
                                  rental.vehicle_id
                                    ? vehicleMap.get(
                                        rental.vehicle_id
                                      )
                                    : null;

                                return (
                                  <button
                                    key={`${dateKey(
                                      day
                                    )}-${rental.id}`}
                                    type="button"
                                    onClick={() =>
                                      setSelectedRental(
                                        rental
                                      )
                                    }
                                    className={`w-full rounded-lg border p-2 text-left transition hover:brightness-125 ${state.className}`}
                                  >
                                    <div className="truncate text-[10px] font-semibold">
                                      {vehicle?.name ||
                                        "Rental"}
                                    </div>

                                    <div className="mt-0.5 truncate text-[9px] opacity-70">
                                      {rental
                                        .customer
                                        ?.name ||
                                        rental.name}
                                    </div>
                                  </button>
                                );
                              }
                            )}

                          {dayRentals.length >
                            4 && (
                            <div className="px-2 text-[9px] text-zinc-600">
                              +
                              {dayRentals.length -
                                4}{" "}
                              more
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* LEGEND */}

        <section className="mt-4 flex flex-wrap items-center gap-4 text-xs text-zinc-600">
          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#C8F065]" />
            Confirmed
          </span>

          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-blue-400" />
            Quotation
          </span>

          <span className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            Cancelled
          </span>

          <span className="ml-auto flex items-center gap-2">
            <CalendarDays size={13} />
            {filteredSales.length} rentals
          </span>
        </section>
      </main>

      {/* RENTAL DETAIL MODAL */}

      {selectedRental && (
        <RentalModal
          rental={selectedRental}
          vehicle={
            selectedRental.vehicle_id
              ? vehicleMap.get(
                  selectedRental.vehicle_id
                ) || null
              : null
          }
          onClose={() =>
            setSelectedRental(null)
          }
        />
      )}
    </>
  );
}