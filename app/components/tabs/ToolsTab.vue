<script setup lang="ts">
import type { GridColumn } from "~/utils/grid";
import { TOOL_NAMES, type ToolName } from "#lib/anthropic-types";

const LABELS: Record<ToolName, string> = { edit_tool: "Edit", multi_edit_tool: "MultiEdit", write_tool: "Write", notebook_edit_tool: "NotebookEdit" };
const f = useFilters();
const { data: d, status, error } = useFetch("/api/claude-code", { query: f.query });
const daily = computed(() => (d.value?.daily ?? []).map((p) => ({ day: p.day, ...p.toolRates })));
type Tool = { tool: ToolName; accepted: number; rejected: number; rate: number | null };
const columns: GridColumn<Tool>[] = [
  { key: "tool", title: "Tool", value: (t) => LABELS[t.tool] },
  { key: "accepted", title: "Accepted", value: (t) => t.accepted, numeric: true },
  { key: "rejected", title: "Rejected", value: (t) => t.rejected, numeric: true },
  { key: "total", title: "Total", value: (t) => t.accepted + t.rejected, numeric: true },
  { key: "rate", title: "Accept rate", value: (t) => t.rate, numeric: true, format: fmtPct as (v: never) => string },
];
</script>

<template>
  <div class="stack">
    <ApiState :pending="status === 'pending'" :error="error" />
    <template v-if="d">
      <div class="kpi-grid">
        <KpiTile v-for="t in d.tools" :key="t.tool" :label="`${LABELS[t.tool]} accept rate`" :value="fmtPct(t.rate)" :hint="`${fmtInt(t.accepted + t.rejected)} proposals`" />
      </div>
      <div class="chart-grid">
        <ChartCard title="Accept rate by tool, daily">
          <TrendChart :rows="daily" :series="TOOL_NAMES.map((t) => ({ key: t, label: LABELS[t] }))" :format="fmtPct" />
        </ChartCard>
        <ChartCard title="Proposals by tool">
          <StackedBarChart :rows="d.tools.map((t) => ({ ...t, name: LABELS[t.tool] }))" x-key="name" :series="[{ key: 'accepted', label: 'Accepted' }, { key: 'rejected', label: 'Rejected' }]" :format="fmtCompact" />
        </ChartCard>
      </div>
      <ChartCard title="Table view"><DataGrid :items="d.tools" :columns="columns" sort-key="total" /></ChartCard>
    </template>
  </div>
</template>
