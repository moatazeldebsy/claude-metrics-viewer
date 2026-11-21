<script setup lang="ts">
import { useTheme } from "vuetify";

// Cycles system → light → dark; the choice is remembered per browser.
const MODES = [
  { name: "system", icon: "mdi-theme-light-dark", label: "System theme" },
  { name: "light", icon: "mdi-white-balance-sunny", label: "Light theme" },
  { name: "dark", icon: "mdi-weather-night", label: "Dark theme" },
] as const;
const KEY = "theme";

const theme = useTheme();
const index = ref(0);

function apply(i: number) {
  index.value = i;
  theme.change(MODES[i]!.name);
}

// Runs before first render (ssr: false), so a saved theme applies without a flash.
try {
  const saved = MODES.findIndex((m) => m.name === localStorage.getItem(KEY));
  if (saved > 0) apply(saved);
} catch { /* storage unavailable: stay on system */ }

function next() {
  apply((index.value + 1) % MODES.length);
  try { localStorage.setItem(KEY, MODES[index.value]!.name); } catch { /* not persisted */ }
}

const mode = computed(() => MODES[index.value]!);
</script>

<template>
  <v-btn :icon="mode.icon" :aria-label="`${mode.label} (click to change)`" :title="mode.label" variant="text" size="small" data-testid="theme-toggle" @click="next" />
</template>
