import { defineVuetifyConfiguration } from "vuetify-nuxt-module/custom-configuration";

// Surfaces and accent come from the validated dataviz reference palette, so charts and chrome match.
export default defineVuetifyConfiguration({
  icons: { defaultSet: "mdi" },
  theme: {
    defaultTheme: "system",
    themes: {
      light: {
        dark: false,
        colors: {
          background: "#f4f4f2",
          surface: "#fcfcfb",
          "surface-variant": "#ecebe7",
          primary: "#2a78d6",
          secondary: "#52514e",
          "on-background": "#0b0b0b",
          "on-surface": "#0b0b0b",
        },
      },
      dark: {
        dark: true,
        colors: {
          background: "#111110",
          surface: "#1a1a19",
          "surface-variant": "#262624",
          primary: "#3987e5",
          secondary: "#c3c2b7",
          "on-background": "#f0efec",
          "on-surface": "#f0efec",
        },
      },
    },
  },
  defaults: {
    VCard: { variant: "outlined", rounded: "lg" },
    VBtn: { variant: "outlined", rounded: "md" },
    VTextField: { density: "compact", variant: "outlined", hideDetails: true },
    VSelect: { density: "compact", variant: "outlined", hideDetails: true },
    VAutocomplete: { density: "compact", variant: "outlined", hideDetails: true },
    VCheckbox: { density: "compact", hideDetails: true },
    VDataTable: { density: "compact", hover: true },
    VDataTableServer: { density: "compact", hover: true },
  },
});
