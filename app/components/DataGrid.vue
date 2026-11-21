<script setup lang="ts" generic="T extends object">
// Client-side sortable table. Each column gives a raw value (used for sorting) and an optional formatter.
import type { GridColumn } from "~/utils/grid";

const props = withDefaults(
  defineProps<{ items: T[]; columns: GridColumn<T>[]; sortKey?: string; sortDesc?: boolean; perPage?: number; clickable?: boolean }>(),
  { sortKey: undefined, sortDesc: true, perPage: -1, clickable: false },
);
const emit = defineEmits<{ rowClick: [row: T] }>();

const headers = computed(() =>
  props.columns.map((c) => ({ key: c.key, title: c.title, value: (row: T) => c.value(row), align: c.numeric ? ("end" as const) : ("start" as const), sortable: true })),
);
const sortBy = ref(props.sortKey ? [{ key: props.sortKey, order: props.sortDesc ? ("desc" as const) : ("asc" as const) }] : []);
const display = (c: GridColumn<T>, row: T) => {
  const v = c.value(row);
  if (c.format) return c.format(v as never);
  return v == null ? "—" : typeof v === "number" ? fmtInt(v) : v;
};
</script>

<template>
  <v-data-table
    v-model:sort-by="sortBy"
    :headers="headers"
    :items="items"
    :items-per-page="perPage"
    :hide-default-footer="perPage === -1"
    :class="{ 'cursor-pointer': clickable }"
    @click:row="(_: unknown, { item }: { item: T }) => emit('rowClick', item)"
  >
    <template v-for="c in columns" :key="c.key" #[`item.${c.key}`]="{ item }">
      <span :class="{ tabular: c.numeric }">{{ display(c, item as T) }}</span>
    </template>
  </v-data-table>
</template>
