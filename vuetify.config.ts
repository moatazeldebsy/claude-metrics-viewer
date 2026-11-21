import { defineVuetifyConfiguration } from "vuetify-nuxt-module/custom-configuration";

// Claude-style theme: warm cream / charcoal surfaces, clay accent, thin warm borders, no shadows.
// `primary` is used for text (active tab, links), so it is the AA-contrast clay; charts use utils/palette.ts.
export default defineVuetifyConfiguration({
  icons: { defaultSet: "mdi" },
  theme: {
    defaultTheme: "system",
    themes: {
      light: {
        dark: false,
        colors: {
          background: "#faf9f5",
          surface: "#ffffff",
          "surface-variant": "#f0eee6",
          "on-surface-variant": "#141413",
          primary: "#b4552f",
          secondary: "#5e5d59",
          error: "#b53333",
          border: "#e8e6dc",
          "on-background": "#141413",
          "on-surface": "#141413",
        },
        variables: { "border-color": "#141413", "border-opacity": 0.12, "hover-opacity": 0.04 },
      },
      dark: {
        dark: true,
        colors: {
          background: "#262624",
          surface: "#30302e",
          "surface-variant": "#3a3a37",
          "on-surface-variant": "#faf9f5",
          primary: "#d97757",
          secondary: "#c2c0b6",
          error: "#e66767",
          border: "#3e3e38",
          "on-background": "#faf9f5",
          "on-surface": "#faf9f5",
        },
        variables: { "border-color": "#faf9f5", "border-opacity": 0.12, "hover-opacity": 0.06 },
      },
    },
  },
  defaults: {
    VCard: { variant: "flat", rounded: "lg" },
    VBtn: { variant: "tonal", rounded: "lg" },
    VChip: { variant: "tonal", rounded: "lg" },
    VTextField: { density: "compact", variant: "outlined", hideDetails: true, rounded: "lg" },
    VSelect: { density: "compact", variant: "outlined", hideDetails: true, rounded: "lg" },
    VAutocomplete: { density: "compact", variant: "outlined", hideDetails: true, rounded: "lg" },
    VCheckbox: { density: "compact", hideDetails: true, color: "primary" },
    VTabs: { color: "primary" },
    VDataTable: { density: "compact", hover: true },
    VDataTableServer: { density: "compact", hover: true },
  },
});
