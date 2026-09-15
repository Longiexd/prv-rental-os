"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarDays, Car, CircleHelp, ClipboardList, LayoutDashboard, Search, Users, Zap } from "lucide-react";
import React, { useState } from "react";
import AddCustomerModal from "@/components/customers/AddCustomerModal";
import CreateRentalModal from "@/components/rentals/CreateRentalModal";
import { QuickAddMenu } from "@/components/ui/QuickAddMenu";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.rental-os.klynx.net";
const navigation = [
  { label: "Overview", icon: LayoutDashboard, href: "/dashboard", group: "Workspace" },
  { label: "Fleet", icon: Car, href: "/dashboard/fleet", group: "Workspace" },
  { label: "Rentals", icon: ClipboardList, href: "/dashboard/rentals", group: "Workspace" },
  { label: "Calendar", icon: CalendarDays, href: "/dashboard/calendar", group: "Workspace" },
  { label: "Customers", icon: Users, href: "/dashboard/customers", group: "Workspace" },
  { label: "CRM", icon: Users, href: "/crm/leads", group: "Business" },
  { label: "To do", icon: ClipboardList, href: "/dashboard/activities", group: "Business" },
  { label: "Analytics", icon: BarChart3, href: "/dashboard/analytics", group: "Business" },
];

export default function OSLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [addRentalOpen, setAddRentalOpen] = useState(false);
  const [addCustomerOpen, setAddCustomerOpen] = useState(false);
  const isActive = (href: string) => href === "/dashboard" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`) || (href === "/crm/leads" && pathname.startsWith("/dashboard/crm/leads"));

  return (
    <div className="os-stage text-text">
      <div className="os-shell">
        <aside className="hidden w-[208px] shrink-0 flex-col border-r border-border bg-background/80 lg:flex">
          <Link href="/dashboard" className="flex h-[70px] items-center gap-3 border-b border-border px-5" aria-label="Klynx overview">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-lime font-semibold text-background">K</span>
            <span className="text-base font-semibold tracking-tight">Klynx<span className="ml-1 text-xs font-normal text-muted">OS</span></span>
          </Link>
          <nav aria-label="Main navigation" className="space-y-8 px-3 py-7">
            {["Workspace", "Business"].map(group => <div key={group}>
              <p className="mb-3 px-3 text-[10px] uppercase tracking-[0.18em] text-muted">{group}</p>
              <div className="space-y-1">{navigation.filter(item => item.group === group).map(({ label, icon: Icon, href }) => <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={`flex min-h-11 items-center gap-3 rounded-lg px-3 text-[13px] transition-colors ${isActive(href) ? "bg-lime/10 font-medium text-lime" : "text-text-secondary hover:bg-white/[0.03] hover:text-text"}`}><Icon size={16} strokeWidth={1.6} />{label}</Link>)}</div>
            </div>)}
          </nav>
          <div className="mt-auto space-y-2 p-4">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2 text-xs text-muted"><Zap size={15} className="text-pink" />Klynx AI<span className="ml-auto text-[10px] text-pink">Soon</span></div>
            <a href="mailto:sara.klynx@gmail.com" className="flex items-center gap-3 rounded-lg px-2 py-2 text-xs text-muted hover:text-text"><CircleHelp size={15} />Help & support</a>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="flex h-[70px] items-center justify-between gap-3 border-b border-border bg-background/70 px-4 sm:px-7">
            <Link href="/dashboard" aria-label="Klynx overview" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime text-sm font-semibold text-background lg:hidden">K</Link>
            <div title="Search — coming soon" className="hidden h-10 w-full max-w-[390px] items-center gap-2 rounded-lg border border-border bg-surface/80 px-3 text-muted sm:flex"><Search size={15} /><span className="text-xs">Search fleet, reservations…</span><span className="ml-auto text-[10px]">Soon</span></div>
            <div className="ml-auto flex items-center gap-4">
              <QuickAddMenu actions={[
                { label: "New booking", description: "Save a prospect or prepare a quotation", icon: <Car size={15} />, onClick: () => setAddRentalOpen(true) },
                { label: "New customer", description: "Create a customer record", icon: <Users size={15} />, onClick: () => setAddCustomerOpen(true) },
              ]} />
              <span aria-hidden="true" className="hidden h-1.5 w-1.5 rounded-full bg-pink shadow-glow-pink sm:block" />
              <div title="Klynx Admin" aria-label="Klynx Admin" className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-secondary text-xs font-medium">KL</div>
            </div>
          </header>
          <nav aria-label="Mobile navigation" className="flex gap-1 overflow-x-auto border-b border-border p-2 lg:hidden">{navigation.map(({ href, label }) => <Link key={href} href={href} aria-current={isActive(href) ? "page" : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-sm ${isActive(href) ? "bg-lime/10 text-lime" : "text-text-secondary"}`}>{label}</Link>)}</nav>
          <div className="os-content">{children}</div>
        </div>
      </div>
      <CreateRentalModal open={addRentalOpen} onClose={() => setAddRentalOpen(false)} onCreated={() => window.location.reload()} />
      {addCustomerOpen && <AddCustomerModal apiUrl={API_URL} onClose={() => setAddCustomerOpen(false)} onSuccess={() => window.location.reload()} />}
    </div>
  );
}
