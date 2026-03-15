/**
 * @jest-environment jsdom
 *
 * Snapshot tests for Dashboard component.
 * Dashboard is a pure client-side analytics component — it receives pre-fetched
 * `orders` as a prop and derives all metrics internally via useMemo.
 *
 * The useEffect that fetches ingredients/recipes via /api/admin is mocked at
 * the global fetch level so no real network requests are made.
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, act } from '@testing-library/react';
import Dashboard from '../../app/components/admin/Dashboard';

// ── Mocks ────────────────────────────────────────────────────────────────────

// Suppress noisy fetch calls from the ingredients/recipes useEffect
global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve({ ingredients: [], recipes: [] }),
}) as jest.Mock;

// Stable "today" so snapshot doesn't change every day
const FIXED_DATE = '2026-01-15';
jest.spyOn(Date.prototype, 'toLocaleDateString').mockImplementation(function (
  _locale,
  options,
) {
  if (options?.weekday) return 'qua';   // weekday short
  return FIXED_DATE;
});
jest.spyOn(Date.prototype, 'toLocaleString').mockReturnValue('10');  // hour

// lucide-react: lightweight stubs
jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    ({ size }: { size?: number }) =>
      <span data-icon={name} data-size={size} />;
  return new Proxy({}, { get: (_, key: string) => icon(key) });
});

// DateRangePicker: stub to avoid its own complexity
jest.mock('../../app/components/admin/DateRangePicker', () => ({
  __esModule: true,
  default: ({ value }: { value: { from: string; to: string } }) => (
    <div data-testid="date-range-picker" data-from={value?.from} data-to={value?.to} />
  ),
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

function makeOrder(overrides: Record<string, unknown> = {}) {
  return {
    id:               '1',
    order_number:     'A001',
    created_at:       `${FIXED_DATE}T12:00:00.000Z`,
    status:           'delivered',
    payment_status:   'paid',
    payment_method:   'pix',
    total:            49.9,
    subtotal:         42.9,
    delivery_fee:     7.0,
    discount:         0,
    customer_name:    'Cliente Teste',
    order_items:      [{ product_name: 'Pizza Margherita', quantity: 1, unit_price: 42.9, total_price: 42.9 }],
    ...overrides,
  };
}

const EMPTY_ORDERS: unknown[] = [];

const SAMPLE_ORDERS = [
  makeOrder({ id: '1', total: 49.9 }),
  makeOrder({ id: '2', total: 79.8, status: 'delivered', payment_method: 'card' }),
  makeOrder({ id: '3', total: 30.0, status: 'cancelled' }),
];

const noop = () => {};

// ── Snapshots ─────────────────────────────────────────────────────────────────

describe('Dashboard snapshots', () => {
  afterEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ ingredients: [], recipes: [] }),
    });
  });

  it('renders empty state with no orders', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <Dashboard orders={EMPTY_ORDERS} onRefresh={noop} loading={false} adminToken="test-token" />
      ));
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders correctly with sample orders', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <Dashboard orders={SAMPLE_ORDERS} onRefresh={noop} loading={false} adminToken="test-token" />
      ));
    });
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders loading state', async () => {
    let container!: HTMLElement;
    await act(async () => {
      ({ container } = render(
        <Dashboard orders={SAMPLE_ORDERS} onRefresh={noop} loading={true} adminToken="test-token" />
      ));
    });
    expect(container.firstChild).toMatchSnapshot();
  });
});
