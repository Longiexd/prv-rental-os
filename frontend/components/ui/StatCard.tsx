import React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusTone } from "@/lib/status";

type StatCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  tone?: StatusTone;
  loading?: boolean;
  // % change vs a prior period. null/undefined hides the
  // indicator entirely (e.g. no baseline to compare against).
  trend?: number | null;
};

const GLOW: Record<StatusTone, string> = {
  lime: "bg-lime/[0.05]",
  pink: "bg-pink/[0.05]",
  danger: "bg-danger/[0.05]",
  muted: "bg-muted/[0.05]",
};

const ICON_COLOR: Record<StatusTone, string> = {
  lime: "text-lime",
  pink: "text-pink",
  danger: "text-danger",
  muted: "text-muted",
};

// The one KPI card definition for the whole app. Previously
// dashboard, customers, and fleet each shipped their own copy
// with slightly different spacing and font sizes.
export function StatCard({
  icon,
  label,
  value,
  detail,
  tone = "lime",
  loading = false,
  trend,
}: StatCardProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-surface/80 p-5">
      <div
        className={cn(
          "absolute -right-10 -top-10 h-24 w-24 rounded-full blur-3xl",
          GLOW[tone]
        )}
      />

      <div className="relative">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-[11px] text-muted">
            <span className={ICON_COLOR[tone]}>{icon}</span>
            {label}
          </div>

          {!loading && trend !== undefined && trend !== null && (
            <div
              className={cn(
                "flex items-center gap-0.5 text-[10px] font-medium",
                trend >= 0 ? "text-lime" : "text-danger"
              )}
            >
              {trend >= 0 ? (
                <ArrowUp size={10} />
              ) : (
                <ArrowDown size={10} />
              )}
              {Math.abs(trend)}%
            </div>
          )}
        </div>

        <div className="mt-5 flex items-baseline gap-2">
          <span className="font-syne text-[26px] font-semibold text-text">
            {loading ? "—" : value}
          </span>

          {detail && (
            <span className="text-[10px] text-muted">{detail}</span>
          )}
        </div>
      </div>
    </div>
  );
}
