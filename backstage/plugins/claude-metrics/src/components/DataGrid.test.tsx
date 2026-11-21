import { renderInTestApp } from '@backstage/frontend-test-utils';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { DataGrid, ServerGrid, type PageRequest } from './DataGrid';

type Row = { name: string; n: number };
const columns = [
  { key: 'name', title: 'Name', value: (r: Row) => r.name },
  { key: 'n', title: 'Count', value: (r: Row) => r.n, numeric: true },
];

describe('DataGrid', () => {
  it('sorts by the given column, descending by default', async () => {
    const items = [
      { name: 'a', n: 1 },
      { name: 'b', n: 30 },
      { name: 'c', n: 2 },
    ];
    await renderInTestApp(
      <DataGrid
        items={items}
        columns={columns}
        sortKey="n"
        rowKey={r => r.name}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows.map(r => r.textContent)).toEqual(['b30', 'c2', 'a1']);
  });

  it('formats numbers with thousands separators', async () => {
    await renderInTestApp(
      <DataGrid
        items={[{ name: 'a', n: 12345 }]}
        columns={columns}
        rowKey={r => r.name}
      />,
    );
    expect(screen.getByText('12,345')).toBeInTheDocument();
  });

  it('calls onRowClick with the row', async () => {
    const onRowClick = jest.fn();
    await renderInTestApp(
      <DataGrid
        items={[{ name: 'a', n: 1 }]}
        columns={columns}
        rowKey={r => r.name}
        onRowClick={onRowClick}
      />,
    );
    fireEvent.click(screen.getByText('a'));
    expect(onRowClick).toHaveBeenCalledWith({ name: 'a', n: 1 });
  });
});

describe('ServerGrid', () => {
  const rows = Array.from({ length: 25 }, (_, i) => ({ name: `u${i}`, n: i }));

  it('asks the server for the next page', async () => {
    const fetchPage = jest.fn(async (_: PageRequest) => ({ rows, total: 60 }));
    await renderInTestApp(
      <ServerGrid
        columns={columns}
        fetchPage={fetchPage}
        rowKey={r => r.name}
        initialSort="n"
        searchLabel="Search"
      />,
    );
    await waitFor(() =>
      expect(fetchPage).toHaveBeenCalledWith(
        expect.objectContaining({
          page: 1,
          pageSize: 25,
          sort: 'n',
          desc: true,
          q: '',
        }),
      ),
    );
    fireEvent.click(await screen.findByRole('button', { name: /next/i }));
    await waitFor(() =>
      expect(fetchPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ page: 2 }),
      ),
    );
  });

  it('sends the search text to the server', async () => {
    const fetchPage = jest.fn(async (_: PageRequest) => ({ rows, total: 60 }));
    await renderInTestApp(
      <ServerGrid
        columns={columns}
        fetchPage={fetchPage}
        rowKey={r => r.name}
        initialSort="n"
        searchLabel="Search"
      />,
    );
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'u1' },
    });
    await waitFor(() =>
      expect(fetchPage).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'u1', page: 1 }),
      ),
    );
  });
});
