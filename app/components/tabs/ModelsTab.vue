<script setup lang="ts">
import type { GridColumn } from "~/utils/grid";
import type { SeriesDef } from "~/utils/palette";
import type { ClaudeCodeSummary } from "#lib/aggregate";
import { modelCostRows } from "#lib/chart-data";

const f = useFilters();
const { data: d, status, error } = useFetch("/api/claude-code", { query: f.query });
const daily = computed(() => modelCostRows(d.value?.daily ?? [], (d.value?.models ?? []).map((m) => m.model)));
const series = computed<SeriesDef[]>(() => (d.value?.models ?? []).map((m) => ({ key: m.model, label: m.model })));
type Model = ClaudeCodeSummary["models"][number];
const compact = fmtCompact as (v: never) => string;
const columns: GridColumn<Model>[] = [
  { key: "model", title: "Model", value: (m) => m.model },
  { key: "input", title: "Input", value: (m) => m.input, numeric: true, format: compact },
  { key: "output", title: "Output", value: (m) => m.output, numeric: true, format: compact },
  { key: "cacheRead", title: "Cache read", value: (m) => m.cacheRead, numeric: true, format: compact },
  { key: "cacheCreation", title: "Cache write", value: (m) => m.cacheCreation, numeric: true, format: compact },
  { key: "cost", title: "Est. cost", value: (m) => m.costCents, numeric: true, format: fmtUsd as (v: never) => string },
];
</script>

<template>
  <div class="stack">
    <ApiState :pending="status === 'pending'" :error="error" />
    <template v-if="d">
      <ChartCard title="Estimated Claude Code cost per model, daily"><TrendChart :rows="daily" :series="series" :format="fmtUsd" /></ChartCard>
      <ChartCard title="Tokens and cost by model"><DataGrid :items="d.models" :columns="columns" sort-key="cost" /></ChartCard>
    </template>
  </div>
</template>
