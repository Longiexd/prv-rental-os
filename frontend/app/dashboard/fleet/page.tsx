"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CalendarDays,
  Car,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock3,
  Gauge,
  LayoutGrid,
  List,
  MapPin,
  Search,
  UserRound,
  Wrench,
  X,
} from "lucide-react";

import {
  getFleetStatus as classifyFleetStatus,
  fleetStatusMeta,
  toneClasses,
  type FleetStatus,
} from "@/lib/status";
import {
  parseDate as sharedParseDate,
  formatDate as sharedFormatDate,
} from "@/lib/format";
import { SortableHeader, type SortDirection } from "@/components/ui/SortableHeader";
import { API_URL, apiRequest } from "@/lib/api-config";

// ============================================================
// TYPES
// ============================================================

type CarData = {
  id: number;
  name: string;
  license_plate: string | null;
  model: string | null;
  status: string | null;

  brand?: string | null;
  category?: string | null;
  location?: string | null;
  odometer?: number | null;
  odometer_unit?: string | null;
  active?: boolean;
};

type CarsResponse = {
  count: number;
  cars: CarData[];
};

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
  returned?: boolean;
};

type SalesResponse = {
  count: number;
  sales: Sale[];
};

type SortKey =
  | "name"
  | "plate"
  | "model"
  | "status"
  | "rental"
  | "location"
  | "odometer";

// ============================================================
// CONFIG
// ============================================================

// ============================================================
// NORMALIZATION
// ============================================================

function normalize(
  value: string | null | undefined
) {
  return (
    value?.toLowerCase().trim() || ""
  );
}

// ============================================================
// ODOO FLEET STATE
//
// Classification and colors now live once in lib/status.ts —
// these are thin wrappers that keep this file's existing call
// signature (positional args, icon-augmented meta) so nothing
// below has to change, while the actual duplicated logic that
// used to live here is gone.
// ============================================================

function getFleetStatus(
  status: string | null,
  active?: boolean
): FleetStatus {
  return classifyFleetStatus({ status, active });
}

const STATUS_ICON: Record<FleetStatus, typeof Car> = {
  available: CheckCircle2,
  reserved: CalendarClock,
  rented: UserRound,
  returnDue: Clock3,
  cleaning: Car,
  maintenance: Wrench,
  unavailable: Clock3,
  inactive: Clock3,
  unknown: Car,
};

function getStatusMeta(
  fleetStatus: FleetStatus,
  originalStatus: string | null
) {
  const meta = fleetStatusMeta(fleetStatus);
  const classes = toneClasses(meta.tone);

  return {
    label: fleetStatus === "unknown" ? originalStatus || "Unknown" : meta.label,
    className: `${classes.border} ${classes.bg} ${classes.text}`,
    dot: classes.dot,
    icon: STATUS_ICON[fleetStatus],
  };
}

// ============================================================
// DATES
// ============================================================

function parseDate(value: string | null) {
  return sharedParseDate(value);
}

function formatDate(value: string | null) {
  return sharedFormatDate(value);
}

// ============================================================
// RENTAL HELPERS
// ============================================================

function getVehicleRental(
  carId: number,
  sales: Sale[]
): Sale | null {
  const rentals = sales
    .filter(
      (sale) =>
        sale.vehicle_id === carId &&
        sale.state !== "cancel" &&
        !sale.returned
    )
    .sort((a, b) => {
      const aDate =
        parseDate(
          a.date_order
        )?.getTime() || 0;

      const bDate =
        parseDate(
          b.date_order
        )?.getTime() || 0;

      return bDate - aDate;
    });

  if (!rentals.length) {
    return null;
  }

  const now = new Date();

  const active = rentals.find(
    (sale) => {
      const start =
        parseDate(
          sale.date_order
        );

      const end =
        parseDate(
          sale.commitment_date
        );

      if (!start || !end) {
        return false;
      }

      return (
        now >= start &&
        now <= end
      );
    }
  );

  if (active) {
    return active;
  }

  const next = rentals
    .filter((sale) => {
      const start =
        parseDate(
          sale.date_order
        );

      return (
        start !== null &&
        start > now
      );
    })
    .sort((a, b) => {
      const aDate =
        parseDate(
          a.date_order
        )?.getTime() || 0;

      const bDate =
        parseDate(
          b.date_order
        )?.getTime() || 0;

      return aDate - bDate;
    })[0];

  return next || rentals[0];
}

// ============================================================
// STATUS BADGE
// ============================================================

function StatusBadge({
  car,
  compact = false,
}: {
  car: CarData;
  compact?: boolean;
}) {
  const fleetStatus =
    getFleetStatus(
      car.status,
      car.active
    );

  const meta =
    getStatusMeta(
      fleetStatus,
      car.status
    );

  const Icon = meta.icon;

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border ${
        compact
          ? "px-2.5 py-1 text-[10px]"
          : "px-3 py-1.5 text-xs"
      } font-semibold ${meta.className}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${meta.dot}`}
      />

      {!compact && (
        <Icon size={11} />
      )}

      {meta.label}
    </span>
  );
}

// ============================================================
// VEHICLE CARD
// ============================================================

function VehicleCard({
  car,
  rental,
  onClick,
  onAction,
}: {
  car: CarData;
  rental: Sale | null;
  onClick: () => void;
  onAction: (
    vehicleId: number,
    action: "return" | "mark-available" | "needs-diagnosis",
    nextState?: "Nettoyage" | "Disponible" | "Maintenance"
  ) => void;
}) {
  const fleetStatus =
    getFleetStatus(
      car.status,
      car.active
    );

  const [showReturnChoices, setShowReturnChoices] = useState(false);

  const needsReturn =
    fleetStatus === "rented" || fleetStatus === "returnDue";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter") onClick();
      }}
      className="group relative overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113] text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#414148] hover:bg-[#151517] hover:shadow-2xl hover:shadow-black/20"
    >
      <div
        className={`absolute inset-x-0 top-0 h-px ${
          fleetStatus ===
          "available"
            ? "bg-[#C8F065]/40"
            : fleetStatus ===
                "rented"
              ? "bg-[#F06AAA]/40"
              : fleetStatus ===
                  "cleaning"
                ? "bg-blue-400/40"
                : fleetStatus ===
                    "maintenance"
                  ? "bg-violet-400/40"
                  : "bg-transparent"
        }`}
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#2B2B30] bg-[#17171A]">
              <Car
                size={20}
                className="text-zinc-400 transition group-hover:text-white"
              />
            </div>

            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">
                {car.model ||
                  car.name}
              </div>

              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
                <span>
                  {car.name}
                </span>

                {car.license_plate && (
                  <>
                    <span>
                      •
                    </span>

                    <span className="font-mono">
                      {
                        car.license_plate
                      }
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <ChevronRight
            size={16}
            className="shrink-0 text-zinc-700 transition group-hover:translate-x-0.5 group-hover:text-zinc-400"
          />
        </div>

        <div className="mt-5">
          <StatusBadge car={car} />
        </div>

        {rental &&
          fleetStatus ===
            "rented" && (
            <div className="mt-5 rounded-xl border border-[#2B2B30] bg-[#17171A] p-3.5">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                <UserRound size={12} />
                Rented to
              </div>

              <div className="mt-2 truncate text-sm font-medium text-white">
                {rental.customer
                  ?.name ||
                  "Customer"}
              </div>

              <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500">
                <CalendarDays size={12} />

                <span>
                  {formatDate(
                    rental.date_order
                  )}
                </span>

                <span>
                  →
                </span>

                <span>
                  {formatDate(
                    rental.commitment_date
                  )}
                </span>
              </div>
            </div>
          )}

        {fleetStatus ===
          "cleaning" && (
          <div className="mt-5 rounded-xl border border-blue-400/10 bg-blue-400/[0.04] p-3.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-blue-400/70">
              Operational state
            </div>

            <div className="mt-1 text-sm font-medium text-white">
              En nettoyage
            </div>
          </div>
        )}

        {fleetStatus ===
          "maintenance" && (
          <div className="mt-5 rounded-xl border border-violet-400/10 bg-violet-400/[0.04] p-3.5">
            <div className="text-[10px] uppercase tracking-[0.12em] text-violet-400/70">
              Operational state
            </div>

            <div className="mt-1 text-sm font-medium text-white">
              Maintenance
            </div>
          </div>
        )}

        {fleetStatus ===
          "available" && (
          <div className="mt-5 rounded-xl border border-[#2B2B30] bg-[#17171A]/60 p-3.5">
            <div className="text-xs text-zinc-600">
              No active rental
            </div>

            <div className="mt-1 text-sm text-zinc-400">
              Ready for operations
            </div>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 text-xs">
          <div className="flex min-w-0 items-center gap-2 text-zinc-600">
            <MapPin size={12} />

            <span className="truncate">
              {car.location ||
                "No location"}
            </span>
          </div>

          {car.odometer !=
            null && (
            <div className="flex shrink-0 items-center gap-1.5 text-zinc-600">
              <Gauge size={12} />

              <span>
                {car.odometer.toLocaleString()}{" "}
                {car.odometer_unit ||
                  "km"}
              </span>
            </div>
          )}
        </div>
        {(needsReturn ||
          fleetStatus === "cleaning" ||
          fleetStatus === "maintenance") && (
          <div
            className="mt-4"
            onClick={(event) => event.stopPropagation()}
          >
            {needsReturn && !showReturnChoices && (
              <button
                type="button"
                onClick={() => setShowReturnChoices(true)}
                className={`w-full rounded-lg border py-2 text-xs font-medium transition ${
                  fleetStatus === "returnDue"
                    ? "border-danger/30 bg-danger/10 text-danger hover:bg-danger/20"
                    : "border-[#2B2B30] bg-[#17171A] text-zinc-300 hover:bg-[#1D1D20]"
                }`}
              >
                {fleetStatus === "returnDue"
                  ? "Confirm return — overdue"
                  : "Mark as returned"}
              </button>
            )}

            {needsReturn && showReturnChoices && (
              <div className="space-y-1.5">
                <div className="mb-1 text-[10px] text-zinc-500">
                  Send vehicle to:
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      onAction(car.id, "return", "Nettoyage")
                    }
                    className="rounded-lg border border-blue-400/30 bg-blue-400/10 py-1.5 text-[11px] font-medium text-blue-300 transition hover:bg-blue-400/20"
                  >
                    Nettoyage
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onAction(car.id, "return", "Disponible")
                    }
                    className="rounded-lg border border-[#C8F065]/30 bg-[#C8F065]/10 py-1.5 text-[11px] font-medium text-[#C8F065] transition hover:bg-[#C8F065]/20"
                  >
                    Disponible
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      onAction(car.id, "return", "Maintenance")
                    }
                    className="rounded-lg border border-violet-400/30 bg-violet-400/10 py-1.5 text-[11px] font-medium text-violet-300 transition hover:bg-violet-400/20"
                  >
                    Maintenance
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowReturnChoices(false)}
                  className="w-full py-1 text-[10px] text-zinc-600 hover:text-zinc-400"
                >
                  Cancel
                </button>
              </div>
            )}

            {!needsReturn &&
              (fleetStatus === "cleaning" ||
                fleetStatus === "maintenance") && (
                <button
                  type="button"
                  onClick={() =>
                    onAction(car.id, "mark-available")
                  }
                  className="w-full rounded-lg border border-[#C8F065]/30 bg-[#C8F065]/10 py-2 text-xs font-medium text-[#C8F065] transition hover:bg-[#C8F065]/20"
                >
                  Mark as available
                </button>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// VEHICLE MODAL
// ============================================================

function VehicleModal({
  car,
  rental,
  onClose,
  onAction,
}: {
  car: CarData;
  rental: Sale | null;
  onClose: () => void;
  onAction: (
    vehicleId: number,
    action: "return" | "mark-available" | "needs-diagnosis",
    nextState?: "Nettoyage" | "Disponible" | "Maintenance"
  ) => void;
}) {
  const fleetStatus =
    getFleetStatus(
      car.status,
      car.active
    );

  const meta =
    getStatusMeta(
      fleetStatus,
      car.status
    );

  const Icon = meta.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close vehicle details"
        onClick={onClose}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
      />

      <div className="relative z-10 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#0D0D0F] shadow-2xl shadow-black/50">
        {/* HEADER */}

        <div className="flex items-center justify-between border-b border-[#2B2B30] px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2B2B30] bg-[#17171A]">
              <Car
                size={18}
                className="text-zinc-300"
              />
            </div>

            <div>
              <div className="text-sm font-semibold text-white">
                Vehicle details
              </div>

              <div className="mt-0.5 text-xs text-zinc-600">
                Vehicle #
                {car.id}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2B2B30] bg-[#111113] text-zinc-500 transition hover:bg-[#17171A] hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        {/* CONTENT */}

        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                Vehicle
              </div>

              <h2 className="mt-2 font-[Syne] text-2xl font-semibold tracking-tight text-white">
                {car.model ||
                  car.name}
              </h2>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-500">
                <span>
                  {car.name}
                </span>

                {car.license_plate && (
                  <>
                    <span>
                      •
                    </span>

                    <span className="font-mono">
                      {
                        car.license_plate
                      }
                    </span>
                  </>
                )}
              </div>
            </div>

            <StatusBadge car={car} />
          </div>

          {/* AVAILABILITY */}

          <div className="mt-6 rounded-2xl border border-[#2B2B30] bg-[#111113] p-5">
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${meta.className}`}
              >
                <Icon size={18} />
              </div>

              <div className="min-w-0">
                <div className="text-xs text-zinc-600">
                  Current status
                </div>

                <div className="mt-1 text-base font-semibold text-white">
                  {meta.label}
                </div>

                {car.status && (
                  <div className="mt-1 text-xs text-zinc-600">
                    Status:{" "}
                    <span className="text-zinc-400">
                      {car.status}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {fleetStatus ===
              "rented" &&
            rental ? (
              <div className="mt-5 border-t border-[#2B2B30] pt-5">
                <div className="mb-4 text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                  Current rental
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                      Customer
                    </div>

                    {rental.customer ? (
                      <Link
                        href={`/dashboard/customers/${rental.customer.id}`}
                        onClick={onClose}
                        className="mt-2 flex items-center gap-2 text-sm font-medium text-white transition hover:text-[#C8F065]"
                      >
                        <UserRound
                          size={14}
                          className="text-[#F06AAA]"
                        />

                        <span className="truncate">
                          {
                            rental
                              .customer
                              .name
                          }
                        </span>
                      </Link>
                    ) : (
                      <div className="mt-2 text-sm text-zinc-500">
                        No customer
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                      Pickup
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-white">
                      <CalendarDays
                        size={14}
                        className="text-zinc-500"
                      />

                      {formatDate(
                        rental.date_order
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                      Return
                    </div>

                    <div className="mt-2 flex items-center gap-2 text-sm font-medium text-white">
                      <Clock3
                        size={14}
                        className="text-zinc-500"
                      />

                      {formatDate(
                        rental.commitment_date
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-5 rounded-xl border border-[#2B2B30] bg-[#17171A] p-4">
                  <div className="text-[10px] uppercase tracking-[0.12em] text-zinc-600">
                    Rental order
                  </div>

                  <div className="mt-1 font-mono text-sm font-medium text-white">
                    {rental.name}
                  </div>
                </div>
              </div>
            ) : fleetStatus ===
              "cleaning" ? (
              <div className="mt-5 border-t border-[#2B2B30] pt-5">
                <div className="rounded-xl border border-blue-400/10 bg-blue-400/[0.04] p-4">
                  <div className="text-sm font-medium text-white">
                    En nettoyage
                  </div>

                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    This vehicle is currently being prepared and should not be assigned to a new rental.
                  </div>
                </div>
              </div>
            ) : fleetStatus ===
              "maintenance" ? (
              <div className="mt-5 border-t border-[#2B2B30] pt-5">
                <div className="rounded-xl border border-violet-400/10 bg-violet-400/[0.04] p-4">
                  <div className="text-sm font-medium text-white">
                    Maintenance
                  </div>

                  <div className="mt-1 text-xs leading-5 text-zinc-500">
                    This vehicle is currently unavailable for rental operations.
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-5 border-t border-[#2B2B30] pt-5">
                <div className="text-sm font-medium text-white">
                  No active rental
                </div>

                <div className="mt-1 text-xs text-zinc-600">
                  No rental currently associated with this vehicle.
                </div>
              </div>
            )}
          </div>

          {/* LINKS */}

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {rental?.customer && (
              <Link
                href={`/dashboard/customers/${rental.customer.id}`}
                onClick={onClose}
                className="flex h-11 items-center justify-between rounded-xl border border-[#2B2B30] bg-[#17171A] px-4 text-xs font-medium text-zinc-300 transition hover:border-[#414148] hover:bg-[#1B1B1E] hover:text-white"
              >
                <span className="flex items-center gap-2">
                  <UserRound size={14} />
                  View customer
                </span>

                <ArrowRight size={14} />
              </Link>
            )}

            <Link
              href={`/dashboard/calendar?vehicle=${car.id}`}
              onClick={onClose}
              className="flex h-11 items-center justify-between rounded-xl bg-[#C8F065] px-4 text-xs font-semibold text-black transition hover:bg-[#d7ff80]"
            >
              <span className="flex items-center gap-2">
                <CalendarDays size={14} />
                View rental calendar
              </span>

              <ArrowRight size={14} />
            </Link>
          </div>

          {/* VEHICLE INFORMATION */}

          <div className="mt-6">
            <div className="mb-3 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
              Vehicle information
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113]">
              {[
                [
                  "Vehicle",
                  car.name,
                ],
                [
                  "Model",
                  car.model ||
                    "—",
                ],
                [
                  "Brand",
                  car.brand ||
                    "—",
                ],
                [
                  "Category",
                  car.category ||
                    "—",
                ],
                [
                  "License plate",
                  car.license_plate ||
                    "—",
                ],
                [
                  "Location",
                  car.location ||
                    "—",
                ],
                [
                  "Odometer",
                  car.odometer !=
                  null
                    ? `${car.odometer.toLocaleString()} ${
                        car.odometer_unit ||
                        "km"
                      }`
                    : "—",
                ],
                [
                  "Fleet ID",
                  `#${car.id}`,
                ],
              ].map(
                (
                  [label, value],
                  index
                ) => (
                  <div
                    key={label}
                    className={`flex items-center justify-between gap-5 px-5 py-3.5 ${
                      index <
                      7
                        ? "border-b border-[#2B2B30]"
                        : ""
                    }`}
                  >
                    <span className="text-xs text-zinc-600">
                      {label}
                    </span>

                    <span className="text-right text-sm text-zinc-300">
                      {value}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* ACTIONS */}

        {(fleetStatus === "rented" ||
          fleetStatus === "returnDue" ||
          fleetStatus === "cleaning" ||
          fleetStatus === "maintenance") && (
          <div className="border-t border-[#2B2B30] bg-[#0A0A0B] px-5 py-4 sm:px-6">
            {(fleetStatus === "rented" ||
              fleetStatus === "returnDue") && (
              <>
                <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                  Confirm return — send to:
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onAction(car.id, "return", "Nettoyage")
                    }
                    className="flex-1 rounded-lg border border-blue-400/30 bg-blue-400/10 py-2 text-xs font-medium text-blue-300 transition hover:bg-blue-400/20"
                  >
                    Nettoyage
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAction(car.id, "return", "Disponible")
                    }
                    className="flex-1 rounded-lg border border-[#C8F065]/30 bg-[#C8F065]/10 py-2 text-xs font-medium text-[#C8F065] transition hover:bg-[#C8F065]/20"
                  >
                    Disponible
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAction(car.id, "return", "Maintenance")
                    }
                    className="flex-1 rounded-lg border border-violet-400/30 bg-violet-400/10 py-2 text-xs font-medium text-violet-300 transition hover:bg-violet-400/20"
                  >
                    Maintenance
                  </button>
                </div>
              </>
            )}

            {fleetStatus === "cleaning" && (
              <>
                <div className="mb-2 text-[10px] uppercase tracking-[0.14em] text-zinc-600">
                  Cleaning status
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onAction(car.id, "mark-available")
                    }
                    className="flex-1 rounded-lg border border-[#C8F065]/30 bg-[#C8F065]/10 py-2 text-xs font-medium text-[#C8F065] transition hover:bg-[#C8F065]/20"
                  >
                    Cleaning finished — Disponible
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onAction(
                        car.id,
                        "needs-diagnosis"
                      )
                    }
                    className="flex-1 rounded-lg border border-violet-400/30 bg-violet-400/10 py-2 text-xs font-medium text-violet-300 transition hover:bg-violet-400/20"
                  >
                    Needs diagnosis — Maintenance
                  </button>
                </div>
              </>
            )}

            {fleetStatus === "maintenance" && (
              <button
                type="button"
                onClick={() => onAction(car.id, "mark-available")}
                className="w-full rounded-lg border border-[#C8F065]/30 bg-[#C8F065]/10 py-2 text-xs font-medium text-[#C8F065] transition hover:bg-[#C8F065]/20"
              >
                Repairs finished — mark Disponible
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// SORT ICON
// ============================================================

// ============================================================
// TABLE (uses the shared SortableHeader from components/ui)
// ============================================================


// ============================================================
// PAGE
// ============================================================

export default function FleetPage() {
  const [cars, setCars] =
    useState<CarData[]>([]);

  const [sales, setSales] =
    useState<Sale[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState<FleetStatus | null>(null);

  // LIST REMAINS DEFAULT
  const [view, setView] =
    useState<"list" | "cards">(
      "list"
    );

  const [selectedCar, setSelectedCar] =
    useState<CarData | null>(
      null
    );

  const [sortKey, setSortKey] =
    useState<SortKey>("name");

  const [sortDirection, setSortDirection] =
    useState<SortDirection>("asc");

  // ==========================================================
  // FETCH
  // ==========================================================

  async function loadFleet() {
      try {
        setLoading(true);
        setError(null);

        // Recompute Reserved/Louee/Retour du against today's
        // date before fetching — without this, a vehicle's
        // state only ever updates at the moment a rental is
        // created, and silently goes stale as days pass.
        try {
          await apiRequest(`${API_URL}/cars/sync`, { method: "POST" });
        } catch (syncError) {
          console.error("Fleet state sync failed:", syncError);
        }

        const [
          carsResponse,
          salesResponse,
        ] = await Promise.all([
          apiRequest(`${API_URL}/cars`, {
            cache: "no-store",
          }),
          apiRequest(`${API_URL}/sales`, {
            cache: "no-store",
          }),
        ]);

        if (!carsResponse.ok) {
          throw new Error(
            `Cars API returned ${carsResponse.status}`
          );
        }

        if (!salesResponse.ok) {
          throw new Error(
            `Sales API returned ${salesResponse.status}`
          );
        }

        const carsData: CarsResponse =
          await carsResponse.json();

        const salesData: SalesResponse =
          await salesResponse.json();

        setCars(
          carsData.cars || []
        );

        setSales(
          salesData.sales || []
        );
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

  useEffect(() => {
    void loadFleet();
  }, []);

  // ==========================================================
  // FLEET STATE ACTIONS
  // "Confirm return" / "Mark as available" — reachable from
  // both vehicle cards and KPI results per the same action set.
  // ==========================================================

  async function handleVehicleAction(
    vehicleId: number,
    action: "return" | "mark-available" | "needs-diagnosis",
    nextState?: "Nettoyage" | "Disponible" | "Maintenance"
  ) {
    try {
      const response = await apiRequest(
        `${API_URL}/cars/${vehicleId}/${action}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body:
            action === "return"
              ? JSON.stringify({
                  next_state: nextState || "Nettoyage",
                })
              : undefined,
        }
      );

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(
          data?.detail || `API returned ${response.status}`
        );
      }

      await loadFleet();
    } catch (err) {
      console.error(
        `Failed to ${action} vehicle ${vehicleId}:`,
        err
      );
      setError(
        err instanceof Error
          ? err.message
          : `Unable to update this vehicle.`
      );
    }
  }

  // ==========================================================
  // FLEET VIEW MODEL
  // ==========================================================

  const fleet = useMemo(() => {
    return cars.map((car) => ({
      car,
      status: getFleetStatus(
        car.status,
        car.active
      ),
      rental: getVehicleRental(
        car.id,
        sales
      ),
    }));
  }, [cars, sales]);

  // ==========================================================
  // SEARCH
  // ==========================================================

  const searchedFleet =
    useMemo(() => {
      const query =
        search.toLowerCase().trim();

      return fleet.filter(
        ({ car, status, rental }) => {
          if (
            statusFilter &&
            status !== statusFilter
          ) {
            return false;
          }

          if (!query) return true;

          const label =
            getStatusMeta(
              getFleetStatus(
                car.status,
                car.active
              ),
              car.status
            ).label;

          return [
            car.name,
            car.license_plate,
            car.model,
            car.brand,
            car.category,
            car.location,
            car.status,
            label,
            rental?.name,
            rental?.customer?.name,
          ]
            .filter(Boolean)
            .some((value) =>
              value!
                .toLowerCase()
                .includes(query)
            );
        }
      );
    }, [fleet, search, statusFilter]);

  // ==========================================================
  // SORT
  // ==========================================================

  const filteredFleet =
    useMemo(() => {
      const result = [
        ...searchedFleet,
      ];

      result.sort((a, b) => {
        let aValue = "";
        let bValue = "";

        switch (sortKey) {
          case "name":
            aValue = normalize(
              a.car.name
            );
            bValue = normalize(
              b.car.name
            );
            break;

          case "plate":
            aValue = normalize(
              a.car.license_plate
            );
            bValue = normalize(
              b.car.license_plate
            );
            break;

          case "model":
            aValue = normalize(
              a.car.model
            );
            bValue = normalize(
              b.car.model
            );
            break;

          case "status":
            aValue = normalize(
              getStatusMeta(
                a.status,
                a.car.status
              ).label
            );

            bValue = normalize(
              getStatusMeta(
                b.status,
                b.car.status
              ).label
            );
            break;

          case "rental":
            aValue = normalize(
              a.rental
                ?.customer?.name ||
                ""
            );

            bValue = normalize(
              b.rental
                ?.customer?.name ||
                ""
            );
            break;

          case "location":
            aValue = normalize(
              a.car.location
            );

            bValue = normalize(
              b.car.location
            );
            break;

          case "odometer":
            return (
              ((a.car.odometer ||
                0) -
                (b.car.odometer ||
                  0)) *
              (sortDirection ===
              "asc"
                ? 1
                : -1)
            );
        }

        const comparison =
          aValue.localeCompare(
            bValue,
            undefined,
            {
              numeric: true,
              sensitivity:
                "base",
            }
          );

        return (
          comparison *
          (sortDirection ===
          "asc"
            ? 1
            : -1)
        );
      });

      return result;
    }, [
      searchedFleet,
      sortKey,
      sortDirection,
    ]);

  // ==========================================================
  // SORT HANDLER
  // ==========================================================

  function handleSort(
    key: SortKey
  ) {
    if (sortKey === key) {
      setSortDirection(
        (current) =>
          current === "asc"
            ? "desc"
            : "asc"
      );

      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  }

  // ==========================================================
  // COUNTS
  // ==========================================================

  const counts = useMemo(() => {
    return {
      total: fleet.length,

      available:
        fleet.filter(
          (item) =>
            item.status ===
            "available"
        ).length,

      reserved:
        fleet.filter(
          (item) => item.status === "reserved"
        ).length,

      rented:
        fleet.filter(
          (item) =>
            item.status ===
            "rented"
        ).length,

      returnDue:
        fleet.filter(
          (item) => item.status === "returnDue"
        ).length,

      cleaning:
        fleet.filter(
          (item) =>
            item.status ===
            "cleaning"
        ).length,

      maintenance:
        fleet.filter(
          (item) =>
            item.status ===
            "maintenance"
        ).length,
    };
  }, [fleet]);

  // ==========================================================
  // SELECTED
  // ==========================================================

  const selectedDetails =
    selectedCar
      ? fleet.find(
          (item) =>
            item.car.id ===
            selectedCar.id
        )
      : null;

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
              <span>
                Workspace
              </span>

              <span>/</span>

              <span className="text-[#A1A1AA]">
                Vehicles
              </span>
            </div>

            <h1 className="font-[Syne] text-[28px] font-semibold tracking-[-0.035em] text-white sm:text-[32px]">
              Vehicles
            </h1>

            <p className="mt-1 text-sm text-[#71717A]">
              Vehicle availability and operational status.
            </p>
          </div>

          {/* VIEW SWITCHER */}

          <div className="flex h-9 items-center rounded-lg border border-[#2B2B30] bg-[#111113] p-1">
            <button
              type="button"
              onClick={() =>
                setView("list")
              }
              className={`flex h-7 items-center gap-2 rounded-md px-3 text-xs font-medium transition ${
                view === "list"
                  ? "bg-[#2B2B30] text-white"
                  : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              <List size={13} />
              List
            </button>

            <button
              type="button"
              onClick={() =>
                setView("cards")
              }
              className={`flex h-7 items-center gap-2 rounded-md px-3 text-xs font-medium transition ${
                view === "cards"
                  ? "bg-[#2B2B30] text-white"
                  : "text-zinc-600 hover:text-zinc-300"
              }`}
            >
              <LayoutGrid
                size={13}
              />
              Cards
            </button>
          </div>
        </section>

        {/* KPI */}

        <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <button
            type="button"
            onClick={() => setStatusFilter(null)}
            className={`rounded-2xl border p-5 text-left transition ${
              statusFilter === null
                ? "border-[#2B2B30] bg-[#17171A]"
                : "border-[#2B2B30] bg-[#111113] hover:bg-[#17171A]"
            }`}
          >
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
              {loading
                ? "—"
                : counts.total}
            </div>

            <div className="mt-1 text-xs text-zinc-600">
              {statusFilter
                ? "clear filter"
                : "vehicles"}
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(
                statusFilter === "available"
                  ? null
                  : "available"
              )
            }
            className={`rounded-2xl border p-5 text-left transition ${
              statusFilter === "available"
                ? "border-[#C8F065]/60 bg-[#C8F065]/10"
                : "border-[#C8F065]/20 bg-[#C8F065]/[0.04] hover:bg-[#C8F065]/10"
            }`}
          >
            <span className="text-xs text-[#C8F065]">
              Disponible
            </span>

            <div className="mt-3 text-3xl font-semibold text-white">
              {loading
                ? "—"
                : counts.available}
            </div>

            <div className="mt-1 text-xs text-[#C8F065]/50">
              ready to rent
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(
                statusFilter === "reserved"
                  ? null
                  : "reserved"
              )
            }
            className={`rounded-2xl border p-5 text-left transition ${
              statusFilter === "reserved"
                ? "border-amber-400/60 bg-amber-400/10"
                : "border-amber-400/20 bg-amber-400/[0.04] hover:bg-amber-400/10"
            }`}
          >
            <span className="text-xs text-amber-400">
              Réservé
            </span>

            <div className="mt-3 text-3xl font-semibold text-white">
              {loading
                ? "—"
                : counts.reserved}
            </div>

            <div className="mt-1 text-xs text-amber-400/50">
              booked, not yet picked up
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(
                statusFilter === "rented"
                  ? null
                  : "rented"
              )
            }
            className={`rounded-2xl border p-5 text-left transition ${
              statusFilter === "rented"
                ? "border-[#F06AAA]/60 bg-[#F06AAA]/10"
                : "border-[#F06AAA]/20 bg-[#F06AAA]/[0.04] hover:bg-[#F06AAA]/10"
            }`}
          >
            <span className="text-xs text-[#F06AAA]">
              Loué
            </span>

            <div className="mt-3 text-3xl font-semibold text-white">
              {loading
                ? "—"
                : counts.rented}
            </div>

            <div className="mt-1 text-xs text-[#F06AAA]/50">
              currently rented
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(
                statusFilter === "cleaning"
                  ? null
                  : "cleaning"
              )
            }
            className={`rounded-2xl border p-5 text-left transition ${
              statusFilter === "cleaning"
                ? "border-blue-400/60 bg-blue-400/10"
                : "border-blue-400/20 bg-blue-400/[0.04] hover:bg-blue-400/10"
            }`}
          >
            <span className="text-xs text-blue-400">
              Nettoyage
            </span>

            <div className="mt-3 text-3xl font-semibold text-white">
              {loading
                ? "—"
                : counts.cleaning}
            </div>

            <div className="mt-1 text-xs text-blue-400/50">
              being prepared
            </div>
          </button>

          <button
            type="button"
            onClick={() =>
              setStatusFilter(
                statusFilter === "maintenance"
                  ? null
                  : "maintenance"
              )
            }
            className={`rounded-2xl border p-5 text-left transition ${
              statusFilter === "maintenance"
                ? "border-violet-400/60 bg-violet-400/10"
                : "border-violet-400/20 bg-violet-400/[0.04] hover:bg-violet-400/10"
            }`}
          >
            <span className="text-xs text-violet-400">
              Maintenance
            </span>

            <div className="mt-3 text-3xl font-semibold text-white">
              {loading
                ? "—"
                : counts.maintenance}
            </div>

            <div className="mt-1 text-xs text-violet-400/50">
              unavailable
            </div>
          </button>
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
                setSearch(
                  event.target.value
                )
              }
              placeholder="Search vehicles, plates, models, status, customers..."
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

        {/* RESULTS */}

        <section className="mt-5">
          {loading ? (
            <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] px-5 py-14 text-center text-sm text-zinc-600">
              Loading vehicles...
            </div>
          ) : filteredFleet.length ===
            0 ? (
            <div className="rounded-2xl border border-[#2B2B30] bg-[#111113] px-5 py-16 text-center">
              <Car
                size={24}
                className="mx-auto text-zinc-700"
              />

              <div className="mt-4 text-sm text-zinc-400">
                No vehicles found.
              </div>
            </div>
          ) : view ===
            "list" ? (
            /* =================================================
               LIST VIEW
            ================================================= */

            <div className="overflow-hidden rounded-2xl border border-[#2B2B30] bg-[#111113]">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[950px]">
                  <thead>
                    <tr className="border-b border-[#2B2B30] text-left">
                      <SortableHeader
                        label="Vehicle"
                        sortKey="name"
                        currentKey={
                          sortKey
                        }
                        direction={
                          sortDirection
                        }
                        onSort={
                          handleSort
                        }
                      />

                      <SortableHeader
                        label="Plate"
                        sortKey="plate"
                        currentKey={
                          sortKey
                        }
                        direction={
                          sortDirection
                        }
                        onSort={
                          handleSort
                        }
                      />

                      <SortableHeader
                        label="Model"
                        sortKey="model"
                        currentKey={
                          sortKey
                        }
                        direction={
                          sortDirection
                        }
                        onSort={
                          handleSort
                        }
                      />

                      <SortableHeader
                        label="Status"
                        sortKey="status"
                        currentKey={
                          sortKey
                        }
                        direction={
                          sortDirection
                        }
                        onSort={
                          handleSort
                        }
                      />

                      <SortableHeader
                        label="Rental"
                        sortKey="rental"
                        currentKey={
                          sortKey
                        }
                        direction={
                          sortDirection
                        }
                        onSort={
                          handleSort
                        }
                      />

                      <SortableHeader
                        label="Location"
                        sortKey="location"
                        currentKey={
                          sortKey
                        }
                        direction={
                          sortDirection
                        }
                        onSort={
                          handleSort
                        }
                      />

                      <SortableHeader
                        label="ID"
                        sortKey="name"
                        currentKey={
                          sortKey
                        }
                        direction={
                          sortDirection
                        }
                        onSort={
                          handleSort
                        }
                        align="right"
                      />
                    </tr>
                  </thead>

                  <tbody>
                    {filteredFleet.map(
                      ({
                        car,
                        rental,
                      }) => (
                        <tr
                          key={car.id}
                          onClick={() =>
                            setSelectedCar(
                              car
                            )
                          }
                          className="cursor-pointer border-b border-[#2B2B30] transition last:border-0 hover:bg-[#17171A]"
                        >
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#2B2B30] bg-[#17171A]">
                                <Car
                                  size={15}
                                  className="text-zinc-400"
                                />
                              </div>

                              <div>
                                <div className="font-medium text-white">
                                  {car.model ||
                                    car.name}
                                </div>

                                <div className="mt-0.5 text-xs text-zinc-600">
                                  {car.name}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-5 py-4 font-mono text-xs text-zinc-400">
                            {car.license_plate ||
                              "—"}
                          </td>

                          <td className="px-5 py-4 text-sm text-zinc-400">
                            {car.model ||
                              "—"}
                          </td>

                          <td className="px-5 py-4">
                            <StatusBadge
                              car={car}
                              compact
                            />
                          </td>

                          <td className="px-5 py-4">
                            {rental &&
                            getFleetStatus(
                              car.status,
                              car.active
                            ) ===
                              "rented" ? (
                              <div>
                                <div className="text-xs font-medium text-white">
                                  {rental
                                    .customer
                                    ?.name ||
                                    "Customer"}
                                </div>

                                <div className="mt-1 flex items-center gap-1.5 text-[10px] text-zinc-600">
                                  <span>
                                    {formatDate(
                                      rental.date_order
                                    )}
                                  </span>

                                  <span>
                                    →
                                  </span>

                                  <span>
                                    {formatDate(
                                      rental.commitment_date
                                    )}
                                  </span>
                                </div>
                              </div>
                            ) : getFleetStatus(
                                car.status,
                                car.active
                              ) ===
                              "cleaning" ? (
                              <span className="text-xs text-blue-400">
                                En nettoyage
                              </span>
                            ) : getFleetStatus(
                                car.status,
                                car.active
                              ) ===
                              "maintenance" ? (
                              <span className="text-xs text-violet-400">
                                Maintenance
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-700">
                                —
                              </span>
                            )}
                          </td>

                          <td className="px-5 py-4 text-xs text-zinc-500">
                            {car.location ||
                              "—"}
                          </td>

                          <td className="px-5 py-4 text-right font-mono text-xs text-zinc-600">
                            #{car.id}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* =================================================
               CARD VIEW
            ================================================= */

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredFleet.map(
                ({
                  car,
                  rental,
                }) => (
                  <VehicleCard
                    key={car.id}
                    car={car}
                    rental={rental}
                    onClick={() =>
                      setSelectedCar(
                        car
                      )
                    }
                    onAction={handleVehicleAction}
                  />
                )
              )}
            </div>
          )}
        </section>
      </main>

      {/* MODAL */}

      {selectedDetails && (
        <VehicleModal
          car={
            selectedDetails.car
          }
          rental={
            selectedDetails.rental
          }
          onClose={() =>
            setSelectedCar(null)
          }
          onAction={handleVehicleAction}
        />
      )}
    </>
  );
}
