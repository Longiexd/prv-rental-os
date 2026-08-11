"use client";

import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Car,
  ClipboardList,
  MoreHorizontal,
  TrendingUp,
  Users,
} from "lucide-react";
import React from "react";

const rentals = [
  {
    customer: "Mohamed Ben Ali",
    vehicle: "Kia Picanto",
    pickup: "10:30",
    returnDate: "Aug 14",
    status: "Active",
  },
  {
    customer: "Sarah Martin",
    vehicle: "Peugeot 3008",
    pickup: "12:00",
    returnDate: "Aug 16",
    status: "Active",
  },
  {
    customer: "Youssef Trabelsi",
    vehicle: "Renault Clio",
    pickup: "14:30",
    returnDate: "Aug 12",
    status: "Returning",
  },
  {
    customer: "Amine Khelifi",
    vehicle: "BMW 220i",
    pickup: "16:00",
    returnDate: "Aug 18",
    status: "Upcoming",
  },
];

const activity = [
  {
    time: "09:30",
    vehicle: "Kia Picanto",
    type: "Pickup",
    accent: "green",
  },
  {
    time: "10:15",
    vehicle: "Peugeot 3008",
    type: "Pickup",
    accent: "green",
  },
  {
    time: "11:00",
    vehicle: "BMW 220i",
    type: "Return",
    accent: "pink",
  },
  {
    time: "14:30",
    vehicle: "Renault Clio",
    type: "Pickup",
    accent: "green",
  },
];

export default function DashboardPage() {
  return (
    <main className="mx-auto max-w-[1500px] p-5 sm:p-8">

      {/* HEADER */}
      <section className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">

        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] text-[#71717A]">
            <span>Workspace</span>
            <span>/</span>
            <span className="text-[#A1A1AA]">
              Overview
            </span>
          </div>

          <h1 className="font-[Syne] text-[26px] font-semibold tracking-[-0.035em] sm:text-[30px]">
            Good afternoon.
          </h1>

          <p className="mt-1 text-sm text-[#71717A]">
            Here&apos;s what&apos;s happening with your rental operation.
          </p>
        </div>

        <button className="flex h-9 items-center justify-center gap-2 rounded-lg bg-[#C8F065] px-4 text-xs font-medium text-[#09090B] shadow-[0_0_24px_rgba(200,240,101,.08)] transition hover:bg-[#d7ff80]">
          <ClipboardList size={14} />
          New rental
        </button>

      </section>

      {/* KPI CARDS */}
      <section className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">

        <StatCard
          label="Fleet"
          value="248"
          detail="vehicles"
          change="+8.2%"
          icon={<Car size={15} />}
          accent="green"
        />

        <StatCard
          label="Active rentals"
          value="42"
          detail="currently rented"
          change="+12.4%"
          icon={<ClipboardList size={15} />}
          accent="green"
        />

        <StatCard
          label="Available"
          value="18"
          detail="ready to rent"
          change="+7.3%"
          icon={<Activity size={15} />}
          accent="pink"
        />

        <StatCard
          label="Revenue"
          value="48.2K"
          detail="TND this month"
          change="+18.7%"
          icon={<TrendingUp size={15} />}
          accent="green"
        />

      </section>

      {/* MAIN GRID */}
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.5fr_1fr]">

        {/* UTILIZATION */}
        <div className="overflow-hidden rounded-xl border border-[#2B2B30] bg-[#111113]/80">

          <div className="flex items-center justify-between border-b border-[#2B2B30] px-5 py-4">

            <div>
              <h2 className="font-[Syne] text-sm font-semibold">
                Fleet utilization
              </h2>

              <p className="mt-1 text-[11px] text-[#71717A]">
                Vehicle usage over the last 30 days
              </p>
            </div>

            <button className="rounded-md border border-[#2B2B30] bg-[#17171A] px-2.5 py-1.5 text-[10px] text-[#A1A1AA] transition hover:text-white">
              Last 30 days
            </button>

          </div>

          <div className="p-5">

            <div className="flex items-end justify-between">

              <div>
                <div className="font-[Syne] text-3xl font-semibold">
                  82.4%
                </div>

                <div className="mt-1 text-[11px] text-[#71717A]">
                  average utilization
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[11px] text-[#C8F065]">
                <Activity size={13} />
                +6.4%
              </div>

            </div>

            {/* CHART */}
            <div className="relative mt-7 h-[180px]">

              <div className="absolute inset-0 flex flex-col justify-between">
                {[0, 1, 2, 3].map((line) => (
                  <div
                    key={line}
                    className="border-t border-[#2B2B30]/60"
                  />
                ))}
              </div>

              <svg
                viewBox="0 0 800 180"
                className="absolute inset-0 h-full w-full overflow-visible"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient
                    id="utilizationGradient"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor="#C8F065"
                      stopOpacity="0.22"
                    />

                    <stop
                      offset="100%"
                      stopColor="#C8F065"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>

                <path
                  d="M0 138 C55 130 75 145 125 119 C175 93 185 110 235 96 C285 82 315 105 350 82 C390 56 415 75 455 61 C495 48 520 69 555 53 C595 35 625 57 665 39 C710 19 750 31 800 18 L800 180 L0 180 Z"
                  fill="url(#utilizationGradient)"
                />

                <path
                  d="M0 138 C55 130 75 145 125 119 C175 93 185 110 235 96 C285 82 315 105 350 82 C390 56 415 75 455 61 C495 48 520 69 555 53 C595 35 625 57 665 39 C710 19 750 31 800 18"
                  fill="none"
                  stroke="#C8F065"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>

              <div className="absolute bottom-[-22px] left-0 right-0 flex justify-between text-[9px] text-[#71717A]">
                <span>Jul 13</span>
                <span>Jul 20</span>
                <span>Jul 27</span>
                <span>Aug 03</span>
                <span>Aug 11</span>
              </div>

            </div>
          </div>
        </div>

        {/* ACTIVITY */}
        <div className="rounded-xl border border-[#2B2B30] bg-[#111113]/80">

          <div className="border-b border-[#2B2B30] px-5 py-4">

            <h2 className="font-[Syne] text-sm font-semibold">
              Today&apos;s activity
            </h2>

            <p className="mt-1 text-[11px] text-[#71717A]">
              Upcoming pickups and returns
            </p>

          </div>

          <div className="divide-y divide-[#2B2B30]">

            {activity.map((item) => (
              <div
                key={`${item.time}-${item.vehicle}`}
                className="flex items-center gap-3 px-5 py-3.5"
              >

                <div className="w-11 font-mono text-[10px] text-[#71717A]">
                  {item.time}
                </div>

                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    item.accent === "pink"
                      ? "bg-[#F06AAA] shadow-[0_0_7px_rgba(240,106,170,.6)]"
                      : "bg-[#C8F065] shadow-[0_0_7px_rgba(200,240,101,.6)]"
                  }`}
                />

                <div className="min-w-0 flex-1">

                  <div className="truncate text-xs font-medium">
                    {item.vehicle}
                  </div>

                  <div className="mt-0.5 text-[10px] text-[#71717A]">
                    {item.type}
                  </div>

                </div>

                <CalendarDays
                  size={13}
                  className="text-[#71717A]"
                />

              </div>
            ))}

          </div>
        </div>

      </section>

      {/* RECENT RENTALS */}
      <section className="mt-4 overflow-hidden rounded-xl border border-[#2B2B30] bg-[#111113]/80">

        <div className="flex items-center justify-between border-b border-[#2B2B30] px-5 py-4">

          <div>
            <h2 className="font-[Syne] text-sm font-semibold">
              Recent rentals
            </h2>

            <p className="mt-1 text-[11px] text-[#71717A]">
              Latest rental activity
            </p>
          </div>

          <button className="text-[11px] text-[#A1A1AA] transition hover:text-[#C8F065]">
            View all →
          </button>

        </div>

        <div className="overflow-x-auto">

          <table className="w-full min-w-[700px] text-left">

            <thead>
              <tr className="border-b border-[#2B2B30] text-[10px] uppercase tracking-wider text-[#71717A]">

                <th className="px-5 py-3 font-medium">
                  Customer
                </th>

                <th className="px-5 py-3 font-medium">
                  Vehicle
                </th>

                <th className="px-5 py-3 font-medium">
                  Pickup
                </th>

                <th className="px-5 py-3 font-medium">
                  Return
                </th>

                <th className="px-5 py-3 font-medium">
                  Status
                </th>

                <th className="px-5 py-3" />

              </tr>
            </thead>

            <tbody className="divide-y divide-[#2B2B30]">

              {rentals.map((rental) => (
                <tr
                  key={`${rental.customer}-${rental.vehicle}`}
                  className="text-xs transition hover:bg-[#17171A]/50"
                >

                  <td className="px-5 py-3.5 font-medium">
                    {rental.customer}
                  </td>

                  <td className="px-5 py-3.5 text-[#A1A1AA]">
                    {rental.vehicle}
                  </td>

                  <td className="px-5 py-3.5 text-[#A1A1AA]">
                    {rental.pickup}
                  </td>

                  <td className="px-5 py-3.5 text-[#A1A1AA]">
                    {rental.returnDate}
                  </td>

                  <td className="px-5 py-3.5">
                    <StatusBadge status={rental.status} />
                  </td>

                  <td className="px-5 py-3.5 text-right">
                    <button className="text-[#71717A] hover:text-white">
                      <MoreHorizontal size={15} />
                    </button>
                  </td>

                </tr>
              ))}

            </tbody>
          </table>

        </div>
      </section>

      {/* QUICK MODULES */}
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

        <QuickModule
          icon={<Car size={17} />}
          title="Fleet"
          description="Manage vehicles, availability and maintenance."
          href="/dashboard/fleet"
        />

        <QuickModule
          icon={<Users size={17} />}
          title="Customers"
          description="Customers, documents and rental history."
          href="/dashboard/customers"
        />

        <QuickModule
          icon={<CalendarDays size={17} />}
          title="Calendar"
          description="See pickups, returns and upcoming reservations."
          href="/dashboard/calendar"
        />

      </section>

    </main>
  );
}

function StatCard({
  label,
  value,
  detail,
  change,
  icon,
  accent,
}: {
  label: string;
  value: string;
  detail: string;
  change: string;
  icon: React.ReactNode;
  accent: "green" | "pink";
}) {
  const isPink = accent === "pink";

  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#2B2B30] bg-[#111113]/80 p-5 transition hover:border-[#3b3b42]">

      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full blur-3xl ${
          isPink
            ? "bg-[#F06AAA]/[0.05]"
            : "bg-[#C8F065]/[0.05]"
        }`}
      />

      <div className="relative">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-2 text-[11px] text-[#71717A]">

            <span
              className={
                isPink
                  ? "text-[#F06AAA]"
                  : "text-[#C8F065]"
              }
            >
              {icon}
            </span>

            {label}
          </div>

          <span
            className={
              isPink
                ? "text-[10px] text-[#F06AAA]"
                : "text-[10px] text-[#C8F065]"
            }
          >
            {change}
          </span>

        </div>

        <div className="mt-5 flex items-baseline gap-2">

          <span className="font-[Syne] text-[26px] font-semibold tracking-[-0.03em]">
            {value}
          </span>

          <span className="text-[10px] text-[#71717A]">
            {detail}
          </span>

        </div>

      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    Active: "bg-[#C8F065]/10 text-[#C8F065]",
    Returning: "bg-[#F06AAA]/10 text-[#F06AAA]",
    Upcoming: "bg-[#17171A] text-[#A1A1AA]",
  };

  return (
    <span
      className={`inline-flex rounded-md px-2 py-1 text-[9px] ${
        styles[status as keyof typeof styles]
      }`}
    >
      {status}
    </span>
  );
}

function QuickModule({
  icon,
  title,
  description,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <a
      href={href}
      className="group rounded-xl border border-[#2B2B30] bg-[#111113]/60 p-4 transition hover:border-[#C8F065]/20 hover:bg-[#17171A]"
    >
      <div className="flex items-start justify-between">

        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#C8F065]/10 text-[#C8F065]">
          {icon}
        </div>

        <ArrowUpRight
          size={15}
          className="text-[#71717A] transition group-hover:text-[#C8F065]"
        />

      </div>

      <h3 className="mt-4 font-[Syne] text-sm font-semibold">
        {title}
      </h3>

      <p className="mt-1 text-[11px] leading-relaxed text-[#71717A]">
        {description}
      </p>
    </a>
  );
}