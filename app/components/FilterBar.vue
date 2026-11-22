<script setup lang="ts">
import { addDays } from "#lib/dates";

const props = defineProps<{ departments: string[]; holidayCountry?: string }>();
const f = useFilters();
const preset = (days: number) => f.set({ from: addDays(f.latest.value, -(days - 1)), to: f.latest.value });
const holidayLabel = computed(() => (props.holidayCountry ? `Exclude holidays (${props.holidayCountry})` : "Exclude holidays"));
</script>

<template>
  <v-card class="pa-3" data-testid="filters">
    <div class="d-flex flex-wrap align-center ga-3">
      <v-text-field type="date" label="From" :model-value="f.from.value" :max="f.to.value" max-width="170" @update:model-value="(v: string) => v && f.set({ from: v })" />
      <v-text-field type="date" label="To" :model-value="f.to.value" :min="f.from.value" :max="f.latest.value" max-width="170" @update:model-value="(v: string) => v && f.set({ to: v })" />
      <div class="d-flex ga-1">
        <v-btn v-for="n in [7, 28, 90]" :key="n" size="small" @click="preset(n)">Last {{ n }} days</v-btn>
      </div>
      <v-checkbox label="Exclude weekends" :model-value="f.param('excludeWeekends') === 'true'" @update:model-value="(v: boolean | null) => f.set({ excludeWeekends: v ? 'true' : null })" />
      <v-checkbox :label="holidayLabel" :model-value="f.param('excludeHolidays') === 'true'" @update:model-value="(v: boolean | null) => f.set({ excludeHolidays: v ? 'true' : null })" />
      <v-spacer />
      <v-select
        label="Department" :items="departments" :model-value="f.param('department')" clearable min-width="200" data-testid="department-filter"
        @update:model-value="(v: string | null) => f.set({ department: v })"
      />
      <UserPicker :model-value="f.param('user')" :query="f.query.value" @update:model-value="(user) => f.set({ user })" />
    </div>
  </v-card>
</template>
