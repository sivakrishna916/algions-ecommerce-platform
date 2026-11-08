/**
 * UI → real API → real MongoDB. Skipped unless E2E_API_URL points at a running backend with seeded demo data
 * (see README "Running the UI journey test"). It drives the actual React app through the DOM like a user.
 */
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
const email = `journey_${Date.now()}@test.dev`;

const mount = (path = '/') => render(
  <MemoryRouter initialEntries={[path]}>
    <ToastProvider><AuthProvider><CartProvider><App /></CartProvider></AuthProvider></ToastProvider>
  </MemoryRouter>,
);
const wait = { timeout: 8000 };

describe.skipIf(!E2E)('customer journey through the real UI', () => {
  beforeAll(() => { http.defaults.baseURL = E2E; http.defaults.adapter = 'fetch'; window.scrollTo = () => {}; tokenStore.clear(); });
  afterEach(cleanup);

  test('register → search → add to cart → add address → pay → confirmation', async () => {
    const user = userEvent.setup();
    mount('/register');
    await user.type(screen.getByLabelText(/full name/i), 'Journey Tester');
    await user.type(screen.getByLabelText(/^email/i), email);
    await user.type(screen.getByLabelText(/^password/i), 'Journey@1234');
    await user.click(screen.getByRole('button', { name: /create account/i }));

    // Logged in and on the home page
    await screen.findByText(/shop by category/i, {}, wait);

    // Search
    await user.type(screen.getByRole('searchbox', { name: /search products/i }), 'yoga{Enter}');
    const card = await screen.findByRole('link', { name: /pro yoga mat/i }, wait);
    await user.click(card);

    // Product page → add to cart
    await screen.findByRole('heading', { name: /pro yoga mat/i }, wait);
    await user.click(screen.getByRole('button', { name: /add to cart/i }));
    await screen.findByText(/added 1 × pro yoga mat/i, {}, wait);

    // Cart
    await user.click(screen.getByRole('link', { name: /cart, 1 item/i }));
    await screen.findByRole('heading', { name: /shopping cart/i }, wait);
    expect(screen.getByText(/GST \(18%\)/)).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: /proceed to checkout/i }));

    // Checkout: first-time customer must add an address (server rejects checkout without one)
    await screen.findByText(/no saved addresses/i, {}, wait);
    await user.click(screen.getByRole('button', { name: /save and use this address/i }));
    expect((await screen.findAllByText(/enter/i)).length).toBeGreaterThan(0); // client-side validation messages shown
    await user.type(screen.getByLabelText(/full name/i), 'Journey Tester');
    await user.type(screen.getByLabelText(/^phone/i), '9876543210');
    await user.type(screen.getByLabelText(/postal code/i), '560001');
    await user.type(screen.getByLabelText(/address line 1/i), '1 Test Street');
    await user.type(screen.getByLabelText(/^city/i), 'Bengaluru');
    await user.type(screen.getByLabelText(/^state/i), 'Karnataka');
    await user.click(screen.getByRole('button', { name: /save and use this address/i }));
    await screen.findByRole('radio', { name: /journey tester/i }, wait);

    await user.click(screen.getByRole('button', { name: /pay & place order/i }));
    await screen.findByText(/your order is confirmed/i, {}, wait);
    expect(screen.getByText(/ALG-\d{8}-[A-Z2-9]{6}/, { selector: 'b' })).toBeInTheDocument();
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);
  }, 60000);

  test('declined card keeps the order unpaid; retrying with a good card pays it; order history shows it', async () => {
    const user = userEvent.setup();
    mount('/products?q=bottle');
    await user.click(await screen.findByRole('link', { name: /insulated steel bottle/i }, wait));
    const addBtn = await screen.findByRole('button', { name: /add to cart/i }, wait);
    await waitFor(() => expect(addBtn).toBeEnabled(), wait); // enabled once the saved session has been verified
    await user.click(addBtn);
    await screen.findByText(/added 1 ×/i, {}, wait);
    await user.click(screen.getByRole('link', { name: /cart, 1 item/i }));
    await user.click(await screen.findByRole('link', { name: /proceed to checkout/i }, wait));
    await screen.findByRole('radio', { name: /journey tester/i }, wait);

    await user.click(screen.getByRole('button', { name: 'Declined' }));
    await user.click(screen.getByRole('button', { name: /pay & place order/i }));
    await screen.findByText(/saved but not paid yet/i, {}, wait);
    expect(screen.getAllByText(/card was declined/i).length).toBeGreaterThan(0); // shown in the banner and the toast

    // retry payment from the order page with the success card
    const pay = await screen.findByRole('region', { name: /complete payment/i }, wait);
    await user.click(within(pay).getByRole('button', { name: 'Success' }));
    await user.click(within(pay).getByRole('button', { name: /^pay ₹/i }));
    await waitFor(() => expect(screen.queryByRole('region', { name: /complete payment/i })).not.toBeInTheDocument(), wait);
    expect(screen.getAllByText('Paid').length).toBeGreaterThan(0);

    // order history
    await user.click(screen.getByRole('link', { name: /all orders/i }));
    await waitFor(() => expect(screen.getAllByRole('link', { name: /ALG-/ })).toHaveLength(2), wait);
  }, 60000);

  test('a logged-out visitor is sent to login when opening the cart', async () => {
    tokenStore.clear();
    mount('/cart');
    await screen.findByRole('heading', { name: /welcome back/i }, wait);
  });
});
