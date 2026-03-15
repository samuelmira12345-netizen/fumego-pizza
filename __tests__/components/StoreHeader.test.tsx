/**
 * @jest-environment jsdom
 *
 * Snapshot tests for StoreHeader component.
 * Uses jsdom environment (declared above) while the global jest config uses 'node'.
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render } from '@testing-library/react';
import StoreHeader from '../../app/components/home/StoreHeader';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// lucide-react icons rendered as simple spans to keep snapshots stable
jest.mock('lucide-react', () => {
  const icon = (name: string) =>
    ({ size, color }: { size?: number; color?: string }) =>
      <span data-testid={`icon-${name}`} data-size={size} data-color={color} />;
  return {
    ShoppingCart: icon('shopping-cart'),
    User:         icon('user'),
    Settings:     icon('settings'),
    Package:      icon('package'),
    LogOut:       icon('log-out'),
    Wallet:       icon('wallet'),
  };
});

// ── Fixtures ─────────────────────────────────────────────────────────────────

const noop = () => {};

const PROPS_LOGGED_OUT = {
  user:           null,
  cartCount:      0,
  showUserMenu:   false,
  setShowUserMenu: noop,
  logoUrl:        null,
  logoSize:       40,
  onOpenCart:     noop,
  onLogout:       noop,
};

const PROPS_LOGGED_IN = {
  ...PROPS_LOGGED_OUT,
  user: { id: 'u1', name: 'Maria', email: 'maria@example.com' },
  cartCount: 3,
  cashbackBalance: 12.5,
};

// ── Snapshots ─────────────────────────────────────────────────────────────────

describe('StoreHeader snapshots', () => {
  it('renders correctly when user is logged out and cart is empty', () => {
    const { container } = render(<StoreHeader {...PROPS_LOGGED_OUT} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders correctly when user is logged in with cart items', () => {
    const { container } = render(<StoreHeader {...PROPS_LOGGED_IN} />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders user menu when showUserMenu is true', () => {
    const { container } = render(
      <StoreHeader {...PROPS_LOGGED_IN} showUserMenu={true} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders logo when logoUrl is provided', () => {
    const { container } = render(
      <StoreHeader {...PROPS_LOGGED_OUT} logoUrl="https://example.com/logo.png" logoSize={60} />
    );
    expect(container.firstChild).toMatchSnapshot();
  });
});
