import { discoveryApiRef, useApi } from '@backstage/frontend-plugin-api';
import { Card, CardBody, CardHeader, Text } from '@backstage/ui';
import useAsync from 'react-use/esm/useAsync';

const codeStyle = {
  background: 'var(--bui-bg-surface-2, rgba(127,127,127,0.08))',
  borderRadius: 6,
  padding: 12,
  fontSize: 12,
  overflowX: 'auto' as const,
};

/** Shown with dataSource otel until the first telemetry arrives: what to set on each machine. */
export const TelemetrySetup = () => {
  const discovery = useApi(discoveryApiRef);
  const { value: base } = useAsync(
    () => discovery.getBaseUrl('claude-metrics'),
    [discovery],
  );
  if (!base) return null;
  const endpoint = `${base}/otlp`;
  const vars: Record<string, string> = {
    CLAUDE_CODE_ENABLE_TELEMETRY: '1',
    OTEL_METRICS_EXPORTER: 'otlp',
    OTEL_EXPORTER_OTLP_ENDPOINT: endpoint,
    OTEL_EXPORTER_OTLP_HEADERS: 'Authorization=Bearer <your-ingest-token>',
  };
  const shell = Object.entries(vars)
    .map(([k, v]) =>
      k === 'OTEL_EXPORTER_OTLP_HEADERS'
        ? `export ${k}="${v}"`
        : `export ${k}=${v}`,
    )
    .join('\n');
  return (
    <Card data-testid="telemetry-setup">
      <CardHeader>
        <Text as="h3" variant="title-small" weight="bold">
          Waiting for the first data…
        </Text>
        <Text as="p" variant="body-medium" color="secondary">
          This dashboard reads Claude Code's OpenTelemetry metrics. Point Claude
          Code at Backstage and run a session; the dashboard appears within a
          minute of the first export. Use one of the tokens in
          claudeMetrics.otel.ingestTokens.
        </Text>
      </CardHeader>
      <CardBody>
        <Text as="p" variant="body-medium" weight="bold">
          One person: add to your shell profile
        </Text>
        <pre style={codeStyle}>{shell}</pre>
        <Text as="p" variant="body-medium" weight="bold">
          A team: in Claude Code's managed settings
        </Text>
        <pre style={codeStyle}>{JSON.stringify({ env: vars }, null, 2)}</pre>
        <Text as="p" variant="body-small" color="secondary">
          Optional: tag each person's data with a department, e.g.
          OTEL_RESOURCE_ATTRIBUTES="department=Platform". Prompts and code are
          never sent or stored, only counts, tokens and estimated cost.
        </Text>
      </CardBody>
    </Card>
  );
};
