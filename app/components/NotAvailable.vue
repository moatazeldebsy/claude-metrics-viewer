<script setup lang="ts">
defineProps<{ title: string; reason: string }>();
</script>

<template>
  <v-card class="pa-6" data-testid="not-available">
    <div class="text-subtitle-1 font-serif mb-1">{{ title }}</div>
    <div class="text-body-2 text-medium-emphasis">{{ reason }}</div>
  </v-card>
</template>
