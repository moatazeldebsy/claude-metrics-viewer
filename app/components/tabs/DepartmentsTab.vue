<script setup lang="ts">
import type { GridColumn } from "~/utils/grid";
import type { SeriesDef } from "~/utils/palette";
import type { DepartmentRow } from "#lib/departments-agg";

const f = useFilters();
const { data: d, status, error } = useFetch("/api/departments", { query: f.query });

const TIERS: SeriesDef[] = [
  { key: "power", label: "Power (≥60% of days)" },
  { key: "regular", label: "Regular (25–60%)" },
  { key: "light", label: "Light (<25%)" },
  { key: "inactive", label: "Inactive", color: "muted" },
];
const lowest = computed(() => d.value?.rows.slice(0, 15) ?? []);
// Trend: the 8 largest departments — a stable pick so colours follow departments, not rank changes.
const trendSeries = computed<SeriesDef[]>(() =>
  [...(d.value?.rows ?? [])]
    .sort((a, b) => b.seats - a.seats || a.department.localeCompare(b.department))
    .slice(0, 8)
    .map((r) => r.department)
    .sort()
    .map((dep) => ({ key: dep, label: dep })),
);
const weekly = computed(() => (d.value?.weekly ?? []).map((w) => ({ ...w, day: String(w.week) })));
const columns: GridColumn<DepartmentRow>[] = [
  { key: "department", title: "Department", value: (r) => r.department },
  { key: "seats", title: "Seats", value: (r) => r.seats, numeric: true },
  { key: "activeUsers", title: "Active", value: (r) => r.activeUsers, numeric: true },
  { key: "adoption", title: "Adoption", value: (r) => r.adoption, numeric: true, format: fmtPct as (v: never) => string },
  { key: "power", title: "Power", value: (r) => r.tiers.power, numeric: true },
  { key: "light", title: "Light", value: (r) => r.tiers.light, numeric: true },
  { key: "spa", title: "Sessions / active", value: (r) => r.sessionsPerActive, numeric: true, format: fmtFixed1 as (v: never) => string },
  { key: "acceptRate", title: "Accept rate", value: (r) => r.acceptRate, numeric: true, format: fmtPct as (v: never) => string },
  { key: "cost", title: "Est. cost", value: (r) => r.costCents, numeric: true, format: fmtUsd as (v: never) => string },
  { key: "cpa", title: "Cost / active", value: (r) => r.costPerActive, numeric: true, format: fmtUsd as (v: never) => string },
];
</script>

<template>
  <div class="stack">
    <ApiState :pending="status === 'pending'" :error="error" />
    <template v-if="d">
      <div class="kpi-grid">
        <KpiTile label="Org adoption" :value="fmtPct(d.totals.adoption)" :hint="`${fmtInt(d.totals.activeUsers)} of ${fmtInt(d.totals.seats)} seats active`" />
        <KpiTile label="Departments" :value="fmtInt(d.totals.departments)" />
        <KpiTile label="Power users" :value="fmtInt(d.totals.tiers.power)" hint="Active ≥60% of selected days" />
        <KpiTile label="Inactive seats" :value="fmtInt(d.totals.tiers.inactive)" />
      </div>
      <div class="chart-grid">
        <ChartCard title="Adoption by department" :subtitle="d.rows.length > 15 ? '15 lowest shown, lowest first' : 'Lowest first'">
          <HBarChart :data="lowest.map((r) => ({ key: r.department, value: r.adoption }))" :format="fmtPct" :max="15" :fold-other="false" />
        </ChartCard>
        <ChartCard title="Engagement mix by department" subtitle="Seats per engagement tier">
          <StackedBarChart horizontal :rows="lowest.map((r) => ({ name: r.department, ...r.tiers }))" x-key="name" :series="TIERS" :format="fmtInt" />
        </ChartCard>
      </div>
      <ChartCard title="Weekly adoption" subtitle="Share of seats active at least once that week · complete weeks · 8 largest departments">
        <TrendChart :rows="weekly" :series="trendSeries" :format="fmtPct" :height="300" />
      </ChartCard>
      <ChartCard title="All departments" subtitle="Click a row to filter the whole dashboard to that department">
        <DataGrid
          :items="d.rows" :columns="columns" sort-key="adoption" :sort-desc="false" clickable data-testid="departments-table"
          @row-click="(r) => f.set({ department: r.department, tab: null })"
        />
      </ChartCard>
    </template>
  </div>
</template>
