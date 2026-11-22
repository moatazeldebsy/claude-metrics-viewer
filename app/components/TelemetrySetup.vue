<script setup lang="ts">
// Shown in OpenTelemetry mode until the first telemetry arrives: what to set on each machine.
const origin = window.location.origin;
const env = [
  "export CLAUDE_CODE_ENABLE_TELEMETRY=1",
  "export OTEL_METRICS_EXPORTER=otlp",
  `export OTEL_EXPORTER_OTLP_ENDPOINT=${origin}`,
  'export OTEL_EXPORTER_OTLP_HEADERS="Authorization=Bearer <your-ingest-token>"',
].join("\n");
const managed = JSON.stringify(
  {
    env: {
      CLAUDE_CODE_ENABLE_TELEMETRY: "1",
      OTEL_METRICS_EXPORTER: "otlp",
      OTEL_EXPORTER_OTLP_ENDPOINT: origin,
      OTEL_EXPORTER_OTLP_HEADERS: "Authorization=Bearer <your-ingest-token>",
    },
  },
  null,
  2,
);
</script>

<template>
  <v-card class="pa-6 mt-4" data-testid="telemetry-setup">
    <div class="text-h6 font-serif mb-1">Waiting for the first data…</div>
    <p class="text-body-2 text-medium-emphasis mb-4">
      This dashboard reads Claude Code's OpenTelemetry metrics. Point Claude Code at it and run a session; the dashboard appears within a minute of the
      first export. Use one of the tokens from <code>OTEL_INGEST_TOKENS</code>.
    </p>
    <div class="text-subtitle-2 mb-1">One person: add to your shell profile</div>
    <pre class="setup-code mb-4">{{ env }}</pre>
    <div class="text-subtitle-2 mb-1">A team: in Claude Code's managed settings</div>
    <pre class="setup-code mb-4">{{ managed }}</pre>
    <p class="text-caption text-medium-emphasis">
      Optional: tag each person's data with a department, e.g. <code>OTEL_RESOURCE_ATTRIBUTES="department=Platform"</code>. Prompts and code are never sent or
      stored, only counts, tokens and estimated cost.
    </p>
  </v-card>
</template>

<style scoped>
.setup-code {
  background: rgba(var(--v-theme-on-surface), 0.05);
  border-radius: 6px;
  padding: 12px;
  font-size: 12px;
  overflow-x: auto;
}
</style>
