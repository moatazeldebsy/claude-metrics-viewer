import type { ChartOptions, Plugin } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { registerCharts } from './register';
import { tooltipColors } from './tooltip';
import { useChartColors } from './useChartColors';

/**
 * Ranked horizontal bars, single series (the card title names it). Values are drawn at the bar end.
 * `foldOther` sums the tail into "Other" — only meaningful for additive values like cost, not percentages.
 */
export function HBarChart({
  data,
  format = String,
  max = 8,
  foldOther = true,
}: {
  data: { key: string; value: number }[];
  format?: (v: number) => string;
  max?: number;
  foldOther?: boolean;
}) {
  registerCharts();
  const c = useChartColors();
  const top = data.slice(0, max);
  const rest = data.slice(max).reduce((s, d) => s + d.value, 0);
  const rows =
    foldOther && rest > 0 ? [...top, { key: 'Other', value: rest }] : top;

  const chartData = {
    labels: rows.map(r => r.key),
    datasets: [
      {
        data: rows.map(r => r.value),
        backgroundColor: c.series[0],
        borderRadius: 4,
        borderSkipped: 'start' as const,
        barPercentage: 0.8,
      },
    ],
  };
  const valueLabels: Plugin<'bar'> = {
    id: 'valueLabels',
    afterDatasetsDraw(chart) {
      const { ctx } = chart;
      ctx.save();
      ctx.fillStyle = c.text2;
      ctx.textBaseline = 'middle';
      chart
        .getDatasetMeta(0)
        .data.forEach((bar, i) =>
          ctx.fillText(format(rows[i]?.value ?? 0), bar.x + 6, bar.y),
        );
      ctx.restore();
    },
  };
  const options: ChartOptions<'bar'> = {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    layout: { padding: { right: 72 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        ...tooltipColors(c),
        callbacks: { label: ctx => format(Number(ctx.parsed.x)) },
      },
    },
    scales: {
      x: { display: false, beginAtZero: true },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: c.text2, font: { size: 12 } },
      },
    },
  };
  return (
    <div style={{ height: Math.max(80, rows.length * 32 + 16) }}>
      <Bar data={chartData} options={options} plugins={[valueLabels]} />
    </div>
  );
}
