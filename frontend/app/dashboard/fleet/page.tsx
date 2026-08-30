"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
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

type SortDirection =
  | "asc"
  | "desc";

// ============================================================
// CONFIG
// ============================================================

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

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
// ============================================================

type FleetStatus =
  | "available"
  | "rented"
  | "cleaning"
  | "maintenance"
  | "unavailable"
  | "inactive"
  | "unknown";

function getFleetStatus(
  status: string | null,
  active?: boolean
): FleetStatus {
  const value = normalize(status);

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

  if (
    value.includes("indispon") ||
    value.includes("unavailable")
  ) {
    return "unavailable";
  }

  return "unknown";
}

// ============================================================
// STATUS META
// ============================================================

function getStatusMeta(
  fleetStatus: FleetStatus,
  originalStatus: string | null
) {
  switch (fleetStatus) {
    case "available":
      return {
        label: "Disponible",
        className:
          "border-[#C8F065]/20 bg-[#C8F065]/10 text-[#C8F065]",
        dot: "bg-[#C8F065]",
        icon: CheckCircle2,
      };

    case "rented":
      return {
        label: "Loué",
        className:
          "border-[#F06AAA]/20 bg-[#F06AAA]/10 text-[#F06AAA]",
        dot: "bg-[#F06AAA]",
        icon: UserRound,
      };

    case "cleaning":
      return {
        label: "Nettoyage",
        className:
          "border-blue-400/20 bg-blue-500/10 text-blue-400",
        dot: "bg-blue-400",
        icon: Car,
      };

    case "maintenance":
      return {
        label: "Maintenance",
        className:
          "border-violet-400/20 bg-violet-500/10 text-violet-400",
        dot: "bg-violet-400",
        icon: Wrench,
      };

    case "unavailable":
      return {
        label: "Indisponible",
        className:
          "border-red-400/20 bg-red-500/10 text-red-400",
        dot: "bg-red-400",
        icon: Clock3,
      };

    case "inactive":
      return {
        label: "Inactive",
        className:
          "border-zinc-600/30 bg-zinc-700/20 text-zinc-500",
        dot: "bg-zinc-600",
        icon: Clock3,
      };

    default:
      return {
        label:
          originalStatus ||
          "Non défini",
        className:
          "border-[#2B2B30] bg-[#17171A] text-[#A1A1AA]",
        dot: "bg-[#71717A]",
        icon: Car,
      };
  }
}

// ============================================================
// DATES
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

function formatDate(
  value: string | null
) {
  const date = parseDate(value);

  if (!date) return "—";

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
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
        sale.state !== "cancel"
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
}: {
  car: CarData;
  rental: Sale | null;
  onClick: () => void;
}) {
  const fleetStatus =
    getFleetStatus(
      car.status,
      car.active
    );

  return (
    <button
      type="button"
      onClick={onClick}
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
      </div>
    </button>
  );
}

// ============================================================
// VEHICLE MODAL
// ============================================================

function VehicleModal({
  car,
  rental,
  onClose,
}: {
  car: CarData;
  rental: Sale | null;
  onClose: () => void;
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
                Fleet #
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
                    Odoo state:{" "}
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
                  "Odoo Fleet ID",
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
      </div>
    </div>
  );
}

// ============================================================
// SORT ICON
// ============================================================

function SortIcon({
  active,
  direction,
}: {
  active: boolean;
  direction: SortDirection;
}) {
  if (!active) {
    return (
      <span className="text-zinc-700">
        ↕
      </span>
    );
  }

  return direction ===
    "asc" ? (
    <ChevronUp
      size={12}
      className="text-[#C8F065]"
    />
  ) : (
    <ChevronDown
      size={12}
      className="text-[#C8F065]"
    />
  );
}

// ============================================================
// SORTABLE HEADER
// ============================================================

function SortableHeader({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDirection;
  onSort: (key: SortKey) => void;
  align?: "left" | "right";
}) {
  const active =
    currentKey === sortKey;

  return (
    <th
      className={`px-5 py-4 font-medium ${
        align === "right"
          ? "text-right"
          : "text-left"
      }`}
    >
      <button
        type="button"
        onClick={() =>
          onSort(sortKey)
        }
        className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] transition ${
          active
            ? "text-[#C8F065]"
            : "text-zinc-600 hover:text-zinc-300"
        }`}
      >
        {label}

        <SortIcon
          active={active}
          direction={direction}
        />
      </button>
    </th>
  );
}

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

  useEffect(() => {
    async function loadFleet() {
      try {
        setLoading(true);
        setError(null);

        const [
          carsResponse,
          salesResponse,
        ] = await Promise.all([
          fetch(`${API_URL}/cars`, {
            cache: "no-store",
          }),
          fetch(`${API_URL}/sales`, {
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

    void loadFleet();
  }, []);

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

      if (!query) {
        return fleet;
      }

      return fleet.filter(
        ({ car, rental }) => {
          const status =
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
            status,
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
    }, [fleet, search]);

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

      rented:
        fleet.filter(
          (item) =>
            item.status ===
            "rented"
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

        <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
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
              {loading
                ? "—"
                : counts.total}
            </div>

            <div className="mt-1 text-xs text-zinc-600">
              vehicles
            </div>
          </div>

          <div className="rounded-2xl border border-[#C8F065]/20 bg-[#C8F065]/[0.04] p-5">
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
          </div>

          <div className="rounded-2xl border border-[#F06AAA]/20 bg-[#F06AAA]/[0.04] p-5">
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
          </div>

          <div className="rounded-2xl border border-blue-400/20 bg-blue-400/[0.04] p-5">
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
          </div>

          <div className="rounded-2xl border border-violet-400/20 bg-violet-400/[0.04] p-5">
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
              Loading fleet from Odoo...
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
        />
      )}
    </>
  );
}