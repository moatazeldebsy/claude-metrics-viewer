import {
  Container,
  Flex,
  Header,
  Tab,
  TabList,
  TabPanel,
  Tabs,
} from '@backstage/ui';
import { useDashboard } from '../hooks/useDashboard';
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
  const { value: meta } = useDashboard<Meta>('meta');
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
