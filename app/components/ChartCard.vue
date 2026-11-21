<script setup lang="ts">
defineProps<{ title: string; subtitle?: string }>();
</script>

<template>
  <v-card class="pa-4">
    <div class="text-subtitle-1 font-serif">{{ title }}</div>
    <div v-if="subtitle" class="text-caption text-muted">{{ subtitle }}</div>
    <div class="mt-3"><slot /></div>
  </v-card>
</template>
