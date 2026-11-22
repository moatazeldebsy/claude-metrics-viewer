<script setup lang="ts">
const f = useFilters();
const caps = useCapabilities();
const { data: d, status, error } = useFetch("/api/cost", { query: f.query });
const DIMS = { model: "model", workspace_id: "workspace", api_key_id: "API key", product: "product", service_tier: "service tier", cost_type: "cost type" } as const;
const days = computed(() => d.value?.daily.filter((x) => x.cents > 0).length || 1);
const filtered = computed(() => Boolean(f.param("user") || f.param("department")));
</script>

<template>
  <NotAvailable
    v-if="!caps.billedCost"
    title="Cost & usage isn't available with OpenTelemetry data"
    reason="Billed cost comes from the Admin API. With OpenTelemetry data, Overview and Models show Claude Code's estimated cost."
  />
  <div v-else class="stack">
    <ApiState :pending="status === 'pending'" :error="error" />
    <v-alert v-if="filtered" type="info" variant="tonal" density="compact" data-testid="cost-filter-note">
      Organization-wide figures: the department and user filters don’t apply here, because the cost API has no department dimension.
    </v-alert>
    <template v-if="d">
      <div class="kpi-grid">
        <KpiTile label="Total cost" :value="fmtUsd(d.totalCents)" hint="After discounts, before credits" />
        <KpiTile label="List price" :value="fmtUsd(d.listCents)" />
        <KpiTile label="Discounts" :value="fmtUsd(d.listCents - d.totalCents)" hint="Batch and other discounts" />
        <KpiTile label="Average per day" :value="fmtUsd(d.totalCents / days)" />
      </div>
      <ChartCard title="Daily cost" subtitle="Usage & Cost Analytics API. Data can lag 4 to 24 hours.">
        <TrendChart :rows="d.daily" :series="[{ key: 'cents', label: 'Cost' }]" :format="fmtUsd" />
      </ChartCard>
      <div class="chart-grid">
        <ChartCard v-for="(label, dim) in DIMS" :key="dim" :title="`Cost by ${label}`">
          <HBarChart :data="d.by[dim].map((r) => ({ key: r.key === '(none)' ? '(none)' : r.key, value: r.cents }))" :format="fmtUsd" />
        </ChartCard>
      </div>
    </template>
  </div>
</template>
