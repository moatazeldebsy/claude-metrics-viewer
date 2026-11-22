import {
  CellText,
  SearchField,
  Table,
  useTable,
  type ColumnConfig,
  type SortDescriptor,
} from '@backstage/ui';
import { useCallback, useMemo } from 'react';
import { fmtInt, type GridColumn } from '@moatazeldebsy/claude-metrics-lib';
import { errorMessage } from './ApiState';

type Item<R> = { id: string; row: R };

const display = <R,>(c: GridColumn<R>, row: R) => {
  const v = c.value(row);
  if (c.format) return c.format(v as never);
  if (v === null || v === undefined) return '—';
  return typeof v === 'number' ? fmtInt(v) : v;
};

const toColumns = <R,>(
  columns: GridColumn<R>[],
  sortable: (c: GridColumn<R>) => boolean,
): ColumnConfig<Item<R>>[] =>
  columns.map((c, i) => ({
    id: c.key,
    label: c.title,
    isRowHeader: i === 0,
    isSortable: sortable(c),
    cell: item => (
      <CellText
        title={String(display(c, item.row))}
        style={
          c.numeric
            ? { textAlign: 'end', fontVariantNumeric: 'tabular-nums' }
            : undefined
        }
      />
    ),
  }));

const compare = (a: string | number | null, b: string | number | null) => {
  if (a === null) return -1;
  if (b === null) return 1;
  return typeof a === 'number' && typeof b === 'number'
    ? a - b
    : String(a).localeCompare(String(b));
};

/** Client-side sortable table. Each column gives a raw value (used for sorting) and an optional formatter. */
export function DataGrid<R>({
  items,
  columns,
  rowKey,
  sortKey,
  sortDesc = true,
  perPage,
  onRowClick,
}: {
  items: R[];
  columns: GridColumn<R>[];
  rowKey: (row: R) => string;
  sortKey?: string;
  sortDesc?: boolean;
  /** Rows per page; omit to show every row. */
  perPage?: number;
  onRowClick?: (row: R) => void;
}) {
  const data = useMemo(
    () => items.map(row => ({ id: rowKey(row), row })),
    [items, rowKey],
  );
  const sortFn = useCallback(
    (rows: Item<R>[], sort: SortDescriptor) => {
      const col = columns.find(c => c.key === sort.column);
      if (!col) return rows;
      const sign = sort.direction === 'descending' ? -1 : 1;
      return [...rows].sort(
        (a, b) => sign * compare(col.value(a.row), col.value(b.row)),
      );
    },
    [columns],
  );
  const { tableProps } = useTable({
    mode: 'complete',
    data,
    sortFn,
    initialSort: sortKey
      ? { column: sortKey, direction: sortDesc ? 'descending' : 'ascending' }
      : undefined,
    paginationOptions: {
      type: perPage ? 'page' : 'none',
      pageSize: perPage ?? (data.length || 1),
    },
  });
  return (
    <Table
      columnConfig={toColumns(columns, () => true)}
      {...tableProps}
      pagination={perPage ? tableProps.pagination : { type: 'none' }}
      rowConfig={
        onRowClick ? { onClick: item => onRowClick(item.row) } : undefined
      }
    />
  );
}

export interface PageRequest {
  page: number; // 1-based
  pageSize: number;
  sort: string;
  desc: boolean;
  q: string;
}

/** Table sorted, searched and paged on the server: works the same for 30 rows or 30,000. */
export function ServerGrid<R>({
  columns,
  fetchPage,
  rowKey,
  initialSort,
  searchLabel,
  unsortable = [],
}: {
  columns: GridColumn<R>[];
  fetchPage: (req: PageRequest) => Promise<{ rows: R[]; total: number }>;
  rowKey: (row: R) => string;
  /** Column key sorted descending on first load; omit for an unsortable table. */
  initialSort?: string;
  searchLabel: string;
  unsortable?: string[];
}) {
  const { tableProps, search } = useTable({
    mode: 'offset',
    initialSort: initialSort
      ? { column: initialSort, direction: 'descending' }
      : undefined,
    paginationOptions: { pageSize: 25, pageSizeOptions: [25, 50, 100] },
    getData: async ({ offset, pageSize, sort, search: q }) => {
      let res: { rows: R[]; total: number };
      try {
        res = await fetchPage({
          page: Math.floor(offset / pageSize) + 1,
          pageSize,
          sort: String(sort?.column ?? initialSort ?? ''),
          desc: (sort?.direction ?? 'descending') === 'descending',
          q,
        });
      } catch (e) {
        // The table shows error.message: use the backend's own text, not "Request failed with 400".
        throw new Error(errorMessage(e as Error));
      }
      return {
        data: res.rows.map(row => ({ id: rowKey(row), row })),
        totalCount: res.total,
      };
    },
  });
  return (
    <>
      <SearchField
        aria-label={searchLabel}
        placeholder={searchLabel}
        value={search.value}
        onChange={search.onChange}
        style={{ maxWidth: 320, marginBottom: 12 }}
      />
      <Table
        columnConfig={toColumns(
          columns,
          c => !!initialSort && !unsortable.includes(c.key),
        )}
        {...tableProps}
      />
    </>
  );
}
