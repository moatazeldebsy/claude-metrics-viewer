import type { ChartOptions } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import type { SeriesDef } from '../../lib';
import { registerCharts } from './register';
import { tooltipColors } from './tooltip';
import { useChartColors } from './useChartColors';

const at = (row: object, key: string) => (row as Record<string, unknown>)[key];

/** Stacked bars with a thin surface-coloured gap between segments. */
export function StackedBarChart({
  rows,
  xKey,
  series,
  format = String,
  horizontal = false,
}: {
  rows: object[];
  xKey: string;
  series: SeriesDef[];
  format?: (v: number) => string;
  horizontal?: boolean;
}) {
  registerCharts();
  const c = useChartColors();
  const data = {
    labels: rows.map(r => String(at(r, xKey))),
    datasets: series.map((s, i) => ({
      label: s.label,
      data: rows.map(r => Number(at(r, s.key) ?? 0)),
      backgroundColor: s.color ? c[s.color] : c.series[i],
      borderColor: c.surface,
      borderWidth: 1,
      borderRadius: i === series.length - 1 ? 4 : 0,
      borderSkipped: 'start' as const,
    })),
  };
  const value = {
    stacked: true,
    beginAtZero: true,
    grid: { color: c.grid },
    border: { display: false },
    ticks: {
      color: c.muted,
      callback: (v: string | number) => format(Number(v)),
    },
  };
  const category = {
    stacked: true,
    grid: { display: false },
    border: { display: false },
    ticks: { color: c.text2 },
  };
  const options: ChartOptions<'bar'> = {
    indexAxis: horizontal ? 'y' : 'x',
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: { labels: { color: c.text2, boxWidth: 12, boxHeight: 12 } },
      tooltip: {
        ...tooltipColors(c),
        callbacks: {
          label: ctx =>
            `${ctx.dataset.label}: ${format(
              Number(horizontal ? ctx.parsed.x : ctx.parsed.y),
            )}`,
        },
      },
    },
    scales: horizontal ? { x: value, y: category } : { x: category, y: value },
  };
  return (
    <div
      style={{
        height: horizontal ? Math.max(120, rows.length * 30 + 60) : 240,
      }}
    >
      <Bar data={data} options={options} />
    </div>
  );
}
