<script setup lang="ts">
import type { UserOption } from "#lib/users";

// Typeahead user filter: the server returns at most 20 matches per search, never the full member list.
const props = defineProps<{ modelValue: string | null; query: Record<string, string> }>();
const emit = defineEmits<{ "update:modelValue": [value: string | null] }>();

const search = ref("");
const debounced = useDebounced(search);
const items = ref<UserOption[]>([]);
const loading = ref(false);

watch(debounced, async (text) => {
  const q = text?.trim();
  if (!q || q === props.modelValue) return;
  loading.value = true;
  try {
    const { user: _ignored, ...filters } = props.query;
    const res = await $fetch("/api/user-search", { query: { ...filters, q } });
    items.value = res.options;
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <v-autocomplete
    v-model:search="search"
    :model-value="modelValue"
    :items="items"
    item-title="label"
    item-value="value"
    label="User"
    placeholder="Search name or email…"
    :loading="loading"
    no-filter
    clearable
    hide-no-data
    min-width="280"
    max-width="340"
    data-testid="user-picker"
    @update:model-value="(v: string | null) => emit('update:modelValue', v ?? null)"
  >
    <template #item="{ props: itemProps, item }">
      <v-list-item v-bind="itemProps" :subtitle="item.raw.department ?? undefined" />
    </template>
  </v-autocomplete>
</template>
