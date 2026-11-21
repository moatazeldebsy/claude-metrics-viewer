import { useApi } from '@backstage/frontend-plugin-api';
import { Combobox } from '@backstage/ui';
import { useEffect, useState } from 'react';
import { claudeMetricsApiRef } from '../api';
import { useDebounced } from '../hooks/useDebounced';
import type { UserOption } from '@internal/claude-metrics-lib';

/** Typeahead user filter: the server returns at most 20 matches per search, never the full member list. */
export function UserPicker({
  value,
  query,
  onChange,
}: {
  value: string | null;
  query: Record<string, string>;
  onChange: (user: string | null) => void;
}) {
  const api = useApi(claudeMetricsApiRef);
  const [input, setInput] = useState(value ?? '');
  const [options, setOptions] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const text = useDebounced(input).trim();
  const { user: _ignored, ...filters } = query;
  const filterKey = JSON.stringify(filters);

  useEffect(() => {
    if (!text || text === value) return undefined;
    let live = true;
    setLoading(true);
    api
      .get<{ options: UserOption[] }>('user-search', {
        ...JSON.parse(filterKey),
        q: text,
      })
      .then(res => live && setOptions(res.options))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [api, text, value, filterKey]);

  // Keep the selected user listed so the field can show it before any search.
  const listed =
    value && !options.some(o => o.value === value)
      ? [{ value, label: value, department: null }, ...options]
      : options;

  return (
    <Combobox
      label="User"
      placeholder="Search name or email…"
      style={{ minWidth: 280 }}
      options={listed.map(o => ({
        id: o.value,
        label: o.label,
        description: o.department ?? undefined,
      }))}
      search={{
        mode: 'client',
        inputValue: input,
        // Both the text and the selection are controlled, so clearing the text has to clear
        // the filter here (the combobox only does it for uncontrolled state).
        onInputChange: next => {
          setInput(next);
          if (next === '' && value) onChange(null);
        },
        filter: () => true,
      }}
      loading={loading ? { state: 'loading' } : undefined}
      selectedKey={value}
      onSelectionChange={key => {
        const user = key === null ? null : String(key);
        if (user) setInput(listed.find(o => o.value === user)?.label ?? user);
        onChange(user);
      }}
    />
  );
}
