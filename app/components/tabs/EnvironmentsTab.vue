<script setup lang="ts">
import type { GridColumn } from "~/utils/grid";
const f = useFilters();
const caps = useCapabilities();
const { data: d, status, error } = useFetch("/api/claude-code", { query: f.query });
const total = computed(() => (d.value ? d.value.remoteSplit.localSessions + d.value.remoteSplit.remoteSessions : 0));
type Term = { terminal: string; sessions: number; users: number };
const columns: GridColumn<Term>[] = [
  { key: "terminal", title: "Terminal", value: (t) => t.terminal },
  { key: "users", title: "Users", value: (t) => t.users, numeric: true },
  { key: "sessions", title: "Sessions", value: (t) => t.sessions, numeric: true },
];
</script>

<template>
  <div class="stack">
    <ApiState :pending="status === 'pending'" :error="error" />
    <template v-if="d">
      <div class="kpi-grid">
        <KpiTile label="Terminals in use" :value="fmtInt(d.terminals.length)" />
        <KpiTile v-if="caps.remoteSplit" label="Local sessions" :value="fmtInt(d.remoteSplit.localSessions)" :hint="total ? fmtPct(d.remoteSplit.localSessions / total) : undefined" />
        <KpiTile v-if="caps.remoteSplit" label="Remote sessions" :value="fmtInt(d.remoteSplit.remoteSessions)" :hint="total ? fmtPct(d.remoteSplit.remoteSessions / total) : undefined" />
      </div>
      <div class="chart-grid">
        <ChartCard title="Sessions by terminal"><HBarChart :data="d.terminals.map((t) => ({ key: t.terminal, value: t.sessions }))" :format="fmtInt" /></ChartCard>
        <ChartCard title="Users by terminal"><DataGrid :items="d.terminals" :columns="columns" sort-key="sessions" /></ChartCard>
      </div>
    </template>
  </div>
</template>
