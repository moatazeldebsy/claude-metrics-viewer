// Chart palette in Claude's warm style. Slot 1 is Claude's clay; slots 2–8 are the dataviz reference hues
// in their validated order. Validated with the dataviz validator against the card surfaces below:
// light passes all checks (three slots under 3:1 contrast → tables provide the relief), dark passes all.
// Categorical slots are used in fixed order, never cycled; past 8 series fold into "Other" upstream.
export const PALETTE = {
  light: {
    series: [
      '#c6613f',
      '#2a78d6',
      '#1baf7a',
      '#eda100',
      '#e87ba4',
      '#008300',
      '#6250d6',
      '#e34948',
    ],
    surface: '#ffffff',
    border: '#e8e6dc',
    grid: '#f0eee6',
    text: '#141413',
    text2: '#5e5d59',
    muted: '#73726c',
  },
  dark: {
    series: [
      '#d4714f',
      '#3987e5',
      '#199e70',
      '#c98500',
      '#d55181',
      '#0ca30c',
      '#9085e9',
      '#e66767',
    ],
    surface: '#30302e',
    border: '#3e3e38',
    grid: '#3a3a37',
    text: '#faf9f5',
    text2: '#c2c0b6',
    muted: '#9c9a92',
  },
} as const;

export type ChartColors = (typeof PALETTE)['light'] | (typeof PALETTE)['dark'];

export interface SeriesDef {
  key: string;
  label: string;
  /** Override the categorical slot, e.g. muted gray for "inactive". Use a palette key like "muted". */
  color?: 'muted';
}
