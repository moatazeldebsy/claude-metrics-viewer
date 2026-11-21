import {
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';

let registered = false;

/**
 * Register the Chart.js pieces the charts use. An explicit call rather than a side-effect import:
 * the package is `"sideEffects": false`, so bundlers drop bare `import './register'` lines.
 */
export function registerCharts() {
  if (registered) return;
  Chart.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend,
  );
  Chart.defaults.font.family = 'inherit';
  Chart.defaults.font.size = 11;
  registered = true;
}
