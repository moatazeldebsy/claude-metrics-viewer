// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  { ignores: ["playwright-report/**", "test-results/**", ".playwright-mcp/**", "backstage/*", "!backstage/packages/", "backstage/packages/*", "!backstage/packages/claude-metrics-lib/", "backstage/packages/claude-metrics-lib/*", "!backstage/packages/claude-metrics-lib/src/"] },
  // backstage/ has its own lint, except the shared data layer, which keeps the app's rules.
  // Vuetify table slots are named like `#item.sessions`; the dot is not a v-slot modifier.
  { rules: { "vue/valid-v-slot": ["error", { allowModifiers: true }] } },
);
