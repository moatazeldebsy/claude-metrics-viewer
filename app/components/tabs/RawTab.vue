<script setup lang="ts">
const f = useFilters();
const day = ref(f.to.value);
const source = ref<"claude_code" | "cost">("claude_code");
const query = computed(() => ({ source: source.value, day: day.value, from: day.value, to: day.value }));
const { data, status, error } = useFetch("/api/raw", { query });
</script>

<template>
  <ChartCard title="Raw API response" subtitle="Untouched upstream rows for one day">
    <div class="d-flex flex-wrap ga-3 mb-3">
      <v-select v-model="source" label="Endpoint" data-testid="endpoint-select" :items="[{ title: 'usage_report/claude_code', value: 'claude_code' }, { title: 'analytics/cost', value: 'cost' }]" max-width="280" />
      <v-text-field v-model="day" type="date" label="Day" max-width="180" />
    </div>
    <ApiState :pending="status === 'pending'" :error="error" />
    <pre class="pa-3 rounded overflow-auto text-caption raw-json" data-testid="raw-json">{{ JSON.stringify(data, null, 2) }}</pre>
  </ChartCard>
</template>
