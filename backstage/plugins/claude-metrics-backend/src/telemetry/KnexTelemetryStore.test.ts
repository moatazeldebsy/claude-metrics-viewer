import { TestDatabases } from '@backstage/backend-test-utils';
import type { TelemetryBatch } from '@internal/claude-metrics-lib/server';
import { KnexTelemetryStore } from './KnexTelemetryStore';

jest.setTimeout(60_000);

const DAY = '2026-11-22';
const row = (
  actor: string,
  counters: TelemetryBatch['rows'][number]['counters'],
  model = '',
  day = DAY,
): TelemetryBatch['rows'][number] => ({
  day,
  actorKind: 'user',
  actor,
  terminal: 'vscode',
  model,
  counters,
});
const user = (
  actor: string,
  department: string | null = null,
  lastSeen = DAY,
) => ({
  actorKind: 'user' as const,
  actor,
  department,
  lastSeen,
});

const databases = TestDatabases.create({ ids: ['SQLITE_3', 'POSTGRES_16'] });

describe.each(databases.eachSupportedId())('KnexTelemetryStore on %s', id => {
  const createStore = async () =>
    KnexTelemetryStore.create(await databases.init(id));

  it('sums rows per key and returns them per day', async () => {
    const store = await createStore();
    await store.add(
      {
        rows: [
          row('a@x.test', { sessions: 1, costUsd: 0.25 }),
          row('a@x.test', { tokensInput: 5 }, 'opus'),
        ],
        users: [user('a@x.test')],
      },
      '2026-11-22T10:00:00.000Z',
    );
    await store.add(
      { rows: [row('a@x.test', { sessions: 2, costUsd: 0.5 })], users: [] },
      '2026-11-22T11:00:00.000Z',
    );
    const rows = await store.records(DAY);
    expect(rows.find(r => r.model === '')!.counters.sessions).toBe(3);
    expect(rows.find(r => r.model === '')!.counters.costUsd).toBeCloseTo(0.75);
    expect(rows.find(r => r.model === 'opus')!.counters.tokensInput).toBe(5);
    expect(await store.records('2026-11-21')).toEqual([]);
    expect(await store.lastReceivedAt()).toBe('2026-11-22T11:00:00.000Z');
  });

  it('keeps the latest department and last-seen day per user', async () => {
    const store = await createStore();
    await store.add(
      { rows: [], users: [user('a@x.test', 'Data', '2026-11-20')] },
      't1',
    );
    await store.add(
      { rows: [], users: [user('a@x.test', 'Platform', '2026-11-22')] },
      't2',
    );
    await store.add(
      { rows: [], users: [user('a@x.test', 'Old', '2026-11-01')] },
      't3',
    );
    await store.add(
      { rows: [], users: [user('a@x.test', null, '2026-11-22')] },
      't4',
    );
    expect(await store.users()).toEqual([
      user('a@x.test', 'Platform', '2026-11-22'),
    ]);
  });

  it('loses no increments under concurrent add calls', async () => {
    const store = await createStore();
    await Promise.all(
      Array.from({ length: 50 }, () =>
        store.add(
          {
            rows: [row('a@x.test', { sessions: 1 })],
            users: [user('a@x.test')],
          },
          't',
        ),
      ),
    );
    expect((await store.records(DAY))[0]!.counters.sessions).toBe(50);
  });

  it('prunes old rows and users', async () => {
    const store = await createStore();
    await store.add(
      {
        rows: [
          row('old@x.test', { sessions: 1 }, '', '2025-01-01'),
          row('new@x.test', { sessions: 1 }),
        ],
        users: [user('old@x.test', null, '2025-01-01'), user('new@x.test')],
      },
      't',
    );
    await store.prune('2026-01-01');
    expect(await store.records('2025-01-01')).toEqual([]);
    expect((await store.users()).map(u => u.actor)).toEqual(['new@x.test']);
  });
  it('does not deadlock when concurrent batches touch the same rows in opposite order', async () => {
    const store = await createStore();
    const a = row('a@x.test', { sessions: 1 }, 'opus');
    const b = row('a@x.test', { sessions: 1 }, 'sonnet');
    await Promise.all(
      Array.from({ length: 40 }, (_, i) =>
        store.add(
          { rows: i % 2 ? [a, b] : [b, a], users: [user('a@x.test')] },
          't',
        ),
      ),
    );
    const rows = await store.records(DAY);
    expect(rows.map(r => r.counters.sessions)).toEqual(
      [20 + 20, 20 + 20].map(() => 40),
    );
  });

  it('keeps the newest last-seen day and department when old and new batches race', async () => {
    const store = await createStore();
    for (let round = 0; round < 20; round++) {
      const actor = `u${round}@x.test`;
      // The newer batch starts first, so a read-then-write upsert lets the older one overwrite it.
      await Promise.all([
        store.add({ rows: [], users: [user(actor, 'New', '2026-11-22')] }, 't'),
        ...Array.from({ length: 5 }, () =>
          store.add(
            { rows: [], users: [user(actor, 'Old', '2026-11-01')] },
            't',
          ),
        ),
      ]);
    }
    const users = await store.users();
    expect(users).toHaveLength(20);
    expect(
      users.filter(u => u.department !== 'New' || u.lastSeen !== '2026-11-22'),
    ).toEqual([]);
  });
});
