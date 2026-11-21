import {
  Container,
  Flex,
  Header,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@backstage/ui';
import { useApi } from '@backstage/frontend-plugin-api';
import useAsync from 'react-use/esm/useAsync';
import { claudeMetricsApiRef } from '../api';
import { useFilters } from '../hooks/useFilters';
import { TABS } from '../tabs';
import { FilterBar } from './FilterBar';

interface Meta {
  dataSource: 'mock' | 'anthropic';
  holidayCountry: string;
  departments: string[];
}

export const ClaudeMetricsPage = () => {
  const f = useFilters();
  const api = useApi(claudeMetricsApiRef);
  // Metadata doesn't depend on the filters (as in the Nuxt app): load it once, without them.
  const { value: meta } = useAsync(() => api.get<Meta>('meta', {}), [api]);
  const active = TABS.find(t => t.id === f.tab) ?? TABS[0];

  return (
    <>
      <Header
        title="Adoption & cost"
        description="Claude Code adoption and Claude API usage & cost"
        tags={meta ? [{ label: `Data source: ${meta.dataSource}` }] : undefined}
      />
      <Container>
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
              {TABS.map(t => (
                <Tab key={t.id} id={t.id}>
                  {t.label}
                </Tab>
              ))}
            </TabList>
            {TABS.map(t => (
              <TabPanel key={t.id} id={t.id}>
                {t.id === active.id && <t.Component />}
              </TabPanel>
            ))}
          </Tabs>
        </Flex>
      </Container>
    </>
  );
};
