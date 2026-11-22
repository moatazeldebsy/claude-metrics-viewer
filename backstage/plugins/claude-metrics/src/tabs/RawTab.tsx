import { DatePicker, Flex, Select } from '@backstage/ui';
import { useState } from 'react';
import { ApiState } from '../components/ApiState';
import { ChartCard } from '../components/ChartCard';
import { useDashboard } from '../hooks/useDashboard';
import { parseDay } from '../dates';
import { useFilters } from '../hooks/useFilters';

type Source = 'claude_code' | 'cost';

export const RawTab = () => {
  const f = useFilters();
  const [day, setDay] = useState(f.to);
  const [source, setSource] = useState<Source>('claude_code');
  const state = useDashboard<unknown>('raw', {
    source,
    day,
    from: day,
    to: day,
  });
  return (
    <ChartCard
      title="Raw API response"
      subtitle="Untouched upstream rows for one day"
    >
      <Flex gap="3" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        <Select
          label="Endpoint"
          style={{ width: 280 }}
          options={[
            { id: 'claude_code', label: 'usage_report/claude_code' },
            { id: 'cost', label: 'analytics/cost' },
          ]}
          selectedKey={source}
          onSelectionChange={key => key && setSource(key as Source)}
        />
        <DatePicker
          label="Day"
          value={parseDay(day)}
          maxValue={parseDay(f.latest) ?? undefined}
          onChange={v => v && setDay(v.toString())}
        />
      </Flex>
      <ApiState state={state}>
        {data => (
          <pre
            data-testid="raw-json"
            style={{
              maxHeight: 600,
              overflow: 'auto',
              padding: 12,
              borderRadius: 4,
              fontSize: 12,
              background: 'var(--bui-bg-neutral-2, rgba(127,127,127,0.08))',
            }}
          >
            {JSON.stringify(data, null, 2)}
          </pre>
        )}
      </ApiState>
    </ChartCard>
  );
};
