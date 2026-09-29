"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  BarChart3,
  CalendarDays,
  Car,
  CircleHelp,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Search,
  Users,
  Zap,
} from "lucide-react";
import React, { useState } from "react";

import AddCustomerModal from "@/components/customers/AddCustomerModal";
import CreateRentalModal from "@/components/rentals/CreateRentalModal";
import { QuickAddMenu } from "@/components/ui/QuickAddMenu";
import { useReminders } from "@/components/activities/api";
import KlynxLogo from "@/components/klynxlogo";
import { API_URL } from "@/lib/api-config";

const navigation = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    href: "/dashboard",
    group: "Workspace",
  },
  {
    label: "Vehicles",
    icon: Car,
    href: "/dashboard/fleet",
    group: "Workspace",
  },
  {
    label: "Rentals",
    icon: ClipboardList,
    href: "/dashboard/rentals",
    group: "Workspace",
  },
  {
    label: "Calendar",
    icon: CalendarDays,
    href: "/dashboard/calendar",
    group: "Workspace",
  },
  {
    label: "Customers",
    icon: Users,
    href: "/dashboard/customers",
    group: "Workspace",
  },
  {
    label: "Prospects",
    icon: Users,
    href: "/crm/leads",
    group: "Business",
  },
  {
    label: "To do",
    icon: ClipboardList,
    href: "/dashboard/activities",
    group: "Business",
  },
  {
    label: "Analytics",
    icon: BarChart3,
    href: "/dashboard/analytics",
    group: "Business",
  },
];

export default function OSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const [addRentalOpen, setAddRentalOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const { due } = useReminders();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth", { method: "DELETE" });
      if (!response.ok) throw new Error("Sign out failed");
      window.location.assign("/login");
    } catch {
      window.alert("Could not finish signing out. Please retry.");
    }
  };

  const isActive = (href: string) =>
    href === "/dashboard"
      ? pathname === href
      : pathname === href ||
        pathname.startsWith(`${href}/`) ||
        (href === "/crm/leads" &&
          pathname.startsWith("/dashboard/crm/leads"));

  return (
    <div className="os-stage text-text">
      <div className="os-shell">

        {/* =====================================================
            DESKTOP SIDEBAR
        ===================================================== */}
        <aside className="hidden w-[208px] shrink-0 flex-col border-r border-border bg-background/80 lg:flex">

          {/* Klynx logo */}
          <Link
            href="/dashboard"
            className="flex h-[70px] items-center border-b border-border px-5"
            aria-label="Klynx overview"
          >
            <KlynxLogo variant="wordmark" size="md" />
          </Link>

          {/* Navigation */}
          <nav
            aria-label="Main navigation"
            className="space-y-8 px-3 py-7"
          >
            {["Workspace", "Business"].map((group) => (
              <div key={group}>
                <p className="mb-3 px-3 text-[10px] uppercase tracking-[0.18em] text-muted">
                  {group}
                </p>

                <div className="space-y-1">
                  {navigation
                    .filter((item) => item.group === group)
                    .map(({ label, icon: Icon, href }) => (
                      <Link
                        key={href}
                        href={href}
                        aria-current={isActive(href) ? "page" : undefined}
                        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] transition-colors ${
                          isActive(href)
                            ? "bg-lime/10 font-medium text-lime"
                            : "text-text-secondary hover:bg-white/[0.03] hover:text-text"
                        }`}
                      >
                        <Icon size={16} strokeWidth={1.6} />
                        {label}
                      </Link>
                    ))}
                </div>
              </div>
            ))}
          </nav>

          {/* Sidebar footer */}
          <div className="mt-auto space-y-1 p-4">

            <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-xs text-muted">
              <Zap size={15} className="text-pink" />
              Klynx AI
              <span className="ml-auto text-[10px] text-pink">
                Soon
              </span>
            </div>

            <a
              href="mailto:sara.klynx@gmail.com"
              className="flex items-center gap-3 rounded-lg px-2 py-2 text-xs text-muted transition hover:bg-white/[0.03] hover:text-text"
            >
              <CircleHelp size={15} />
              Help & support
            </a>

            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-xs text-muted transition hover:bg-white/[0.03] hover:text-text"
            >
              <LogOut size={15} />
              Log out
            </button>
          </div>
        </aside>

        {/* =====================================================
            MAIN AREA
        ===================================================== */}
        <div className="min-w-0 flex-1">

          {/* Header */}
          <header className="flex h-[70px] items-center justify-between gap-3 border-b border-border bg-background/70 px-4 sm:px-7">

            {/* Mobile Klynx logo */}
            <Link
              href="/dashboard"
              aria-label="Klynx overview"
              className="lg:hidden"
            >
              <KlynxLogo variant="wordmark" size="sm" />
            </Link>

            {/* Search */}
            <div
              title="Search — coming soon"
              className="hidden h-10 w-full max-w-[390px] items-center gap-2 rounded-lg border border-border bg-surface/80 px-3 text-muted sm:flex"
            >
              <Search size={15} />

              <span className="text-xs">
                Search vehicles, reservations…
              </span>

              <span className="ml-auto text-[10px]">
                Soon
              </span>
            </div>

            {/* Header actions */}
            <div className="ml-auto flex items-center gap-3">

              <QuickAddMenu
                actions={[
                  {
                    label: "New booking",
                    description:
                      "Save a prospect or prepare a quotation",
                    icon: <Car size={15} />,
                    onClick: () => setAddRentalOpen(true),
                  },
                  {
                    label: "New customer",
                    description:
                      "Create a customer record",
                    icon: <Users size={15} />,
                    onClick: () => setAddCustomerOpen(true),
                  },
                ]}
              />

              {/* Notifications */}
              <div className="relative">
                <button
                  type="button"
                  aria-label="Notifications"
                  onClick={() =>
                    setBellOpen((value) => !value)
                  }
                  className="relative flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary transition hover:text-text"
                >
                  <Bell size={16} />

                  {due.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-pink px-1 text-[9px] font-semibold text-background">
                      {due.length}
                    </span>
                  )}
                </button>

                {bellOpen && (
                  <div className="absolute right-0 top-11 z-30 w-72 rounded-xl border border-border bg-surface p-3 shadow-xl">

                    <p className="px-1 pb-2 text-xs font-medium uppercase tracking-wider text-muted">
                      Due today & overdue
                    </p>

                    {due.length === 0 ? (
                      <p className="px-1 py-2 text-sm text-muted">
                        Nothing due. You&apos;re all caught up.
                      </p>
                    ) : (
                      <div className="max-h-72 space-y-1 overflow-y-auto">
                        {due.slice(0, 8).map((item) => (
                          <Link
                            key={item.id}
                            href={
                              item.res_model === "sale.order"
                                ? `/dashboard/rentals/${item.res_id}?activity=${item.id}`
                                : `/crm/leads/${item.res_id}?activity=${item.id}`
                            }
                            onClick={() => setBellOpen(false)}
                            className="block rounded-lg px-2 py-2 text-sm hover:bg-surface-secondary"
                          >
                            <span
                              className={`font-medium ${
                                item.state === "overdue"
                                  ? "text-danger"
                                  : "text-text"
                              }`}
                            >
                              {item.summary || "Follow up"}
                            </span>

                            <span className="block text-xs text-muted">
                              {item.res_name} · {item.date_deadline}
                            </span>
                          </Link>
                        ))}
                      </div>
                    )}

                    <Link
                      href="/dashboard/activities"
                      onClick={() => setBellOpen(false)}
                      className="mt-2 block rounded-lg px-2 py-1.5 text-center text-xs text-lime hover:underline"
                    >
                      View all activities →
                    </Link>
                  </div>
                )}
              </div>

              {/* Admin identity - desktop */}
              <div className="hidden items-center gap-2 sm:flex">
                <span className="text-right">
                  <span className="block text-xs font-medium leading-tight text-text">
                    Klynx Admin
                  </span>

                  <span className="block text-[10px] leading-tight text-muted">
                    Administrator
                  </span>
                </span>

                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-secondary text-xs font-medium">
                  KL
                </span>
              </div>

              {/* Mobile logout */}
              <button
                type="button"
                onClick={handleLogout}
                aria-label="Log out"
                title="Log out"
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-secondary transition hover:border-pink/40 hover:text-pink lg:hidden"
              >
                <LogOut size={16} />
              </button>
            </div>
          </header>

          {/* Mobile navigation */}
          <nav
            aria-label="Mobile navigation"
            className="flex gap-1 overflow-x-auto border-b border-border p-2 lg:hidden"
          >
            {navigation.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                aria-current={isActive(href) ? "page" : undefined}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm ${
                  isActive(href)
                    ? "bg-lime/10 text-lime"
                    : "text-text-secondary"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          <div className="os-content">
            {children}
          </div>
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
          onClose={() => setAddCustomerOpen(false)}
          onSuccess={() => window.location.reload()}
        />
      )}
    </div>
  );
}
