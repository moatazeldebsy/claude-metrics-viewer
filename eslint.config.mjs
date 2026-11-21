// @ts-check
import withNuxt from "./.nuxt/eslint.config.mjs";

export default withNuxt(
  { ignores: ["playwright-report/**", "test-results/**", ".playwright-mcp/**", "backstage/**"] },
  // Vuetify table slots are named like `#item.sessions`; the dot is not a v-slot modifier.
  { rules: { "vue/valid-v-slot": ["error", { allowModifiers: true }] } },
);
