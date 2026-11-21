<script setup lang="ts">
const f = useFilters();
const search = ref("");
const q = useDebounced(search);
const page = ref(1);
watch([q, () => f.query.value], () => (page.value = 1));
const query = computed(() => ({ ...f.query.value, q: q.value, page: String(page.value), pageSize: "25" }));
const { data: d, status, error } = useFetch("/api/seats", { query });
const headers = [
  { key: "name", title: "Name", sortable: false },
  { key: "email", title: "Email", sortable: false },
  { key: "department", title: "Department", sortable: false },
  { key: "role", title: "Role", sortable: false },
  { key: "added_at", title: "Member since", sortable: false },
];
</script>

<template>
  <div class="stack">
    <ApiState :pending="false" :error="error" />
    <div v-if="d" class="kpi-grid">
      <KpiTile label="Members" :value="fmtInt(d.totalSeats)" />
      <KpiTile label="Used Claude Code" :value="fmtInt(d.activeSeats)" :hint="d.totalSeats ? fmtPct(d.activeSeats / d.totalSeats) : undefined" />
      <KpiTile label="No activity" :value="fmtInt(d.idleCount)" />
    </div>
    <ChartCard title="Members with no Claude Code activity in this range">
      <v-text-field v-model="search" label="Search idle members" placeholder="Filter by name, email or department…" prepend-inner-icon="mdi-magnify" max-width="320" class="mb-3" />
      <v-data-table-server
        v-model:page="page" :headers="headers" :items="d?.idle.rows ?? []" :items-length="d?.idle.total ?? 0"
        :items-per-page="25" :items-per-page-options="[25]" :loading="status === 'pending'" data-testid="idle-table"
      >
        <template #item.department="{ item }">{{ item.department ?? "Unassigned" }}</template>
        <template #item.added_at="{ item }">{{ item.added_at.slice(0, 10) }}</template>
      </v-data-table-server>
    </ChartCard>
  </div>
</template>
