<script setup lang="ts">
import type { FetchError } from "ofetch";

defineProps<{ pending: boolean; error?: FetchError | null }>();
</script>

<template>
  <v-progress-linear v-if="pending" indeterminate color="primary" class="mb-2" aria-label="Loading" />
  <v-alert v-if="error" type="error" variant="tonal" class="mb-4" data-testid="api-error">
    Couldn’t load data: {{ error.data?.message ?? error.message }}
  </v-alert>
</template>
