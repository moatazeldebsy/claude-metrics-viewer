<script setup lang="ts">
import type { GridColumn } from "~/utils/grid";
import type { UserRow } from "#lib/aggregate";

const f = useFilters();
const { data: d, status, error } = useFetch("/api/claude-code", { query: f.query });
const columns: GridColumn<UserRow>[] = [
  { key: "label", title: "User", value: (u) => u.label },
  { key: "commits", title: "Commits", value: (u) => u.commits, numeric: true },
  { key: "prs", title: "PRs", value: (u) => u.prs, numeric: true },
  { key: "linesAdded", title: "Lines added", value: (u) => u.linesAdded, numeric: true },
];
</script>

<template>
  <div class="stack">
    <ApiState :pending="status === 'pending'" :error="error" />
    <template v-if="d">
      <div class="kpi-grid">
        <KpiTile label="Commits by Claude Code" :value="fmtInt(d.kpis.commits)" />
        <KpiTile label="Pull requests by Claude Code" :value="fmtInt(d.kpis.prs)" />
        <KpiTile label="Commits per active user" :value="d.kpis.activeUsers ? fmtFixed1(d.kpis.commits / d.kpis.activeUsers) : '—'" />
        <KpiTile label="Lines added per commit" :value="d.kpis.commits ? fmtInt(d.kpis.linesAdded / d.kpis.commits) : '—'" />
      </div>
      <ChartCard title="Commits and pull requests per day">
        <TrendChart :rows="d.daily" :series="[{ key: 'commits', label: 'Commits' }, { key: 'prs', label: 'Pull requests' }]" />
      </ChartCard>
      <ChartCard title="Top contributors"><DataGrid :items="d.topContributors" :columns="columns" sort-key="commits" /></ChartCard>
    </template>
  </div>
</template>
