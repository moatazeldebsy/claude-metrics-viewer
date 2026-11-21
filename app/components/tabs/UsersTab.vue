<script setup lang="ts">
// Sorted, searched and paged on the server: works the same for 30 users or 30,000.
const f = useFilters();
const search = ref("");
const q = useDebounced(search);
const page = ref(1);
const perPage = ref(25);
const sortBy = ref<{ key: string; order: "asc" | "desc" }[]>([{ key: "sessions", order: "desc" }]);
watch([q, () => f.query.value], () => (page.value = 1));

const query = computed(() => ({
  ...f.query.value,
  q: q.value,
  page: String(page.value),
  pageSize: String(perPage.value),
  sort: sortBy.value[0]?.key ?? "sessions",
  desc: String((sortBy.value[0]?.order ?? "desc") === "desc"),
}));
const { data, status, error } = useFetch("/api/users", { query });

const headers = [
  { key: "label", title: "User" },
  { key: "department", title: "Department", sortable: false },
  { key: "activeDays", title: "Active days", align: "end" as const },
  { key: "sessions", title: "Sessions", align: "end" as const },
  { key: "linesAdded", title: "Lines +", align: "end" as const },
  { key: "commits", title: "Commits", align: "end" as const },
  { key: "prs", title: "PRs", align: "end" as const },
  { key: "acceptRate", title: "Accept rate", align: "end" as const },
  { key: "costCents", title: "Est. cost", align: "end" as const },
  { key: "lastActive", title: "Last active" },
];
</script>

<template>
  <ChartCard title="Users" subtitle="Sorted, searched and paged on the server">
    <ApiState :pending="false" :error="error" />
    <v-text-field v-model="search" label="Search users" placeholder="Filter by email or key name…" prepend-inner-icon="mdi-magnify" max-width="320" class="mb-3" />
    <v-data-table-server
      v-model:page="page" v-model:items-per-page="perPage" v-model:sort-by="sortBy"
      :headers="headers" :items="data?.rows ?? []" :items-length="data?.total ?? 0" :loading="status === 'pending'"
      :items-per-page-options="[25, 50, 100]" must-sort data-testid="users-table"
    >
      <template #item.department="{ item }">{{ item.department ?? "—" }}</template>
      <template #item.activeDays="{ item }"><span class="tabular">{{ fmtInt(item.activeDays) }}</span></template>
      <template #item.sessions="{ item }"><span class="tabular">{{ fmtInt(item.sessions) }}</span></template>
      <template #item.linesAdded="{ item }"><span class="tabular">{{ fmtInt(item.linesAdded) }}</span></template>
      <template #item.commits="{ item }"><span class="tabular">{{ fmtInt(item.commits) }}</span></template>
      <template #item.prs="{ item }"><span class="tabular">{{ fmtInt(item.prs) }}</span></template>
      <template #item.acceptRate="{ item }"><span class="tabular">{{ fmtPct(item.acceptRate) }}</span></template>
      <template #item.costCents="{ item }"><span class="tabular">{{ fmtUsd(item.costCents) }}</span></template>
    </v-data-table-server>
  </ChartCard>
</template>
