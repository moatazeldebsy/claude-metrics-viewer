import {
  Button,
  Card,
  CardBody,
  DateRangePicker,
  Flex,
  Select,
  Switch,
} from '@backstage/ui';
import { parseDay } from '../dates';
import { useFilters } from '../hooks/useFilters';
import { addDays } from '@internal/claude-metrics-lib';
import { UserPicker } from './UserPicker';

const ALL = '__all';

export function FilterBar({
  departments,
  holidayCountry,
}: {
  departments: string[];
  holidayCountry?: string;
}) {
  const f = useFilters();
  const start = parseDay(f.from);
  const end = parseDay(f.to);
  const preset = (days: number) =>
    f.set({ from: addDays(f.latest, -(days - 1)), to: f.latest });

  return (
    <Card data-testid="filters">
      <CardBody>
        <Flex align="end" gap="3" style={{ flexWrap: 'wrap' }}>
          <DateRangePicker
            label="Date range"
            value={start && end ? { start, end } : null}
            maxValue={parseDay(f.latest) ?? undefined}
            onChange={range =>
              range &&
              f.set({ from: range.start.toString(), to: range.end.toString() })
            }
          />
          <Flex gap="1">
            {[7, 28, 90].map(n => (
              <Button
                key={n}
                size="small"
                variant="secondary"
                onPress={() => preset(n)}
              >
                {`Last ${n} days`}
              </Button>
            ))}
          </Flex>
          <Switch
            label="Exclude weekends"
            isSelected={f.param('excludeWeekends') === 'true'}
            onChange={v => f.set({ excludeWeekends: v ? 'true' : null })}
          />
          <Switch
            label={
              holidayCountry
                ? `Exclude holidays (${holidayCountry})`
                : 'Exclude holidays'
            }
            isSelected={f.param('excludeHolidays') === 'true'}
            onChange={v => f.set({ excludeHolidays: v ? 'true' : null })}
          />
          <Select
            label="Department"
            style={{ minWidth: 200 }}
            options={[
              { id: ALL, label: 'All departments' },
              ...departments.map(d => ({ id: d, label: d })),
            ]}
            selectedKey={f.param('department') ?? ALL}
            onSelectionChange={key =>
              f.set({
                department: key === ALL || key === null ? null : String(key),
              })
            }
          />
          <UserPicker
            value={f.param('user')}
            query={f.query}
            onChange={user => f.set({ user })}
          />
        </Flex>
      </CardBody>
    </Card>
  );
}
