import type { ReactNode } from 'react';

// Same grids as the Nuxt app's main.css: four KPI tiles per row, two charts per row on wide screens.
export const KpiGrid = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns:
        'repeat(auto-fill, minmax(max(220px, calc((100% - 36px) / 4)), 1fr))',
      gap: 12,
    }}
  >
    {children}
  </div>
);

export const ChartGrid = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))',
      gap: 16,
    }}
  >
    {children}
  </div>
);

export const Stack = ({ children }: { children: ReactNode }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    {children}
  </div>
);
