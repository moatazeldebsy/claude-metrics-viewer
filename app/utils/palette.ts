// Dataviz reference palette (validated for CVD separation and contrast in both modes).
// Categorical slots are used in fixed order, never cycled; past 8 series fold into "Other" upstream.
export const PALETTE = {
  light: {
    series: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
    surface: "#fcfcfb", border: "#e3e2de", grid: "#ecebe7", text: "#0b0b0b", text2: "#52514e", muted: "#7a7974",
  },
  dark: {
    series: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#0ca30c", "#9085e9", "#e66767"],
    surface: "#1a1a19", border: "#2e2e2c", grid: "#262624", text: "#f0efec", text2: "#c3c2b7", muted: "#8f8e86",
  },
} as const;

export type ChartColors = (typeof PALETTE)["light"] | (typeof PALETTE)["dark"];

export interface SeriesDef {
  key: string;
  label: string;
  /** Override the categorical slot, e.g. muted gray for "inactive". Use a palette key like "muted". */
  color?: "muted";
}
