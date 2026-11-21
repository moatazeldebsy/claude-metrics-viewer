<script setup lang="ts">
import type { SeriesDef } from "~/utils/palette";
import type { ChartOptions } from "chart.js";
import { Bar } from "vue-chartjs";

// Stacked bars with a 2px surface-coloured gap between segments.
const props = withDefaults(
  defineProps<{ rows: object[]; xKey: string; series: SeriesDef[]; format?: (v: number) => string; horizontal?: boolean }>(),
  { format: (v: number) => String(v), horizontal: false },
);
const c = useChartColors();
const at = (row: object, key: string) => (row as Record<string, unknown>)[key];

const data = computed(() => ({
  labels: props.rows.map((r) => String(at(r, props.xKey))),
  datasets: props.series.map((s, i) => ({
    label: s.label,
    data: props.rows.map((r) => Number(at(r, s.key) ?? 0)),
    backgroundColor: s.color ? c.value[s.color] : c.value.series[i],
    borderColor: c.value.surface,
    borderWidth: 1,
    borderRadius: i === props.series.length - 1 ? 4 : 0,
    borderSkipped: "start" as const,
  })),
}));

const options = computed<ChartOptions<"bar">>(() => {
  const value = { stacked: true, beginAtZero: true, grid: { color: c.value.grid }, border: { display: false }, ticks: { color: c.value.muted, callback: (v: string | number) => props.format(Number(v)) } };
  const category = { stacked: true, grid: { display: false }, border: { display: false }, ticks: { color: c.value.text2 } };
  return {
    indexAxis: props.horizontal ? "y" : "x",
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: "index", intersect: false },
    plugins: {
      legend: { labels: { color: c.value.text2, boxWidth: 12, boxHeight: 12 } },
      tooltip: {
        backgroundColor: c.value.surface, titleColor: c.value.text2, bodyColor: c.value.text, borderColor: c.value.border, borderWidth: 1,
        callbacks: { label: (ctx) => `${ctx.dataset.label}: ${props.format(Number(props.horizontal ? ctx.parsed.x : ctx.parsed.y))}` },
      },
    },
    scales: props.horizontal ? { x: value, y: category } : { x: category, y: value },
  };
});
</script>

<template>
  <div :style="{ height: horizontal ? `${Math.max(120, rows.length * 30 + 60)}px` : '240px' }">
    <Bar :data="data" :options="options" />
  </div>
</template>
