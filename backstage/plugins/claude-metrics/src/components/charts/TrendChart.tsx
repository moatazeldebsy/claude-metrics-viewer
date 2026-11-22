import type { ChartOptions } from 'chart.js';
import { Line } from 'react-chartjs-2';
import {
  isolatedPointRadius,
  type SeriesDef,
} from '@internal/claude-metrics-lib';
import { registerCharts } from './register';
import { tooltipColors } from './tooltip';
import { useChartColors } from './useChartColors';

const at = (row: object, key: string) => (row as Record<string, unknown>)[key];

/** Daily line chart with one shared y-axis: only plot series of the same unit together. */
export function TrendChart({
  rows,
  series,
  xKey = 'day',
  format = String,
  height = 240,
}: {
  rows: object[];
  series: SeriesDef[];
  xKey?: string;
  format?: (v: number) => string;
  height?: number;
}) {
  registerCharts();
  const c = useChartColors();
  const data = {
    labels: rows.map(r => String(at(r, xKey)).slice(5)),
    datasets: series.map((s, i) => {
      const color = s.color ? c[s.color] : c.series[i];
      const values = rows.map(
        r => (at(r, s.key) as number | null | undefined) ?? null,
      );
      return {
        label: s.label,
        data: values,
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        // No points except where a value has no neighbours: a lone day would otherwise be invisible.
        pointRadius: isolatedPointRadius(values),
        pointHoverRadius: 4,
        pointHoverBorderColor: c.surface,
        pointHoverBorderWidth: 2,
        cubicInterpolationMode: 'monotone' as const,
        spanGaps: false,
      };
    }),
  };
  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        display: series.length > 1,
        labels: { color: c.text2, boxWidth: 14, boxHeight: 2 },
      },
      tooltip: {
        ...tooltipColors(c),
        callbacks: {
          label: ctx =>
            `${ctx.dataset.label}: ${
              ctx.parsed.y === null ? '—' : format(ctx.parsed.y)
            }`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: c.muted, maxRotation: 0, autoSkipPadding: 20 },
      },
      y: {
        beginAtZero: true,
        grid: { color: c.grid },
        border: { display: false },
        ticks: { color: c.muted, callback: v => format(Number(v)) },
      },
    },
  };
  return (
    <div style={{ height }}>
      <Line data={data} options={options} />
    </div>
  );
}
