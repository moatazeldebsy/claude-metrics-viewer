<script setup lang="ts">
import type { SeriesDef } from "~/utils/palette";
import type { ChartOptions } from "chart.js";
import { Line } from "vue-chartjs";

// Daily line chart with one shared y-axis: only plot series of the same unit together.
const props = withDefaults(
  defineProps<{ rows: object[]; series: SeriesDef[]; xKey?: string; format?: (v: number) => string; height?: number }>(),
  { xKey: "day", format: (v: number) => String(v), height: 240 },
);
const c = useChartColors();
const at = (row: object, key: string) => (row as Record<string, unknown>)[key];

const data = computed(() => ({
  labels: props.rows.map((r) => String(at(r, props.xKey)).slice(5)),
  datasets: props.series.map((s, i) => {
    const color = s.color ? c.value[s.color] : c.value.series[i];
    return {
      label: s.label,
      data: props.rows.map((r) => (at(r, s.key) as number | null | undefined) ?? null),
      borderColor: color,
      backgroundColor: color,
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBorderColor: c.value.surface,
      pointHoverBorderWidth: 2,
      cubicInterpolationMode: "monotone" as const,
      spanGaps: false,
    };
  }),
}));

const options = computed<ChartOptions<"line">>(() => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: props.series.length > 1, labels: { color: c.value.text2, boxWidth: 14, boxHeight: 2 } },
    tooltip: {
      backgroundColor: c.value.surface, titleColor: c.value.text2, bodyColor: c.value.text, borderColor: c.value.border, borderWidth: 1,
      callbacks: { label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y == null ? "—" : props.format(ctx.parsed.y)}` },
    },
  },
  scales: {
    x: { grid: { display: false }, border: { display: false }, ticks: { color: c.value.muted, maxRotation: 0, autoSkipPadding: 20 } },
    y: { beginAtZero: true, grid: { color: c.value.grid }, border: { display: false }, ticks: { color: c.value.muted, callback: (v) => props.format(Number(v)) } },
  },
}));
</script>

<template>
  <div :style="{ height: `${height}px` }"><Line :data="data" :options="options" /></div>
</template>
