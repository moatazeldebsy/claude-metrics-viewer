<script setup lang="ts">
defineProps<{ label: string; value: string; hint?: string }>();
</script>

<template>
  <v-card class="pa-4" data-testid="kpi">
    <div class="text-caption text-medium-emphasis">{{ label }}</div>
    <div class="text-h5 font-serif tabular mt-1" data-testid="kpi-value">{{ value }}</div>
    <div v-if="hint" class="text-caption text-muted mt-1">{{ hint }}</div>
  </v-card>
</template>
