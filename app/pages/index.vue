<script setup lang="ts">
import CommitsTab from "~/components/tabs/CommitsTab.vue";
import CostTab from "~/components/tabs/CostTab.vue";
import DepartmentsTab from "~/components/tabs/DepartmentsTab.vue";
import EnvironmentsTab from "~/components/tabs/EnvironmentsTab.vue";
import ModelsTab from "~/components/tabs/ModelsTab.vue";
import OverviewTab from "~/components/tabs/OverviewTab.vue";
import RawTab from "~/components/tabs/RawTab.vue";
import SeatsTab from "~/components/tabs/SeatsTab.vue";
import ToolsTab from "~/components/tabs/ToolsTab.vue";
import UsersTab from "~/components/tabs/UsersTab.vue";

const TABS = [
  { id: "overview", label: "Overview", component: OverviewTab },
  { id: "departments", label: "Departments", component: DepartmentsTab },
  { id: "tools", label: "Tool acceptance", component: ToolsTab },
  { id: "environments", label: "Environments", component: EnvironmentsTab },
  { id: "commits", label: "Commits & PRs", component: CommitsTab },
  { id: "models", label: "Models", component: ModelsTab },
  { id: "cost", label: "Cost & usage", component: CostTab },
  { id: "users", label: "Users", component: UsersTab },
  { id: "seats", label: "Seats", component: SeatsTab },
  { id: "api", label: "API response", component: RawTab },
];

const f = useFilters();
const { data: meta, refresh: refreshMeta } = useMeta();
const caps = useCapabilities();
const tabs = computed(() => TABS.filter((t) => t.id !== "api" || caps.value.rawUpstream));
const active = computed(() => tabs.value.find((t) => t.id === f.tab.value) ?? tabs.value[0]!);
// OpenTelemetry mode before any data: show setup instructions and check again every 10 s.
const waitingForTelemetry = computed(() => meta.value?.dataSource === "otel" && meta.value.telemetry?.lastReceivedAt === null);
let poll: ReturnType<typeof setInterval> | undefined;
watch(waitingForTelemetry, (waiting) => {
  clearInterval(poll);
  if (waiting) poll = setInterval(() => refreshMeta(), 10_000);
}, { immediate: true });
onBeforeUnmount(() => clearInterval(poll));
</script>

<template>
  <v-container max-width="1400" class="py-6">
    <header class="d-flex flex-wrap align-baseline justify-space-between ga-2 mb-4">
      <div>
        <h1 class="text-h5 font-serif">Claude Metrics Viewer</h1>
        <p class="text-body-2 text-medium-emphasis">Claude Code adoption and Claude API usage &amp; cost</p>
      </div>
      <div class="d-flex align-center ga-2">
        <v-chip v-if="meta?.dataSource === 'mock'" size="small" color="primary" data-testid="mock-badge">
          Mock data, set DATA_SOURCE=anthropic for real data
        </v-chip>
        <v-chip v-else-if="meta?.dataSource === 'otel'" size="small" color="primary" data-testid="source-badge">OpenTelemetry</v-chip>
        <ThemeToggle />
      </div>
    </header>

    <TelemetrySetup v-if="waitingForTelemetry" />
    <template v-else>
      <FilterBar :departments="meta?.departments ?? []" :holiday-country="meta?.holidayCountry" />

      <v-tabs :model-value="active.id" color="primary" show-arrows class="mt-4 border-b" @update:model-value="(t) => f.set({ tab: t === 'overview' ? null : String(t) })">
        <v-tab v-for="t in tabs" :key="t.id" :value="t.id">{{ t.label }}</v-tab>
      </v-tabs>

      <main class="mt-4">
        <component :is="active.component" :key="active.id" />
      </main>
    </template>
  </v-container>
</template>
