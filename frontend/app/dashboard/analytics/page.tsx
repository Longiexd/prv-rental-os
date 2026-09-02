"use client";

import { useEffect, useMemo, useState } from "react";
import {

  BarChart3,
  CalendarDays,
  ChevronDown,
  List,
  RefreshCw,
  Table2,
  TrendingUp,
  
} from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { formatCurrency } from "@/lib/format";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  "https://api.rental-os.klynx.net";

type Analytics = {
  range: {
    start: string;
    end: string;
  };

  summary: {
    revenue: number;
    orders: number;
    average_order: number;
    invoiced: number;
    collected: number;
    outstanding: number;
  };

  monthly: {
    key: string;
    label: string;
    revenue: number;
    orders: number;
    invoiced: number;
    collected: number;
  }[];

  product_categories: {
    name: string;
    revenue: number;
    orders: number;
    share: number;
  }[];

  fleet_categories: {
    name: string;
    revenue: number;
    orders: number;
    share: number;
  }[];

  customers: {
    name: string;
    revenue: number;
    orders: number;
  }[];

  orders: {
    id: number;
    name: string;
    customer: string;
    date: string | null;
    amount: number;
    state: string;
    vehicle: string | null;
    fleet_category: string;
  }[];
};

type ViewMode =
  | "graph"
  | "pivot"
  | "orders";

type GroupMode =
  | "month"
  | "product"
  | "fleet"
  | "customer";

type Measure =
  | "revenue"
  | "orders"
  | "average";

function getYearRange(year: number) {
  return {
    start: `${year}-01-01`,
    end: `${year}-12-31`,
  };
}

function formatCompactCurrency(value: number) {
  const amount = Number(value) || 0;

  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)}M`;
  }

  if (amount >= 1_000) {
    return `${(amount / 1_000).toFixed(0)}K`;
  }

  return amount.toFixed(0);
}

function formatDate(value: string | null) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SectionEmpty({
  text,
}: {
  text: string;
}) {
  return (
    <div className="p-8 text-center text-xs text-muted">
      {text}
    </div>
  );
}

function BreakdownList({
  items,
}: {
  items: {
    name: string;
    revenue: number;
    orders: number;
    share: number;
  }[];
}) {
  if (!items.length) {
    return (
      <SectionEmpty text="No data for this period." />
    );
  }

  const max = Math.max(
    ...items.map((item) => item.revenue),
    1
  );

  return (
    <div className="divide-y divide-border">
      {items.map((item) => {
        const width =
          (item.revenue / max) * 100;

        return (
          <div
            key={item.name}
            className="px-5 py-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-text">
                  {item.name}
                </div>

                <div className="mt-1 text-[10px] text-muted">
                  {item.orders}{" "}
                  {item.orders === 1
                    ? "order"
                    : "orders"}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-text">
                  {formatCurrency(
                    item.revenue
                  )}
                </div>

                <div className="mt-1 text-[10px] text-muted">
                  {item.share}%
                </div>
              </div>
            </div>

            <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-lime"
                style={{
                  width: `${width}%`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalyticsPage() {
  const currentYear =
    new Date().getFullYear();

  const [year, setYear] =
    useState(currentYear);

  const [data, setData] =
    useState<Analytics | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [view, setView] =
    useState<ViewMode>("graph");

  const [groupBy, setGroupBy] =
    useState<GroupMode>("month");

  const [measure, setMeasure] =
    useState<Measure>("revenue");

  const [periodOpen, setPeriodOpen] =
    useState(false);

  const [groupOpen, setGroupOpen] =
    useState(false);

  async function loadAnalytics() {
    try {
      setLoading(true);
      setError("");

      const range =
        getYearRange(year);

      const response = await fetch(
        `${API_URL}/analytics?start_date=${range.start}&end_date=${range.end}`,
        {
          cache: "no-store",
        }
      );

      if (!response.ok) {
        throw new Error(
          `API returned ${response.status}`
        );
      }

      const result =
        (await response.json()) as Analytics;

      setData(result);
    } catch (err) {
      console.error(
        "Analytics loading failed:",
        err
      );

      setError(
        "Unable to load analytics."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAnalytics();
  }, [year]);

  const chartMax = useMemo(() => {
    if (!data?.monthly.length) {
      return 1;
    }

    return Math.max(
      ...data.monthly.map(
        (item) => item.revenue
      ),
      1
    );
  }, [data]);

  const pivotRows = useMemo(() => {
    if (!data) return [];

    if (groupBy === "month") {
      return data.monthly.map(
        (item) => ({
          label: item.label,
          revenue: item.revenue,
          orders: item.orders,
          average:
            item.orders > 0
              ? item.revenue /
                item.orders
              : 0,
        })
      );
    }

    if (groupBy === "product") {
      return data.product_categories.map(
        (item) => ({
          label: item.name,
          revenue: item.revenue,
          orders: item.orders,
          average:
            item.orders > 0
              ? item.revenue /
                item.orders
              : 0,
        })
      );
    }

    if (groupBy === "fleet") {
      return data.fleet_categories.map(
        (item) => ({
          label: item.name,
          revenue: item.revenue,
          orders: item.orders,
          average:
            item.orders > 0
              ? item.revenue /
                item.orders
              : 0,
        })
      );
    }

    return data.customers.map(
      (item) => ({
        label: item.name,
        revenue: item.revenue,
        orders: item.orders,
        average:
          item.orders > 0
            ? item.revenue /
              item.orders
            : 0,
      })
    );
  }, [data, groupBy]);

  const measureValue = (
    row: {
      revenue: number;
      orders: number;
      average: number;
    }
  ) => {
    if (measure === "orders") {
      return row.orders;
    }

    if (measure === "average") {
      return row.average;
    }

    return row.revenue;
  };

  const measureLabel =
    measure === "orders"
      ? "Orders"
      : measure === "average"
        ? "Average order"
        : "Revenue";

  return (
    <main className="mx-auto max-w-[1500px] p-5 sm:p-8">
      <PageHeader
        breadcrumb="Analytics"
        title="Analytics"
        subtitle="Understand revenue, rentals and fleet performance."
        action={
          <button
            type="button"
            onClick={loadAnalytics}
            className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-text transition hover:bg-surface-2"
          >
            <RefreshCw
              size={13}
              className={
                loading
                  ? "animate-spin"
                  : ""
              }
            />
            Refresh
          </button>
        }
      />

      {/* ======================================================
          ANALYSIS CONTROLS
      ====================================================== */}

      <section className="mt-7 rounded-xl border border-border bg-surface/80">
        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setYear(
                  Math.max(
                    2020,
                    year - 1
                  )
                )
              }
              className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-xs text-muted transition hover:text-text"
            >
              ←
            </button>

            <button
              type="button"
              onClick={() =>
                setYear(
                  Math.min(
                    2100,
                    year + 1
                  )
                )
              }
              className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-xs text-muted transition hover:text-text"
            >
              →
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setPeriodOpen(
                    !periodOpen
                  )
                }
                className="flex h-9 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 text-xs font-medium text-text"
              >
                <CalendarDays
                  size={13}
                />
                {year}
                <ChevronDown
                  size={12}
                />
              </button>

              {periodOpen && (
                <div className="absolute left-0 top-11 z-30 w-32 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
                  {[currentYear, currentYear - 1, currentYear - 2]
                    .filter(
                      (item) =>
                        item >= 2020
                    )
                    .map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => {
                          setYear(item);
                          setPeriodOpen(
                            false
                          );
                        }}
                        className={`block w-full px-3 py-2 text-left text-xs ${
                          item === year
                            ? "bg-lime/10 text-lime"
                            : "text-muted hover:bg-surface-2 hover:text-text"
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                </div>
              )}
            </div>

            <span className="text-[11px] text-muted">
              Jan 1 — Dec 31
            </span>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2 p-1">
            <button
              type="button"
              onClick={() =>
                setView("graph")
              }
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs ${
                view === "graph"
                  ? "bg-surface text-text shadow-sm"
                  : "text-muted"
              }`}
            >
              <BarChart3 size={13} />
              Graph
            </button>

            <button
              type="button"
              onClick={() =>
                setView("pivot")
              }
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs ${
                view === "pivot"
                  ? "bg-surface text-text shadow-sm"
                  : "text-muted"
              }`}
            >
              <Table2 size={13} />
              Pivot
            </button>

            <button
              type="button"
              onClick={() =>
                setView("orders")
              }
              className={`flex h-8 items-center gap-1.5 rounded-md px-3 text-xs ${
                view === "orders"
                  ? "bg-surface text-text shadow-sm"
                  : "text-muted"
              }`}
            >
              <List size={13} />
              Orders
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-border px-4 py-3 sm:flex-row sm:items-center">
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted">
            Measures
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              ["revenue", "Revenue"],
              ["orders", "Orders"],
              ["average", "Average order"],
            ].map(
              ([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() =>
                    setMeasure(
                      value as Measure
                    )
                  }
                  className={`rounded-md border px-3 py-1.5 text-[10px] ${
                    measure === value
                      ? "border-lime/30 bg-lime/10 text-lime"
                      : "border-border bg-surface-2 text-muted hover:text-text"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-[0.12em] text-muted">
              Group by
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setGroupOpen(
                    !groupOpen
                  )
                }
                className="flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-[10px] text-text"
              >
                {groupBy === "month"
                  ? "Month"
                  : groupBy === "product"
                    ? "Product category"
                    : groupBy === "fleet"
                      ? "Fleet category"
                      : "Customer"}
                <ChevronDown
                  size={11}
                />
              </button>

              {groupOpen && (
                <div className="absolute right-0 top-8 z-20 w-40 overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
                  {[
                    ["month", "Month"],
                    [
                      "product",
                      "Product category",
                    ],
                    [
                      "fleet",
                      "Fleet category",
                    ],
                    [
                      "customer",
                      "Customer",
                    ],
                  ].map(
                    ([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setGroupBy(
                            value as GroupMode
                          );
                          setGroupOpen(
                            false
                          );
                        }}
                        className={`block w-full px-3 py-2 text-left text-[10px] ${
                          groupBy === value
                            ? "bg-lime/10 text-lime"
                            : "text-muted hover:bg-surface-2 hover:text-text"
                        }`}
                      >
                        {label}
                      </button>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {error && (
        <div className="mt-4 rounded-lg border border-pink/20 bg-pink/5 px-4 py-3 text-xs text-pink">
          {error}
        </div>
      )}

      {/* ======================================================
          KPI STRIP
      ====================================================== */}

      <section className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={<TrendingUp size={15} />}
          label="Revenue"
          value={
            data
              ? formatCurrency(
                  data.summary.revenue
                )
              : "—"
          }
          detail={`${year}`}
          loading={loading}
        />

        <StatCard
          icon={<BarChart3 size={15} />}
          label="Orders"
          value={
            data
              ? data.summary.orders.toString()
              : "—"
          }
          detail="confirmed"
          tone="pink"
          loading={loading}
        />

        <StatCard
          icon={<TrendingUp size={15} />}
          label="Average order"
          value={
            data
              ? formatCurrency(
                  data.summary.average_order
                )
              : "—"
          }
          detail="per order"
          loading={loading}
        />

        <StatCard
          icon={<TrendingUp size={15} />}
          label="Collected"
          value={
            data
              ? formatCurrency(
                  data.summary.collected
                )
              : "—"
          }
          detail="posted invoices"
          loading={loading}
        />

        <StatCard
          icon={<TrendingUp size={15} />}
          label="Outstanding"
          value={
            data
              ? formatCurrency(
                  data.summary.outstanding
                )
              : "—"
          }
          detail="to collect"
          tone="pink"
          loading={loading}
        />
      </section>

      {/* ======================================================
          GRAPH
      ====================================================== */}

      {view === "graph" && data && (
        <>
          <section className="mt-4">
            <Card>
              <CardHeader
                title={measureLabel}
                subtitle={`Monthly performance · ${year}`}
              />

              <div className="p-5">
                <div className="flex h-[300px] items-end gap-2 sm:gap-3">
                  {data.monthly.map(
                    (month) => {
                      const height =
                        month.revenue /
                        chartMax;

                      return (
                        <div
                          key={month.key}
                          className="group flex h-full flex-1 flex-col justify-end"
                        >
                          <div className="relative flex flex-1 items-end justify-center">
                            <div
                              className="w-full max-w-[42px] rounded-t-md bg-lime/70 transition hover:bg-lime"
                              style={{
                                height: `${Math.max(
                                  height * 250,
                                  month.revenue
                                    ? 4
                                    : 0
                                )}px`,
                              }}
                              title={`${month.label}: ${formatCurrency(
                                month.revenue
                              )}`}
                            />
                          </div>

                          <div className="mt-3 text-center text-[9px] text-muted">
                            {month.label}
                          </div>
                        </div>
                      );
                    }
                  )}
                </div>

                <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                  <span className="text-[10px] text-muted">
                    Total revenue
                  </span>

                  <span className="font-syne text-sm font-semibold text-text">
                    {formatCurrency(
                      data.summary.revenue
                    )}
                  </span>
                </div>
              </div>
            </Card>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader
                title="Revenue by product category"
                subtitle="What the business sold"
              />

              <BreakdownList
                items={
                  data.product_categories
                }
              />
            </Card>

            <Card>
              <CardHeader
                title="Revenue by fleet category"
                subtitle="Which type of vehicle generated revenue"
              />

              <BreakdownList
                items={
                  data.fleet_categories
                }
              />
            </Card>
          </section>

          <section className="mt-4">
            <Card>
              <CardHeader
                title="Monthly breakdown"
                subtitle="Revenue and rental volume"
              />

              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] text-left">
                  <thead>
                    <tr className="border-b border-border text-[9px] uppercase tracking-[0.12em] text-muted">
                      <th className="px-5 py-3">
                        Month
                      </th>
                      <th className="px-5 py-3 text-right">
                        Revenue
                      </th>
                      <th className="px-5 py-3 text-right">
                        Orders
                      </th>
                      <th className="px-5 py-3 text-right">
                        Average
                      </th>
                      <th className="px-5 py-3 text-right">
                        Collected
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {data.monthly.map(
                      (month) => (
                        <tr
                          key={month.key}
                          className="hover:bg-surface-2/60"
                        >
                          <td className="px-5 py-3 text-xs font-medium text-text">
                            {month.label}
                          </td>

                          <td className="px-5 py-3 text-right text-xs text-text">
                            {formatCurrency(
                              month.revenue
                            )}
                          </td>

                          <td className="px-5 py-3 text-right text-xs text-muted">
                            {month.orders}
                          </td>

                          <td className="px-5 py-3 text-right text-xs text-muted">
                            {formatCurrency(
                              month.orders
                                ? month.revenue /
                                    month.orders
                                : 0
                            )}
                          </td>

                          <td className="px-5 py-3 text-right text-xs text-muted">
                            {formatCurrency(
                              month.collected
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </>
      )}

      {/* ======================================================
          PIVOT
      ====================================================== */}

      {view === "pivot" && data && (
        <section className="mt-4">
          <Card>
            <CardHeader
              title={`${measureLabel} by ${
                groupBy === "month"
                  ? "month"
                  : groupBy === "product"
                    ? "product category"
                    : groupBy === "fleet"
                      ? "fleet category"
                      : "customer"
              }`}
              subtitle="Analytical pivot"
            />

            <div className="overflow-x-auto">
              <table className="w-full min-w-[650px] text-left">
                <thead>
                  <tr className="border-b border-border text-[9px] uppercase tracking-[0.12em] text-muted">
                    <th className="px-5 py-3">
                      {groupBy === "month"
                        ? "Month"
                        : groupBy === "product"
                          ? "Product category"
                          : groupBy === "fleet"
                            ? "Fleet category"
                            : "Customer"}
                    </th>

                    <th className="px-5 py-3 text-right">
                      Revenue
                    </th>

                    <th className="px-5 py-3 text-right">
                      Orders
                    </th>

                    <th className="px-5 py-3 text-right">
                      Average order
                    </th>

                    <th className="px-5 py-3 text-right">
                      Share
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border">
                  {pivotRows.map(
                    (row) => {
                      const share =
                        data.summary.revenue >
                        0
                          ? (row.revenue /
                              data.summary.revenue) *
                            100
                          : 0;

                      return (
                        <tr
                          key={row.label}
                          className="hover:bg-surface-2/60"
                        >
                          <td className="px-5 py-3 text-xs font-medium text-text">
                            {row.label}
                          </td>

                          <td className="px-5 py-3 text-right text-xs font-medium text-text">
                            {formatCurrency(
                              row.revenue
                            )}
                          </td>

                          <td className="px-5 py-3 text-right text-xs text-muted">
                            {row.orders}
                          </td>

                          <td className="px-5 py-3 text-right text-xs text-muted">
                            {formatCurrency(
                              row.average
                            )}
                          </td>

                          <td className="px-5 py-3 text-right text-xs text-muted">
                            {share.toFixed(1)}%
                          </td>
                        </tr>
                      );
                    }
                  )}

                  <tr className="border-t border-border bg-surface-2/50">
                    <td className="px-5 py-3 text-xs font-semibold text-text">
                      Total
                    </td>

                    <td className="px-5 py-3 text-right text-xs font-semibold text-text">
                      {formatCurrency(
                        data.summary.revenue
                      )}
                    </td>

                    <td className="px-5 py-3 text-right text-xs font-semibold text-text">
                      {data.summary.orders}
                    </td>

                    <td className="px-5 py-3 text-right text-xs font-semibold text-text">
                      {formatCurrency(
                        data.summary.average_order
                      )}
                    </td>

                    <td className="px-5 py-3 text-right text-xs font-semibold text-text">
                      100%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </section>
      )}

      {/* ======================================================
          ORDERS
      ====================================================== */}

      {view === "orders" && data && (
        <section className="mt-4">
          <Card>
            <CardHeader
              title="Sales orders"
              subtitle={`${data.orders.length} confirmed orders`}
            />

            {data.orders.length === 0 ? (
              <SectionEmpty text="No confirmed orders for this period." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left">
                  <thead>
                    <tr className="border-b border-border text-[9px] uppercase tracking-[0.12em] text-muted">
                      <th className="px-5 py-3">
                        Order
                      </th>

                      <th className="px-5 py-3">
                        Customer
                      </th>

                      <th className="px-5 py-3">
                        Vehicle
                      </th>

                      <th className="px-5 py-3">
                        Fleet category
                      </th>

                      <th className="px-5 py-3">
                        Date
                      </th>

                      <th className="px-5 py-3 text-right">
                        Revenue
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {data.orders.map(
                      (order) => (
                        <tr
                          key={order.id}
                          className="hover:bg-surface-2/60"
                        >
                          <td className="px-5 py-3 text-xs font-medium text-text">
                            {order.name}
                          </td>

                          <td className="px-5 py-3 text-xs text-muted">
                            {order.customer}
                          </td>

                          <td className="px-5 py-3 text-xs text-muted">
                            {order.vehicle ||
                              "—"}
                          </td>

                          <td className="px-5 py-3 text-xs text-muted">
                            {order.fleet_category}
                          </td>

                          <td className="px-5 py-3 text-xs text-muted">
                            {formatDate(
                              order.date
                            )}
                          </td>

                          <td className="px-5 py-3 text-right text-xs font-medium text-text">
                            {formatCurrency(
                              order.amount
                            )}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}
    </main>
  );
}