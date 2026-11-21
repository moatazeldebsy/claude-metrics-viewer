import '@testing-library/jest-dom';
// Chart.js needs a 2D canvas context and ResizeObserver, neither of which jsdom provides.
import 'jest-canvas-mock';

globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
