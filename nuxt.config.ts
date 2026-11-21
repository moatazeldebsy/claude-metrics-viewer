import { fileURLToPath } from "node:url";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2026-11-01",
  devtools: { enabled: false },

  // Internal dashboard: no SEO need, and client rendering avoids server/browser date mismatches.
  ssr: false,

  modules: ["vuetify-nuxt-module", "@nuxt/eslint"],

  // Framework-free data layer shared by server routes, the client (types only) and unit tests.
  alias: { "#lib": fileURLToPath(new URL("./lib", import.meta.url)) },

  // Register components by file name (TrendChart, not ChartsTrendChart).
  components: [{ path: "~/components", pathPrefix: false }],

  css: ["~/assets/main.css"],

  app: {
    head: {
      title: "Claude Metrics Viewer",
      meta: [{ name: "description", content: "Claude Code adoption and Claude API usage & cost for your Anthropic organization" }],
    },
  },

  vuetify: {
    moduleOptions: { styles: true },
  },

  typescript: { strict: true },
});
