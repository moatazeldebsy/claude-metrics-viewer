import { BarElement, CategoryScale, Chart, Legend, LinearScale, LineElement, PointElement, Tooltip } from "chart.js";

export default defineNuxtPlugin(() => {
  Chart.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend);
  Chart.defaults.font.family = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';
  Chart.defaults.font.size = 11;
});
