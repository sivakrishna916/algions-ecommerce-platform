import { describe, expect, test, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './RouteGuards';

vi.mock('../context/AuthContext', () => ({ useAuth: vi.fn() }));
import { useAuth } from '../context/AuthContext';

const renderAt = (path, role) => render(
  <MemoryRouter initialEntries={[path]}>
    <Routes>
      <Route path="/login" element={<p>login page</p>} />
      <Route path="/" element={<p>home page</p>} />
      <Route path="/admin" element={<p>admin home</p>} />
      <Route element={<RequireAuth role={role} />}><Route path="/secret" element={<p>secret content</p>} /></Route>
    </Routes>
  </MemoryRouter>,
);

describe('RequireAuth (UX guard; the server enforces the real rules)', () => {
  test('anonymous users are sent to login', () => {
    useAuth.mockReturnValue({ user: null, loading: false });
    renderAt('/secret', 'customer');
    expect(screen.getByText('login page')).toBeInTheDocument();
  });
  test('shows a loader while the session is being verified (no flash of login)', () => {
    useAuth.mockReturnValue({ user: null, loading: true });
    renderAt('/secret', 'customer');
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('login page')).not.toBeInTheDocument();
  });
  test('a customer is redirected away from admin-only routes', () => {
    useAuth.mockReturnValue({ user: { role: 'customer' }, loading: false });
    renderAt('/secret', 'admin');
    expect(screen.getByText('home page')).toBeInTheDocument();
  });
  test('an admin is redirected away from customer-only routes to /admin', () => {
    useAuth.mockReturnValue({ user: { role: 'admin' }, loading: false });
    renderAt('/secret', 'customer');
    expect(screen.getByText('admin home')).toBeInTheDocument();
  });
  test('the right role gets through', () => {
    useAuth.mockReturnValue({ user: { role: 'customer' }, loading: false });
    renderAt('/secret', 'customer');
    expect(screen.getByText('secret content')).toBeInTheDocument();
  });
});
