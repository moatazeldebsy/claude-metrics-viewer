import { useTheme } from "vuetify";

/** Palette for the active Vuetify theme; charts re-render when the theme flips. */
export function useChartColors() {
  const theme = useTheme();
  return computed(() => (theme.global.current.value.dark ? PALETTE.dark : PALETTE.light));
}
