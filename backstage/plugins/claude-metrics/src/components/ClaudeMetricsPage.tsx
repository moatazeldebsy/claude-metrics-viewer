import {
  Alert,
  Container,
  Flex,
  Header,
  Skeleton,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@backstage/ui';
import { useApi } from '@backstage/frontend-plugin-api';
import { claudeMetricsReadPermission } from '@internal/backstage-plugin-claude-metrics-common';
import { usePermission } from '@backstage/plugin-permission-react';
import { useEffect } from 'react';
import useAsyncRetry from 'react-use/esm/useAsyncRetry';
import { claudeMetricsApiRef } from '../api';
import { useFilters } from '../hooks/useFilters';
import { MetaContext, type Meta } from '../hooks/useMeta';
import { TABS } from '../tabs';
import { FilterBar } from './FilterBar';
import { TelemetrySetup } from './TelemetrySetup';

const SOURCE_LABEL: Record<Meta['dataSource'], string> = {
  mock: 'mock',
  anthropic: 'anthropic',
  otel: 'OpenTelemetry',
};

const Tabbed = ({ meta }: { meta?: Meta }) => {
  const f = useFilters();
  const tabs = TABS.filter(
    t => t.id !== 'api' || (meta?.capabilities?.rawUpstream ?? true),
  );
  const active = tabs.find(t => t.id === f.tab) ?? tabs[0];

  return (
    <Flex direction="column" gap="4">
      <FilterBar
        departments={meta?.departments ?? []}
        holidayCountry={meta?.holidayCountry}
      />
      <Tabs
        selectedKey={active.id}
        onSelectionChange={key =>
          f.set({ tab: key === 'overview' ? null : String(key) })
        }
      >
        <TabList aria-label="Dashboard sections">
          {tabs.map(t => (
            <Tab key={t.id} id={t.id}>
              {t.label}
            </Tab>
          ))}
        </TabList>
        {tabs.map(t => (
          <TabPanel key={t.id} id={t.id}>
            {t.id === active.id && <t.Component />}
          </TabPanel>
        ))}
      </Tabs>
    </Flex>
  );
};

const Dashboard = () => {
  const api = useApi(claudeMetricsApiRef);
  // Metadata doesn't depend on the filters (as in the Nuxt app): load it once, without them.
  const { value: meta, retry } = useAsyncRetry(
    () => api.get<Meta>('meta', {}),
    [api],
  );
  // OpenTelemetry mode before any data: show setup instructions and check again every 10 s.
  const waiting =
    meta?.dataSource === 'otel' && meta.telemetry?.lastReceivedAt === null;
  useEffect(() => {
    if (!waiting) return undefined;
    const id = setInterval(retry, 10_000);
    return () => clearInterval(id);
  }, [waiting, retry]);

  return (
    <MetaContext.Provider value={meta}>
      <Header
        title="Adoption & cost"
        description="Claude Code adoption and Claude API usage & cost"
        tags={
          meta
            ? [{ label: `Data source: ${SOURCE_LABEL[meta.dataSource]}` }]
            : undefined
        }
      />
      <Container>
        {waiting ? <TelemetrySetup /> : <Tabbed meta={meta} />}
      </Container>
    </MetaContext.Provider>
  );
};

/**
 * The page is gated on claude-metrics.dashboard.read: the backend enforces it on every route,
 * and checking here too avoids loading the dashboard only to show 403 errors.
 */
export const ClaudeMetricsPage = () => {
  const { loading, allowed } = usePermission({
    permission: claudeMetricsReadPermission,
  });
  if (loading) {
    return (
      <Container>
        <Skeleton width="100%" height={240} />
      </Container>
    );
  }
  if (!allowed) {
    return (
      <>
        <Header title="Claude Metrics" />
        <Container>
          <Alert
            status="info"
            icon
            title="You don't have access to Claude Metrics"
            description="It shows per-user Claude Code activity and cost for the whole organization, so access is limited by your Backstage permission policy. Ask your Backstage admins if you need it."
          />
        </Container>
      </>
    );
  }
  return <Dashboard />;
};
