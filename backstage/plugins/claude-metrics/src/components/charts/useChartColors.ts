import { useSyncExternalStore } from 'react';
import { PALETTE, type ChartColors } from '../../lib';

// Backstage's theme provider puts `data-theme-mode` on <body>; Backstage UI's CSS keys off it too.
const MODE_ATTR = 'data-theme-mode';

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: [MODE_ATTR],
  });
  return () => observer.disconnect();
}

const isDark = () => document.body.getAttribute(MODE_ATTR) === 'dark';

/** Chart palette for the active Backstage theme; charts re-render when the theme flips. */
export function useChartColors(): ChartColors {
  return useSyncExternalStore(subscribe, isDark) ? PALETTE.dark : PALETTE.light;
}
