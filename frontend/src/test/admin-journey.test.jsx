/** Admin UI → real API → real MongoDB. Skipped unless E2E_API_URL is set (see README). */
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import App from '../App';
import { AuthProvider } from '../context/AuthContext';
import { CartProvider } from '../context/CartContext';
import { ToastProvider } from '../context/ToastContext';
import { http, tokenStore } from '../api/client';

const E2E = process.env.E2E_API_URL;
const wait = { timeout: 8000 };
const stamp = Date.now();
const mount = (path) => render(<MemoryRouter initialEntries={[path]}><ToastProvider><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></ToastProvider></MemoryRouter>);

describe.skipIf(!E2E)('admin journey through the real UI', () => {
  beforeAll(() => { http.defaults.baseURL = E2E; http.defaults.adapter = 'fetch'; window.scrollTo = () => {}; tokenStore.clear(); });
  afterEach(cleanup);

  test('a customer who opens /admin is turned away (and the API would refuse anyway)', async () => {
    const user = userEvent.setup();
    mount('/login');
    await user.click(screen.getByRole('button', { name: /fill customer login/i }));
    await user.click(screen.getByRole('button', { name: /^log in$/i }));
    await screen.findByText(/shop by category/i, {}, wait);
    cleanup();
    mount('/admin');
    await screen.findByText(/shop by category/i, {}, wait); // redirected to the storefront
    expect(screen.queryByText(/admin console/i)).not.toBeInTheDocument();
    tokenStore.clear();
  }, 30000);

  test('admin logs in, sees KPIs, fulfils an order, creates a product, adjusts stock, reconciliation balances', async () => {
    const user = userEvent.setup();
    mount('/login');
    await user.click(screen.getByRole('button', { name: /fill admin login/i }));
    await user.click(screen.getByRole('button', { name: /^log in$/i }));

    // Dashboard
    await screen.findByRole('heading', { name: /^dashboard$/i }, wait);
    expect(await screen.findByText(/total revenue/i)).toBeInTheDocument();
    expect(screen.getByText(/low stock/i, { selector: 'h2' })).toBeInTheDocument();

    // Orders: filter PAID, open one, mark as packed
    await user.click(screen.getByRole('link', { name: /^orders$/i }));
    await screen.findByRole('heading', { name: /^orders$/i }, wait);
    await user.selectOptions(screen.getByLabelText(/^status$/i), 'PAID');
    const openBtns = await screen.findAllByRole('button', { name: /open order/i }, wait);
    await user.click(openBtns[0]);
    const dialog = await screen.findByRole('dialog', {}, wait);
    await user.click(await within(dialog).findByRole('button', { name: /mark as packed/i }, wait));
    await screen.findByText(/order updated to packed/i, {}, wait);
    await within(dialog).findByRole('button', { name: /mark as shipped/i }, wait); // next step now offered
    await user.click(within(dialog).getByRole('button', { name: /close dialog/i }));

    // Products: create
    await user.click(screen.getByRole('link', { name: /products & stock/i }));
    await screen.findByRole('heading', { name: /products & inventory/i }, wait);
    await waitFor(() => expect(screen.getByRole('button', { name: /new product/i })).toBeEnabled(), wait);
    await user.click(screen.getByRole('button', { name: /new product/i }));
    const form = await screen.findByRole('dialog', {}, wait);
    await user.click(within(form).getByRole('button', { name: /create product/i }));
    expect((await within(form).findAllByText(/choose a category|enter a product name|sku required/i)).length).toBeGreaterThan(0); // validation
    await user.type(within(form).getByLabelText(/^name/i), `UI Test Gadget ${stamp}`);
    await user.selectOptions(within(form).getByLabelText(/^category/i), 'Books');
    await user.type(within(form).getByLabelText(/^sku/i), `UIT-${stamp}`);
    await user.type(within(form).getByLabelText(/^label/i), 'Standard');
    await user.type(within(form).getByLabelText(/^price/i), '499.50');
    await user.type(within(form).getByLabelText(/opening stock/i), '3');
    await user.click(within(form).getByRole('button', { name: /create product/i }));
    await screen.findByText(/product created/i, {}, wait);

    // Find it and adjust stock: negative adjustment beyond stock must be refused, a restock accepted
    await user.type(screen.getByLabelText(/search name, brand or sku/i), `UIT-${stamp}{Enter}`);
    const adjust = await screen.findByRole('button', { name: /adjust stock/i }, wait);
    await user.click(adjust);
    const sd = await screen.findByRole('dialog', {}, wait);
    await user.type(within(sd).getByLabelText(/^change/i), '-10');
    await user.click(within(sd).getByRole('button', { name: /apply change/i }));
    expect(await within(sd).findByRole('alert', {}, wait)).toHaveTextContent(/would make stock negative/i); // the server's refusal, not the static hint
    await user.clear(within(sd).getByLabelText(/^change/i));
    await user.type(within(sd).getByLabelText(/^change/i), '7');
    await user.click(within(sd).getByRole('button', { name: /apply change/i }));
    await screen.findByText(/stock updated for UIT-/i, {}, wait);
    await waitFor(() => expect(screen.getByRole('row', { name: new RegExp(`UI Test Gadget ${stamp}`) })).toHaveTextContent(/10/), wait); // 3 + 7

    // Reports: everything reconciles
    await user.click(screen.getByRole('link', { name: /^reports$/i }));
    await screen.findByText(/everything reconciles/i, {}, wait);
    expect(screen.queryByText(/mismatch detected/i)).not.toBeInTheDocument();

    // Audit log shows what we just did
    await user.click(screen.getByRole('link', { name: /audit log/i }));
    await screen.findByText(new RegExp(`stock \\+7 for UIT-${stamp}`, 'i'), {}, wait); // this run's own entry
    expect(screen.getAllByText('inventory.adjusted').length).toBeGreaterThan(0);
  }, 90000);
});
