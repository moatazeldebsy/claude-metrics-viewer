import { act, renderHook } from '@testing-library/react';
import { useChartColors } from './useChartColors';

describe('useChartColors', () => {
  afterEach(() => document.body.removeAttribute('data-theme-mode'));

  it('uses the light palette by default', () => {
    const { result } = renderHook(() => useChartColors());
    expect(result.current.series[0]).toBe('#c6613f');
  });

  it('uses the dark palette when Backstage is in dark mode', () => {
    document.body.setAttribute('data-theme-mode', 'dark');
    const { result } = renderHook(() => useChartColors());
    expect(result.current.series[0]).toBe('#d4714f');
  });

  it('switches palette when the theme flips at runtime', async () => {
    const { result } = renderHook(() => useChartColors());
    await act(async () => {
      document.body.setAttribute('data-theme-mode', 'dark');
      await new Promise(r => setTimeout(r, 0));
    });
    expect(result.current.surface).toBe('#30302e');
  });
});
