<script setup lang="ts">
import type { ChartOptions, Plugin } from "chart.js";
import { Bar } from "vue-chartjs";

// Ranked horizontal bars, single series (the card title names it). Values are drawn at the bar end.
// `foldOther` sums the tail into "Other" — only meaningful for additive values like cost, not percentages.
const props = withDefaults(
  defineProps<{ data: { key: string; value: number }[]; format?: (v: number) => string; max?: number; foldOther?: boolean }>(),
  { format: (v: number) => String(v), max: 8, foldOther: true },
);
const c = useChartColors();

const rows = computed(() => {
  const top = props.data.slice(0, props.max);
  const rest = props.data.slice(props.max).reduce((s, d) => s + d.value, 0);
  return props.foldOther && rest > 0 ? [...top, { key: "Other", value: rest }] : top;
});

const chartData = computed(() => ({
  labels: rows.value.map((r) => r.key),
  datasets: [{ data: rows.value.map((r) => r.value), backgroundColor: c.value.series[0], borderRadius: 4, borderSkipped: "start" as const, barPercentage: 0.8 }],
}));

const valueLabels: Plugin<"bar"> = {
  id: "valueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.fillStyle = c.value.text2;
    ctx.textBaseline = "middle";
    chart.getDatasetMeta(0).data.forEach((bar, i) => ctx.fillText(props.format(rows.value[i]?.value ?? 0), bar.x + 6, bar.y));
    ctx.restore();
  },
};

const options = computed<ChartOptions<"bar">>(() => ({
  indexAxis: "y",
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  layout: { padding: { right: 72 } },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: c.value.surface, titleColor: c.value.text2, bodyColor: c.value.text, borderColor: c.value.border, borderWidth: 1,
      callbacks: { label: (ctx) => props.format(Number(ctx.parsed.x)) },
    },
  },
  scales: {
    x: { display: false, beginAtZero: true },
    y: { grid: { display: false }, border: { display: false }, ticks: { color: c.value.text2, font: { size: 12 } } },
  },
}));
</script>

<template>
  <div :style="{ height: `${Math.max(80, rows.length * 32 + 16)}px` }">
    <Bar :data="chartData" :options="options" :plugins="[valueLabels]" />
  </div>
</template>
