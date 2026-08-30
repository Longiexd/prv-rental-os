"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {

  ArrowRight,
  CalendarDays,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock3,
  UserRound,
  Wrench,
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
  active?: boolean;
};

type CarsResponse = {
  count?: number;
  cars: Vehicle[];
};

type SalesResponse = {
  count: number;
  sales: Sale[];
};

type ViewMode =
  | "month"
  | "timeline"
  | "year";

type FleetStatus =
  | "available"
  | "rented"
  | "cleaning"
  | "maintenance"
  | "inactive"
  | "unknown";

// ============================================================
// CONFIG
// ============================================================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

// ============================================================
// DATE HELPERS
// ============================================================

function parseDate(
  value: string | null
) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function startOfDay(date: Date) {
  const result = new Date(date);

  result.setHours(
    0,
    0,
    0,
    0
  );

  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);

  result.setHours(
    23,
    59,
    59,
    999
  );

  return result;
}

function isSameDay(
  a: Date,
  b: Date
) {
  return (
    a.getFullYear() ===
      b.getFullYear() &&
    a.getMonth() ===
      b.getMonth() &&
    a.getDate() ===
      b.getDate()
  );
}

function dateKey(date: Date) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0"),
    String(
      date.getDate()
    ).padStart(2, "0"),
  ].join("-");
}

function formatDate(
  value: string | null
) {
  const date =
    parseDate(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function formatDateShort(
  value: string | null
) {
  const date =
    parseDate(value);

  if (!date) {
    return "—";
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
    }
  );
}

function formatMonth(
  date: Date
) {
  return date.toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
    }
  );
}

function formatYear(
  date: Date
) {
  return String(
    date.getFullYear()
  );
}

function daysBetween(
  start: Date,
  end: Date
) {
  return Math.max(
    1,
    Math.round(
      (
        startOfDay(end).getTime() -
        startOfDay(start).getTime()
      ) /
        86400000
    ) + 1
  );
}

// ============================================================
// MONTH GRID
// ============================================================

function getCalendarDays(
  month: Date
) {
  const firstDay =
    new Date(
      month.getFullYear(),
      month.getMonth(),
      1
    );

  const lastDay =
    new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0
    );

  const mondayIndex =
    (firstDay.getDay() + 6) %
    7;

  const daysInMonth =
    lastDay.getDate();

  const totalCells =
    Math.ceil(
      (
        mondayIndex +
        daysInMonth
      ) / 7
    ) * 7;

  const days: Date[] = [];

  for (
    let index = 0;
    index < totalCells;
    index++
  ) {
    const day =
      new Date(firstDay);

    day.setDate(
      1 -
        mondayIndex +
        index
    );

    days.push(day);
  }

  return days;
}

function getMonthWeeks(
  month: Date
) {
  const days =
    getCalendarDays(month);

  const weeks: Date[][] = [];

  for (
    let i = 0;
    i < days.length;
    i += 7
  ) {
    weeks.push(
      days.slice(
        i,
        i + 7
      )
    );
  }

  return weeks;
}

// ============================================================
// FLEET STATUS
// ============================================================
//
// IMPORTANT:
//
// "Indisponible" is NOT treated as a standalone fleet state.
//
// Loué / Nettoyage / Maintenance are themselves unavailable
// states and receive a small red "Indisponible" tag.
//
// ============================================================

function getFleetStatus(
  status: string | null,
  active?: boolean
): FleetStatus {
  const value =
    status
      ?.toLowerCase()
      .trim() || "";

  if (active === false) {
    return "inactive";
  }

  if (
    value === "loué" ||
    value === "loue" ||
    value.includes("loué") ||
    value.includes("loue") ||
    value.includes("rented")
  ) {
    return "rented";
  }

  if (
    value === "disponible" ||
    value.includes("disponible") ||
    value.includes("available") ||
    value.includes("ready")
  ) {
    return "available";
  }

  if (
    value === "nettoyage" ||
    value.includes("nettoyage") ||
    value.includes("nettoy") ||
    value.includes("cleaning") ||
    value === "clean"
  ) {
    return "cleaning";
  }

  if (
    value === "maintenance" ||
    value.includes("maintenance") ||
    value.includes("entretien") ||
    value.includes("repair") ||
    value.includes("réparation") ||
    value.includes("reparation")
  ) {
    return "maintenance";
  }

  return "unknown";
}

// ============================================================
// STATUS META
// ============================================================

function getStatusMeta(
  status: FleetStatus,
  originalStatus: string | null
) {
  switch (status) {
    case "available":
      return {
        label: "Disponible",
        className:
          "border-[#C8F065]/20 bg-[#C8F065]/10 text-[#C8F065]",
        text:
          "text-[#C8F065]",
        dot:
          "bg-[#C8F065]",
        border:
          "border-[#C8F065]/20",
        soft:
          "bg-[#C8F065]/5",
        unavailable:
          false,
      };

    case "rented":
      return {
        label: "Loué",
        className:
          "border-[#F06AAA]/20 bg-[#F06AAA]/10 text-[#F06AAA]",
        text:
          "text-[#F06AAA]",
        dot:
          "bg-[#F06AAA]",
        border:
          "border-[#F06AAA]/20",
        soft:
          "bg-[#F06AAA]/5",
        unavailable:
          true,
      };

    case "cleaning":
      return {
        label: "Nettoyage",
        className:
          "border-blue-400/20 bg-blue-500/10 text-blue-400",
        text:
          "text-blue-400",
        dot:
          "bg-blue-400",
        border:
          "border-blue-400/20",
        soft:
          "bg-blue-400/5",
        unavailable:
          true,
      };

    case "maintenance":
      return {
        label: "Maintenance",
        className:
          "border-violet-400/20 bg-violet-500/10 text-violet-400",
        text:
          "text-violet-400",
        dot:
          "bg-violet-400",
        border:
          "border-violet-400/20",
        soft:
          "bg-violet-400/5",
        unavailable:
          true,
      };

    case "inactive":
      return {
        label: "Inactive",
        className:
          "border-zinc-600/30 bg-zinc-700/20 text-zinc-500",
        text:
          "text-zinc-500",
        dot:
          "bg-zinc-600",
        border:
          "border-zinc-600/30",
        soft:
          "bg-zinc-700/10",
        unavailable:
          true,
      };

    default:
      return {
        label:
          originalStatus ||
          "Non défini",
        className:
          "border-[#2B2B30] bg-[#17171A] text-[#A1A1AA]",
        text:
          "text-[#A1A1AA]",
        dot:
          "bg-zinc-600",
        border:
          "border-[#2B2B30]",
        soft:
          "bg-[#17171A]",
        unavailable:
          false,
      };
  }
}

// ============================================================
// RENTAL COLOR
// ============================================================

function getRentalState(
  sale: Sale
) {
  if (
    sale.state ===
    "cancel"
  ) {
    return {
      className:
        "border-red-400/20 bg-red-400/10 text-red-300",
      dot:
        "bg-red-400",
    };
  }

  if (
    sale.state ===
    "sale"
  ) {
    return {
      className:
        "border-[#F06AAA]/20 bg-[#F06AAA]/10 text-[#F06AAA]",
      dot:
        "bg-[#F06AAA]",
    };
  }

  return {
    className:
      "border-blue-400/20 bg-blue-400/10 text-blue-300",
    dot:
      "bg-blue-400",
  };
}

// ============================================================
// RENTAL OVERLAP
// ============================================================

function rentalOverlapsDay(
  rental: Sale,
  day: Date
) {
  const start =
    parseDate(
      rental.date_order
    );

  const end =
    parseDate(
      rental.commitment_date
    );

  if (!start || !end) {
    return false;
  }

  return (
    startOfDay(day) <=
      endOfDay(end) &&
    endOfDay(day) >=
      startOfDay(start)
  );
}

function rentalOverlapsRange(
  rental: Sale,
  rangeStart: Date,
  rangeEnd: Date
) {
  const start =
    parseDate(
      rental.date_order
    );

  const end =
    parseDate(
      rental.commitment_date
    );

  if (!start || !end) {
    return false;
  }

  return (
    start <= rangeEnd &&
    end >= rangeStart
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
  const rentalState =
    getRentalState(
      rental
    );

  const start =
    parseDate(
      rental.date_order
    );

  const end =
    parseDate(
      rental.commitment_date
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close rental"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
      />

      <div className="relative z-10 max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#2B2B30] bg-[#0D0D0F] shadow-2xl shadow-black/60">

        <div className="flex items-center justify-between border-b border-[#2B2B30] px-5 py-4">
          <div>
            <div className="text-sm font-semibold text-white">
              Rental details
            </div>

            <div className="mt-1 font-mono text-[10px] text-zinc-700">
              {rental.name}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2B2B30] bg-[#111113] text-zinc-500 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3 p-5">

          <div className="flex items-center justify-between">
            <span
              className={`rounded-full border px-3 py-1.5 text-[10px] font-semibold ${rentalState.className}`}
            >
              {rental.state ===
              "sale"
                ? "Confirmed"
                : rental.state ===
                    "cancel"
                  ? "Cancelled"
                  : "Quotation"}
            </span>

            <span className="font-mono text-[10px] text-zinc-700">
              Odoo #{rental.id}
            </span>
          </div>

          {/* VEHICLE */}

          <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
            <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-700">
              Vehicle
            </div>

            {vehicle ? (
              <Link
                href={`/dashboard/fleet?vehicle=${vehicle.id}`}
                onClick={onClose}
                className="mt-3 flex items-center gap-3"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#2B2B30] bg-[#17171A]">
                  <Car
                    size={17}
                    className="text-zinc-400"
                  />
                </div>

                <div>
                  <div className="text-sm font-semibold text-white hover:text-[#C8F065]">
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
            ) : (
              <div className="mt-3 text-sm text-zinc-600">
                Vehicle not linked
              </div>
            )}
          </div>

          {/* CUSTOMER */}

          <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
            <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-700">
              Customer
            </div>

            {rental.customer ? (
              <Link
                href={`/dashboard/customers/${rental.customer.id}`}
                onClick={onClose}
                className="mt-3 flex items-center gap-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#F06AAA]/20 bg-[#F06AAA]/10">
                  <UserRound
                    size={16}
                    className="text-[#F06AAA]"
                  />
                </div>

                <div className="text-sm font-semibold text-white hover:text-[#C8F065]">
                  {
                    rental.customer
                      .name
                  }
                </div>
              </Link>
            ) : (
              <div className="mt-3 text-sm text-zinc-600">
                No customer linked
              </div>
            )}
          </div>

          {/* PERIOD */}

          <div className="grid grid-cols-2 gap-3">

            <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
              <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-700">
                Pickup
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                <CalendarDays
                  size={14}
                  className="text-zinc-600"
                />

                {formatDate(
                  rental.date_order
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
              <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-700">
                Return
              </div>

              <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Clock3
                  size={14}
                  className="text-zinc-600"
                />

                {formatDate(
                  rental.commitment_date
                )}
              </div>
            </div>

          </div>

          {start &&
            end && (
              <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
                <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-700">
                  Rental period
                </div>

                <div className="mt-2 text-sm font-semibold text-white">
                  {daysBetween(
                    start,
                    end
                  )}{" "}
                  {daysBetween(
                    start,
                    end
                  ) === 1
                    ? "day"
                    : "days"}
                </div>
              </div>
            )}

          <Link
            href="/dashboard/rentals"
            onClick={onClose}
            className="flex h-11 items-center justify-between rounded-xl bg-[#C8F065] px-4 text-xs font-semibold text-black hover:bg-[#d7ff80]"
          >
            View rentals
            <ArrowRight
              size={14}
            />
          </Link>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// MONTH RENTAL BAR
// ============================================================
//
// IMPORTANT:
// This is NOT rendered once per day.
//
// Each rental becomes ONE continuous element across the
// relevant columns of the week.
//
// ============================================================

function MonthRentalBar({
  rental,
  vehicle,
  week,
  onClick,
}: {
  rental: Sale;
  vehicle: Vehicle | null;
  week: Date[];
  onClick: () => void;
}) {
  const start =
    parseDate(
      rental.date_order
    );

  const end =
    parseDate(
      rental.commitment_date
    );

  if (!start || !end) {
    return null;
  }

  const weekStart =
    startOfDay(
      week[0]
    );

  const weekEnd =
    endOfDay(
      week[6]
    );

  if (
    end < weekStart ||
    start > weekEnd
  ) {
    return null;
  }

  const visibleStart =
    start < weekStart
      ? weekStart
      : startOfDay(start);

  const visibleEnd =
    end > weekEnd
      ? weekEnd
      : endOfDay(end);

  const startIndex =
    Math.max(
      0,
      Math.floor(
        (
          visibleStart.getTime() -
          weekStart.getTime()
        ) /
          86400000
      )
    );

  const endIndex =
    Math.min(
      6,
      Math.floor(
        (
          visibleEnd.getTime() -
          weekStart.getTime()
        ) /
          86400000
      )
    );

  const span =
    endIndex -
    startIndex +
    1;

  const rentalState =
    getRentalState(
      rental
    );

  return (
    <button
      type="button"
      onClick={onClick}
      className={`absolute z-20 flex h-9 items-center overflow-hidden rounded-lg border px-2.5 text-left shadow-sm transition hover:z-30 hover:brightness-110 ${rentalState.className}`}
      style={{
        left: `calc(${startIndex} * (100% / 7) + 4px)`,
        width: `calc(${span} * (100% / 7) - 8px)`,
      }}
    >
      <span
        className={`mr-2 h-1.5 w-1.5 shrink-0 rounded-full ${rentalState.dot}`}
      />

      <span className="truncate text-[10px] font-semibold">
        {vehicle?.model ||
          vehicle?.name ||
          "Rental"}
      </span>

      {span >= 3 &&
        rental.customer && (
          <span className="ml-2 truncate text-[9px] opacity-70">
            {
              rental.customer
                .name
            }
          </span>
        )}
    </button>
  );
}

// ============================================================
// MONTH VIEW
// ============================================================

function MonthView({
  month,
  sales,
  vehicleMap,
  onRentalClick,
}: {
  month: Date;
  sales: Sale[];
  vehicleMap: Map<
    number,
    Vehicle
  >;
  onRentalClick: (
    rental: Sale
  ) => void;
}) {
  const weeks =
    getMonthWeeks(month);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113]">

      {/* WEEKDAY HEADER */}

      <div className="grid grid-cols-7 border-b border-[#2B2B30]">
        {[
          "Mon",
          "Tue",
          "Wed",
          "Thu",
          "Fri",
          "Sat",
          "Sun",
        ].map(
          (day) => (
            <div
              key={day}
              className="flex h-11 items-center justify-center border-r border-[#2B2B30] text-[9px] font-semibold uppercase tracking-[0.14em] text-zinc-600 last:border-r-0"
            >
              {day}
            </div>
          )
        )}
      </div>

      {/* WEEK ROWS */}

      {weeks.map(
        (
          week,
          weekIndex
        ) => {

          const weekStart =
            startOfDay(
              week[0]
            );

          const weekEnd =
            endOfDay(
              week[6]
            );

          const weekSales =
            sales.filter(
              (sale) =>
                rentalOverlapsRange(
                  sale,
                  weekStart,
                  weekEnd
                )
            );

          const today =
            new Date();

          return (
            <div
              key={`week-${weekIndex}`}
              className="relative border-b border-[#2B2B30] last:border-b-0"
            >

              {/* DAY CELLS */}

              <div className="grid grid-cols-7">
                {week.map(
                  (day) => {
                    const inMonth =
                      day.getMonth() ===
                      month.getMonth();

                    const daySales =
                      weekSales.filter(
                        (sale) =>
                          rentalOverlapsDay(
                            sale,
                            day
                          )
                      );

                    return (
                      <div
                        key={dateKey(
                          day
                        )}
                        className={`min-h-[150px] border-r border-[#2B2B30] p-2 last:border-r-0 ${
                          inMonth
                            ? "bg-[#111113]"
                            : "bg-[#0D0D0F]"
                        } ${
                          isSameDay(
                            day,
                            today
                          )
                            ? "bg-[#C8F065]/[0.025]"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-semibold ${
                              isSameDay(
                                day,
                                today
                              )
                                ? "bg-[#C8F065] text-black"
                                : inMonth
                                  ? "text-zinc-300"
                                  : "text-zinc-700"
                            }`}
                          >
                            {day.getDate()}
                          </span>

                          {daySales.length >
                            0 && (
                            <span className="text-[9px] text-zinc-700">
                              {
                                daySales.length
                              }
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {/* CONTINUOUS RENTAL LAYER */}

              <div className="pointer-events-none absolute inset-x-0 top-[43px] h-[100px]">

                {weekSales
                  .slice(
                    0,
                    8
                  )
                  .map(
                    (
                      rental,
                      index
                    ) => (
                      <div
                        key={
                          rental.id
                        }
                        className="pointer-events-auto"
                        style={{
                          top: `${index * 43}px`,
                          left: 0,
                          right: 0,
                          position:
                            "absolute",
                        }}
                      >
                        <MonthRentalBar
                          rental={
                            rental
                          }
                          vehicle={
                            rental.vehicle_id
                              ? vehicleMap.get(
                                  rental.vehicle_id
                                ) ||
                                null
                              : null
                          }
                          week={
                            week
                          }
                          onClick={() =>
                            onRentalClick(
                              rental
                            )
                          }
                        />
                      </div>
                    )
                  )}

                {weekSales.length >
                  8 && (
                  <div className="absolute bottom-0 left-2 text-[9px] text-zinc-600">
                    +
                    {weekSales.length -
                      8}{" "}
                    more rentals
                  </div>
                )}
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}

// ============================================================
// TIMELINE VIEW
// ============================================================

function TimelineView({
  month,
  vehicles,
  sales,
  vehicleMap,
  onRentalClick,
}: {
  month: Date;
  vehicles: Vehicle[];
  sales: Sale[];
  vehicleMap: Map<
    number,
    Vehicle
  >;
  onRentalClick: (
    rental: Sale
  ) => void;
}) {
  const daysInMonth =
    new Date(
      month.getFullYear(),
      month.getMonth() + 1,
      0
    ).getDate();

  const days =
    Array.from(
      {
        length:
          daysInMonth,
      },
      (_, index) =>
        new Date(
          month.getFullYear(),
          month.getMonth(),
          index + 1
        )
    );

  return (
    <div className="overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113]">

      <div className="overflow-x-auto">

        <div
          className="min-w-max"
          style={
            {
              "--day-width":
                "72px",
            } as React.CSSProperties
          }
        >

          {/* HEADER */}

          <div className="flex border-b border-[#2B2B30]">

            <div className="sticky left-0 z-30 flex h-14 w-[240px] shrink-0 items-center border-r border-[#2B2B30] bg-[#111113] px-5">
              <div>
                <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-700">
                  Fleet
                </div>

                <div className="mt-1 text-xs font-semibold text-white">
                  Vehicle
                </div>
              </div>
            </div>

            <div className="flex">
              {days.map(
                (day) => (
                  <div
                    key={dateKey(
                      day
                    )}
                    className={`flex h-14 w-[72px] shrink-0 flex-col items-center justify-center border-r border-[#2B2B30] ${
                      isSameDay(
                        day,
                        new Date()
                      )
                        ? "bg-[#C8F065]/[0.04]"
                        : ""
                    }`}
                  >
                    <span className="text-[8px] uppercase text-zinc-700">
                      {day.toLocaleDateString(
                        "en-US",
                        {
                          weekday:
                            "short",
                        }
                      )}
                    </span>

                    <span
                      className={`mt-1 text-xs font-semibold ${
                        isSameDay(
                          day,
                          new Date()
                        )
                          ? "text-[#C8F065]"
                          : "text-zinc-400"
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>

          {/* VEHICLE ROWS */}

          {vehicles.map(
            (vehicle) => {
              const vehicleSales =
                sales.filter(
                  (sale) =>
                    sale.vehicle_id ===
                    vehicle.id &&
                    sale.state !==
                      "cancel"
                );

              const status =
                getFleetStatus(
                  vehicle.status,
                  vehicle.active
                );

              const meta =
                getStatusMeta(
                  status,
                  vehicle.status ||
                    null
                );

              return (
                <div
                  key={
                    vehicle.id
                  }
                  className="flex h-[82px] border-b border-[#2B2B30]"
                >

                  {/* VEHICLE */}

                  <Link
                    href={`/dashboard/fleet?vehicle=${vehicle.id}`}
                    className="sticky left-0 z-20 flex w-[240px] shrink-0 items-center gap-3 border-r border-[#2B2B30] bg-[#111113] px-5 hover:bg-[#17171A]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#2B2B30] bg-[#17171A]">
                      <Car
                        size={15}
                        className={
                          meta.text
                        }
                      />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-white">
                        {vehicle.model ||
                          vehicle.name}
                      </div>

                      <div className="mt-1 truncate font-mono text-[9px] text-zinc-600">
                        {vehicle.license_plate ||
                          vehicle.name}
                      </div>
                    </div>
                  </Link>

                  {/* TIMELINE */}

                  <div
                    className="relative h-[82px] shrink-0"
                    style={{
                      width: `calc(${daysInMonth} * var(--day-width))`,
                    }}
                  >

                    {/* GRID */}

                    <div className="absolute inset-0 flex">
                      {days.map(
                        (day) => (
                          <div
                            key={dateKey(
                              day
                            )}
                            className={`h-full w-[72px] shrink-0 border-r border-[#2B2B30]/60 ${
                              isSameDay(
                                day,
                                new Date()
                              )
                                ? "bg-[#C8F065]/[0.025]"
                                : ""
                            }`}
                          />
                        )
                      )}
                    </div>

                    {/* RENTALS */}

                    {vehicleSales.map(
                      (rental) => {
                        const start =
                          parseDate(
                            rental.date_order
                          );

                        const end =
                          parseDate(
                            rental.commitment_date
                          );

                        if (
                          !start ||
                          !end
                        ) {
                          return null;
                        }

                        const monthStart =
                          startOfDay(
                            new Date(
                              month.getFullYear(),
                              month.getMonth(),
                              1
                            )
                          );

                        const monthEnd =
                          endOfDay(
                            new Date(
                              month.getFullYear(),
                              month.getMonth() +
                                1,
                              0
                            )
                          );

                        if (
                          end <
                            monthStart ||
                          start >
                            monthEnd
                        ) {
                          return null;
                        }

                        const visibleStart =
                          start <
                          monthStart
                            ? monthStart
                            : startOfDay(
                                start
                              );

                        const visibleEnd =
                          end >
                          monthEnd
                            ? monthEnd
                            : endOfDay(
                                end
                              );

                        const startDay =
                          Math.max(
                            0,
                            Math.floor(
                              (
                                visibleStart.getTime() -
                                monthStart.getTime()
                              ) /
                                86400000
                            )
                          );

                        const endDay =
                          Math.min(
                            daysInMonth -
                              1,
                            Math.floor(
                              (
                                visibleEnd.getTime() -
                                monthStart.getTime()
                              ) /
                                86400000
                            )
                          );

                        const span =
                          endDay -
                          startDay +
                          1;

                        const rentalState =
                          getRentalState(
                            rental
                          );

                        return (
                          <button
                            key={
                              rental.id
                            }
                            type="button"
                            onClick={() =>
                              onRentalClick(
                                rental
                              )
                            }
                            className={`absolute top-1/2 z-10 flex h-10 -translate-y-1/2 items-center overflow-hidden rounded-lg border px-3 text-left shadow-lg transition hover:z-20 hover:brightness-110 ${rentalState.className}`}
                            style={{
                              left: `calc(${startDay} * var(--day-width) + 5px)`,
                              width: `calc(${span} * var(--day-width) - 10px)`,
                            }}
                          >
                            <span
                              className={`mr-2 h-1.5 w-1.5 shrink-0 rounded-full ${rentalState.dot}`}
                            />

                            <span className="truncate text-[10px] font-semibold">
                              {rental.customer?.name ||
                                "Rental"}
                            </span>
                          </button>
                        );
                      }
                    )}

                    {vehicleSales.length ===
                      0 && (
                      <div
                        className={`absolute inset-y-0 left-0 flex items-center px-5 text-[9px] ${meta.text} opacity-50`}
                      >
                        {
                          meta.label
                        }

                        {meta.unavailable && (
                          <span className="ml-2 rounded-full border border-red-400/20 bg-red-400/10 px-1.5 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-red-400">
                            Indisponible
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            }
          )}

          {vehicles.length ===
            0 && (
            <div className="flex h-72 items-center justify-center text-sm text-zinc-600">
              No vehicles found.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// YEAR VIEW
// ============================================================

function YearView({
  year,
  sales,
  vehicles,
  vehicleMap,
  onMonthClick,
  onRentalClick,
}: {
  year: number;
  sales: Sale[];
  vehicles: Vehicle[];
  vehicleMap: Map<
    number,
    Vehicle
  >;
  onMonthClick: (
    monthIndex: number
  ) => void;
  onRentalClick: (
    rental: Sale
  ) => void;
}) {
  const months =
    Array.from(
      { length: 12 },
      (_, index) =>
        new Date(
          year,
          index,
          1
        )
    );

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">

      {months.map(
        (
          month,
          monthIndex
        ) => {
          const monthStart =
            startOfDay(
              new Date(
                year,
                monthIndex,
                1
              )
            );

          const monthEnd =
            endOfDay(
              new Date(
                year,
                monthIndex + 1,
                0
              )
            );

          const monthSales =
            sales.filter(
              (sale) =>
                rentalOverlapsRange(
                  sale,
                  monthStart,
                  monthEnd
                )
            );

          const rentedVehicleIds =
            new Set(
              monthSales
                .map(
                  (sale) =>
                    sale.vehicle_id
                )
                .filter(
                  (
                    id
                  ): id is number =>
                    typeof id ===
                    "number"
                )
            );

          const daysInMonth =
            new Date(
              year,
              monthIndex + 1,
              0
            ).getDate();

          return (
            <button
              key={
                monthIndex
              }
              type="button"
              onClick={() =>
                onMonthClick(
                  monthIndex
                )
              }
              className="group rounded-2xl border border-[#2B2B30] bg-[#111113] p-4 text-left transition hover:border-zinc-600 hover:bg-[#141416]"
            >

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white">
                    {month.toLocaleDateString(
                      "en-US",
                      {
                        month:
                          "long",
                      }
                    )}
                  </div>

                  <div className="mt-1 text-[9px] text-zinc-700">
                    {
                      monthSales.length
                    }{" "}
                    rentals
                  </div>
                </div>

                <ChevronRight
                  size={15}
                  className="text-zinc-700 transition group-hover:text-zinc-400"
                />
              </div>

              {/* MINI CALENDAR */}

              <div className="mt-4 grid grid-cols-7 gap-1">

                {[
                  "M",
                  "T",
                  "W",
                  "T",
                  "F",
                  "S",
                  "S",
                ].map(
                  (
                    day,
                    index
                  ) => (
                    <div
                      key={`${day}-${index}`}
                      className="flex h-5 items-center justify-center text-[7px] font-semibold text-zinc-700"
                    >
                      {day}
                    </div>
                  )
                )}

                {getCalendarDays(
                  month
                ).map(
                  (day) => {
                    const count =
                      monthSales.filter(
                        (
                          sale
                        ) =>
                          rentalOverlapsDay(
                            sale,
                            day
                          )
                      ).length;

                    const inMonth =
                      day.getMonth() ===
                      monthIndex;

                    return (
                      <div
                        key={dateKey(
                          day
                        )}
                        className={`relative flex h-7 items-center justify-center rounded-md text-[8px] ${
                          inMonth
                            ? "text-zinc-500"
                            : "text-zinc-800"
                        } ${
                          count >
                          0
                            ? "bg-[#F06AAA]/10"
                            : "bg-[#17171A]/50"
                        }`}
                      >
                        {day.getDate()}

                        {count >
                          0 && (
                          <span className="absolute bottom-1 h-0.5 w-0.5 rounded-full bg-[#F06AAA]" />
                        )}
                      </div>
                    );
                  }
                )}
              </div>

              {/* MONTH SUMMARY */}

              <div className="mt-4 grid grid-cols-3 gap-2">

                <div className="rounded-xl border border-[#2B2B30] bg-[#0D0D0F] p-2.5">
                  <div className="text-[8px] uppercase tracking-wider text-zinc-700">
                    Rentals
                  </div>

                  <div className="mt-1 text-sm font-semibold text-[#F06AAA]">
                    {
                      monthSales.length
                    }
                  </div>
                </div>

                <div className="rounded-xl border border-[#2B2B30] bg-[#0D0D0F] p-2.5">
                  <div className="text-[8px] uppercase tracking-wider text-zinc-700">
                    Cars
                  </div>

                  <div className="mt-1 text-sm font-semibold text-white">
                    {
                      rentedVehicleIds.size
                    }
                  </div>
                </div>

                <div className="rounded-xl border border-[#2B2B30] bg-[#0D0D0F] p-2.5">
                  <div className="text-[8px] uppercase tracking-wider text-zinc-700">
                    Days
                  </div>

                  <div className="mt-1 text-sm font-semibold text-white">
                    {
                      daysInMonth
                    }
                  </div>
                </div>

              </div>
            </button>
          );
        }
      )}
    </div>
  );
}

// ============================================================
// PAGE
// ============================================================

export default function CalendarPage() {
  const [
    sales,
    setSales,
  ] = useState<Sale[]>([]);

  const [
    vehicles,
    setVehicles,
  ] = useState<Vehicle[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null
  );

  const [
    month,
    setMonth,
  ] = useState(
    () => new Date()
  );

  const [
    view,
    setView,
  ] = useState<ViewMode>(
    "month"
  );

  const [
    selectedVehicle,
    setSelectedVehicle,
  ] = useState(
    "all"
  );

  const [
    selectedRental,
    setSelectedRental,
  ] = useState<Sale | null>(
    null
  );

  // ==========================================================
  // READ VEHICLE FROM URL
  // ==========================================================

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const vehicle =
      params.get(
        "vehicle"
      );

    if (vehicle) {
      setSelectedVehicle(
        vehicle
      );
    }
  }, []);

  // ==========================================================
  // FETCH ODOO DATA
  // ==========================================================

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError(null);

        const [
          salesResponse,
          carsResponse,
        ] = await Promise.all([
          fetch(
            `${API_URL}/sales`,
            {
              cache:
                "no-store",
            }
          ),
          fetch(
            `${API_URL}/cars`,
            {
              cache:
                "no-store",
            }
          ),
        ]);

        if (
          !salesResponse.ok
        ) {
          throw new Error(
            `Sales API returned ${salesResponse.status}`
          );
        }

        if (
          !carsResponse.ok
        ) {
          throw new Error(
            `Cars API returned ${carsResponse.status}`
          );
        }

        const salesData: SalesResponse =
          await salesResponse.json();

        const carsData: CarsResponse =
          await carsResponse.json();

        setSales(
          salesData.sales ||
            []
        );

        setVehicles(
          carsData.cars ||
            []
        );
      } catch (err) {
        console.error(err);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load calendar."
        );
      } finally {
        setLoading(false);
      }
    }

    void load();
  }, []);

  // ==========================================================
  // VEHICLE MAP
  // ==========================================================

  const vehicleMap =
    useMemo(
      () =>
        new Map(
          vehicles.map(
            (vehicle) => [
              vehicle.id,
              vehicle,
            ]
          )
        ),
      [vehicles]
    );

  // ==========================================================
  // FILTER
  // ==========================================================

  const visibleVehicles =
    useMemo(() => {
      if (
        selectedVehicle ===
        "all"
      ) {
        return vehicles;
      }

      return vehicles.filter(
        (vehicle) =>
          vehicle.id ===
          Number(
            selectedVehicle
          )
      );
    }, [
      vehicles,
      selectedVehicle,
    ]);

  const visibleSales =
    useMemo(() => {
      if (
        selectedVehicle ===
        "all"
      ) {
        return sales;
      }

      return sales.filter(
        (sale) =>
          sale.vehicle_id ===
          Number(
            selectedVehicle
          )
      );
    }, [
      sales,
      selectedVehicle,
    ]);

  // ==========================================================
  // STATS
  // ==========================================================

  const fleetStats =
    useMemo(() => {
      const stats = {
        total:
          visibleVehicles.length,
        available: 0,
        rented: 0,
        cleaning: 0,
        maintenance: 0,
        inactive: 0,
      };

      for (
        const vehicle of visibleVehicles
      ) {
        const status =
          getFleetStatus(
            vehicle.status ||
              null,
            vehicle.active
          );

        if (
          status ===
          "available"
        ) {
          stats.available++;
        }

        if (
          status ===
          "rented"
        ) {
          stats.rented++;
        }

        if (
          status ===
          "cleaning"
        ) {
          stats.cleaning++;
        }

        if (
          status ===
          "maintenance"
        ) {
          stats.maintenance++;
        }

        if (
          status ===
          "inactive"
        ) {
          stats.inactive++;
        }
      }

      return stats;
    }, [
      visibleVehicles,
    ]);

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
    setMonth(
      new Date()
    );
  }

  // ==========================================================
  // YEAR VIEW -> MONTH
  // ==========================================================

  function openYearMonth(
    monthIndex: number
  ) {
    setMonth(
      new Date(
        month.getFullYear(),
        monthIndex,
        1
      )
    );

    setView("month");
  }

  // ==========================================================
  // LOADING
  // ==========================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090B] p-6 text-white">
        <div className="mx-auto max-w-[1900px]">
          <div className="h-8 w-56 animate-pulse rounded-lg bg-[#17171A]" />

          <div className="mt-6 h-[720px] animate-pulse rounded-2xl border border-[#2B2B30] bg-[#111113]" />
        </div>
      </div>
    );
  }

  // ==========================================================
  // ERROR
  // ==========================================================

  if (error) {
    return (
      <div className="min-h-screen bg-[#09090B] p-6 text-white">
        <div className="mx-auto max-w-[1900px]">
          <div className="rounded-2xl border border-red-400/20 bg-red-400/5 p-6">
            <div className="text-sm font-semibold text-red-300">
              Unable to load calendar
            </div>

            <div className="mt-2 text-xs text-zinc-600">
              {error}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ==========================================================
  // PAGE
  // ==========================================================

  return (
    <div className="min-h-screen bg-[#09090B] text-white">

      <div className="mx-auto max-w-[1900px] p-4 sm:p-6 lg:p-8">

        {/* ====================================================
            HEADER
        ==================================================== */}

        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">

          <div>
            <div className="flex items-center gap-2 text-[9px] uppercase tracking-[0.16em] text-zinc-700">
              <CalendarDays
                size={13}
              />
              Operations
            </div>

            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Rental Calendar
            </h1>

            <p className="mt-2 max-w-xl text-sm text-zinc-500">
              Plan rentals, follow vehicle
              availability and see your fleet
              at a glance.
            </p>
          </div>

          {/* CONTROLS */}

          <div className="flex flex-wrap items-center gap-2">

            {view !==
              "year" && (
              <>
                <button
                  type="button"
                  onClick={
                    goToday
                  }
                  className="h-10 rounded-xl border border-[#2B2B30] bg-[#111113] px-4 text-xs font-medium text-zinc-400 hover:border-zinc-600 hover:text-white"
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={
                    previousMonth
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2B2B30] bg-[#111113] text-zinc-500 hover:border-zinc-600 hover:text-white"
                >
                  <ChevronLeft
                    size={16}
                  />
                </button>

                <div className="flex h-10 min-w-[175px] items-center justify-center rounded-xl border border-[#2B2B30] bg-[#111113] px-4 text-sm font-semibold">
                  {formatMonth(
                    month
                  )}
                </div>

                <button
                  type="button"
                  onClick={
                    nextMonth
                  }
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2B2B30] bg-[#111113] text-zinc-500 hover:border-zinc-600 hover:text-white"
                >
                  <ChevronRight
                    size={16}
                  />
                </button>
              </>
            )}

            {view ===
              "year" && (
              <div className="flex h-10 items-center rounded-xl border border-[#2B2B30] bg-[#111113] px-5 text-sm font-semibold">
                {formatYear(
                  month
                )}
              </div>
            )}

            <select
              value={
                selectedVehicle
              }
              onChange={(
                event
              ) =>
                setSelectedVehicle(
                  event.target
                    .value
                )
              }
              className="h-10 max-w-[190px] rounded-xl border border-[#2B2B30] bg-[#111113] px-3 text-xs font-medium text-zinc-300 outline-none hover:border-zinc-600"
            >
              <option value="all">
                All vehicles
              </option>

              {vehicles.map(
                (vehicle) => (
                  <option
                    key={
                      vehicle.id
                    }
                    value={
                      vehicle.id
                    }
                  >
                    {vehicle.name}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* ====================================================
            FLEET SNAPSHOT
        ==================================================== */}

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">

          <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-700">
              Fleet
            </div>

            <div className="mt-2 text-xl font-semibold">
              {fleetStats.total}
            </div>
          </div>

          <div className="rounded-2xl border border-[#C8F065]/10 bg-[#C8F065]/[0.025] p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-[#C8F065]/60">
              Disponible
            </div>

            <div className="mt-2 text-xl font-semibold text-[#C8F065]">
              {
                fleetStats.available
              }
            </div>
          </div>

          <div className="rounded-2xl border border-[#F06AAA]/10 bg-[#F06AAA]/[0.025] p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-[#F06AAA]/60">
              Loué
            </div>

            <div className="mt-2 text-xl font-semibold text-[#F06AAA]">
              {
                fleetStats.rented
              }
            </div>
          </div>

          <div className="rounded-2xl border border-blue-400/10 bg-blue-400/[0.025] p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-blue-400/60">
              Nettoyage
            </div>

            <div className="mt-2 text-xl font-semibold text-blue-400">
              {
                fleetStats.cleaning
              }
            </div>
          </div>

          <div className="rounded-2xl border border-violet-400/10 bg-violet-400/[0.025] p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-violet-400/60">
              Maintenance
            </div>

            <div className="mt-2 text-xl font-semibold text-violet-400">
              {
                fleetStats.maintenance
              }
            </div>
          </div>

          <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] p-4">
            <div className="text-[9px] uppercase tracking-[0.14em] text-zinc-700">
              Rentals
            </div>

            <div className="mt-2 text-xl font-semibold">
              {
                visibleSales.length
              }
            </div>
          </div>
        </div>

        {/* ====================================================
            VIEW SWITCHER
        ==================================================== */}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex w-fit rounded-xl border border-[#2B2B30] bg-[#111113] p-1">

            <button
              type="button"
              onClick={() =>
                setView(
                  "month"
                )
              }
              className={`flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-medium transition ${
                view ===
                "month"
                  ? "bg-[#17171A] text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              <CalendarDays
                size={14}
              />
              Month
            </button>

            <button
              type="button"
              onClick={() =>
                setView(
                  "timeline"
                )
              }
              className={`flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-medium transition ${
                view ===
                "timeline"
                  ? "bg-[#17171A] text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              <Clock3
                size={14}
              />
              Timeline
            </button>

            <button
              type="button"
              onClick={() =>
                setView(
                  "year"
                )
              }
              className={`flex h-9 items-center gap-2 rounded-lg px-4 text-xs font-medium transition ${
                view ===
                "year"
                  ? "bg-[#17171A] text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              <CalendarDays
                size={14}
              />
              Year
            </button>
          </div>

          {/* LEGEND */}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">

            <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-[#C8F065]" />
              Disponible
            </div>

            <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-[#F06AAA]" />
              Loué
            </div>

            <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
              Nettoyage
            </div>

            <div className="flex items-center gap-1.5 text-[9px] text-zinc-600">
              <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
              Maintenance
            </div>

            <span className="rounded-full border border-red-400/20 bg-red-400/10 px-2 py-0.5 text-[7px] font-semibold uppercase tracking-wider text-red-400">
              Indisponible
            </span>
          </div>
        </div>

        {/* ====================================================
            MONTH
        ==================================================== */}

        {view ===
          "month" && (
          <div className="mt-4">
            <MonthView
              month={
                month
              }
              sales={
                visibleSales
              }
              vehicleMap={
                vehicleMap
              }
              onRentalClick={(
                rental
              ) =>
                setSelectedRental(
                  rental
                )
              }
            />
          </div>
        )}

        {/* ====================================================
            TIMELINE
        ==================================================== */}

        {view ===
          "timeline" && (
          <div className="mt-4">
            <TimelineView
              month={
                month
              }
              vehicles={
                visibleVehicles
              }
              sales={
                visibleSales
              }
              vehicleMap={
                vehicleMap
              }
              onRentalClick={(
                rental
              ) =>
                setSelectedRental(
                  rental
                )
              }
            />
          </div>
        )}

        {/* ====================================================
            YEAR
        ==================================================== */}

        {view ===
          "year" && (
          <div className="mt-4">
            <YearView
              year={
                month.getFullYear()
              }
              sales={
                visibleSales
              }
              vehicles={
                visibleVehicles
              }
              vehicleMap={
                vehicleMap
              }
              onMonthClick={(
                monthIndex
              ) =>
                openYearMonth(
                  monthIndex
                )
              }
              onRentalClick={(
                rental
              ) =>
                setSelectedRental(
                  rental
                )
              }
            />
          </div>
        )}

        {/* ====================================================
            FOOTER
        ==================================================== */}

        <div className="mt-4 flex items-center justify-between px-1 text-[9px] text-zinc-700">
          <span>
            Odoo fleet & rental data
          </span>

          <span>
            Rental OS
          </span>
        </div>
      </div>

      {/* ======================================================
          RENTAL MODAL
      ====================================================== */}

      {selectedRental && (
        <RentalModal
          rental={
            selectedRental
          }
          vehicle={
            selectedRental.vehicle_id
              ? vehicleMap.get(
                  selectedRental.vehicle_id
                ) ||
                null
              : null
          }
          onClose={() =>
            setSelectedRental(
              null
            )
          }
        />
      )}
    </div>
  );
}
