"use client";

import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  Car,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  Search,
  Settings,
  Users,
  Zap,
} from "lucide-react";
import React, { useState } from "react";

import AddCustomerModal from "@/components/customers/AddCustomerModal";
import CreateRentalModal from "@/components/rentals/CreateRentalModal";
import { QuickAddMenu } from "@/components/ui/QuickAddMenu";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

type NavItem = {
  label: string;
  icon: React.ElementType;
  href: string;
  comingSoon?: boolean;
};

const navigation: NavItem[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    label: "Fleet",
    icon: Car,
    href: "/dashboard/fleet",
  },
  {
    label: "Rentals",
    icon: ClipboardList,
    href: "/dashboard/rentals",
  },
  {
    label: "Customers",
    icon: Users,
    href: "/dashboard/customers",
  },
  {
    label: "Prospects",
    icon: Users,
    href: "/crm/leads",
  },
  {
    label: "Calendar",
    icon: CalendarDays,
    href: "/dashboard/calendar",
  },
  {
    label: "Analytics",
    icon: BarChart3,
    href: "/dashboard/analytics",
  },
];

export default function OSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [addRentalOpen, setAddRentalOpen] =
    useState(false);

  const [addCustomerOpen, setAddCustomerOpen] =
    useState(false);

  return (
    <div className="min-h-screen bg-background text-text">
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-lime/[0.035] blur-[140px]" />
        <div className="absolute right-[-180px] top-[15%] h-[500px] w-[500px] rounded-full bg-pink/[0.025] blur-[150px]" />
      </div>

      <div className="relative flex min-h-screen">
        <aside className="hidden w-[230px] shrink-0 border-r border-border bg-background/90 lg:flex lg:flex-col">
          <div className="flex h-[68px] items-center border-b border-border px-5">
            <Link
              href="/dashboard"
              className="font-syne text-[19px] font-semibold tracking-[-0.04em]"
            >
              Klyn<span className="text-lime">x</span>
              <span className="text-pink">
                {" "}
                OS
              </span>
            </Link>
          </div>

          <div className="px-3 py-5">
            <div className="mb-3 px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
              Workspace
            </div>

            <nav className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;

                if (item.comingSoon) {
                  return (
                    <div
                      key={item.label}
                      title="Coming soon"
                      className="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-muted/60"
                    >
                      <Icon
                        size={16}
                        strokeWidth={1.7}
                      />

                      <span>
                        {item.label}
                      </span>

                      <span className="ml-auto rounded-md bg-surface-secondary px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-muted">
                        Soon
                      </span>
                    </div>
                  );
                }

                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-text-secondary transition hover:bg-surface hover:text-text"
                  >
                    <Icon
                      size={16}
                      strokeWidth={1.7}
                    />

                    <span>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="px-3">
            <div className="mb-3 px-2 text-[10px] font-medium uppercase tracking-[0.16em] text-muted">
              Intelligence
            </div>

            <button
              type="button"
              title="Coming soon"
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg border border-pink-dark/50 bg-pink-dark/10 px-3 py-2.5 text-[13px] text-pink transition hover:bg-pink-dark/20"
            >
              <Zap size={16} />

              <span>Klynx AI</span>

              <span className="ml-auto rounded-md bg-pink/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-pink">
                Soon
              </span>
            </button>
          </div>

          <div className="mt-auto border-t border-border p-3">
            <button
              type="button"
              title="Coming soon"
              className="flex w-full cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-muted"
            >
              <Settings size={16} />
              Settings
            </button>

            <a
              href="mailto:sara.klynx@gmail.com"
              className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-muted transition hover:bg-surface hover:text-text"
            >
              <CircleHelp size={16} />
              Help & Support
            </a>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="flex h-[68px] items-center justify-between gap-3 border-b border-border px-5 sm:px-8">
            <div
              title="Search — coming soon"
              className="flex h-9 w-full max-w-[340px] cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-surface/70 px-3 text-muted"
            >
              <Search size={15} />

              <span className="text-xs">
                Search anything...
              </span>
            </div>

            <div className="ml-4 flex items-center gap-2">
              <QuickAddMenu
                actions={[
                  {
                    label: "New booking",
                    description:
                      "Log an inquiry or confirm a rental",
                    icon: <Car size={15} />,
                    onClick: () =>
                      setAddRentalOpen(true),
                  },
                  {
                    label: "New customer",
                    description:
                      "Create a customer record",
                    icon: <Users size={15} />,
                    onClick: () =>
                      setAddCustomerOpen(true),
                  },
                ]}
              />

              <div className="ml-1 hidden h-7 w-px bg-border sm:block" />

              <button className="ml-1 flex items-center gap-2 rounded-lg px-2 py-1.5 transition hover:bg-surface">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-lime to-lime-dark text-[10px] font-semibold text-background">
                  KL
                </div>

                <div className="hidden text-left sm:block">
                  <div className="text-xs font-medium">
                    Klynx Admin
                  </div>

                  <div className="text-[10px] text-muted">
                    Administrator
                  </div>
                </div>

                <ChevronDown
                  size={13}
                  className="hidden text-muted sm:block"
                />
              </button>
            </div>
          </header>

          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>

      <CreateRentalModal
        open={addRentalOpen}
        onClose={() => setAddRentalOpen(false)}
        onCreated={() => window.location.reload()}
      />

      {addCustomerOpen && (
        <AddCustomerModal
          apiUrl={API_URL}
          onClose={() =>
            setAddCustomerOpen(false)
          }
          onSuccess={() =>
            window.location.reload()
          }
        />
      )}
    </div>
  );
}