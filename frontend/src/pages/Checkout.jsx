import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { authApi, orderApi } from '../api/services';
import { fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import { AddressForm, PaymentForm, emptyPayment, toPaymentPayload } from '../components/forms';
import { Alert, Spinner } from '../components/ui';
import { PriceSummary } from './Cart';
import { newIdempotencyKey } from '../utils/format';

export default function Checkout() {
  const { user, refresh: refreshUser } = useAuth();
  const { cart, loading, refresh: refreshCart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [addressId, setAddressId] = useState('');
  const [adding, setAdding] = useState(false);
  const [payment, setPayment] = useState(emptyPayment);
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [stockIssues, setStockIssues] = useState([]);
  const [busy, setBusy] = useState(false);
  // One key per checkout ATTEMPT. It is reused if the same attempt is retried (network error / timeout),
  // so the server can recognise the retry and return the original order instead of creating a second one.
  const keyRef = useRef(newIdempotencyKey());
  const submitting = useRef(false); // synchronous guard against double clicks
  const placed = useRef(false); // set once an order exists, so the empty-cart redirect below cannot fire

  const addresses = user.addresses || [];
  useEffect(() => { if (!addressId && addresses.length) setAddressId((addresses.find((a) => a.isDefault) || addresses[0])._id); }, [addresses, addressId]);

  if (loading && !cart.items.length) return <Spinner label="Preparing checkout…" className="min-h-[50vh]" />;
  if (placed.current) return <Spinner label="Opening your order…" className="min-h-[50vh]" />;
  if (!cart.items.length) return <Navigate to="/cart" replace />;

  const place = async () => {
    if (submitting.current) return;
    setError(''); setErrors({}); setStockIssues([]);
    if (!addressId) return setError('Please select or add a delivery address.');
    if (cart.hasIssues) return setError('Some items in your cart are unavailable. Please review your cart.');
    submitting.current = true; setBusy(true);
    try {
      const r = await orderApi.checkout({ addressId, payment: toPaymentPayload(payment) }, keyRef.current);
      placed.current = true;
      keyRef.current = newIdempotencyKey();
      if (!r.paymentSucceeded) toast.error(`Payment failed: ${r.payment?.failureReason || 'declined'}. Your order is saved — retry payment below.`);
      // Navigate BEFORE refreshing the cart: once the cart is empty this page would redirect to /cart.
      navigate(`/orders/${r.order._id}?placed=1`, { replace: true });
      refreshCart().catch(() => {});
    } catch (err) {
      const networkOrServer = err.status === 0 || err.status >= 500;
      if (!networkOrServer) keyRef.current = newIdempotencyKey(); // definitive answer → next click is a NEW attempt
      if (err.code === 'CHECKOUT_IN_PROGRESS') { setError('Your order is still being processed. Please wait a moment and press the button again — you will not be charged twice.'); }
      else if (err.code === 'INSUFFICIENT_STOCK' || err.code === 'ITEM_UNAVAILABLE') { setStockIssues(Array.isArray(err.details) ? err.details : []); setError(err.message); refreshCart().catch(() => {}); }
      else if (err.status === 400) { setErrors(fieldErrors(err)); setError('Please correct the highlighted payment details.'); }
      else setError(networkOrServer ? `${err.message} It is safe to try again — duplicate orders are prevented.` : err.message);
    } finally { submitting.current = false; setBusy(false); }
  };

  const addAddress = async (body) => { const r = await authApi.addAddress(body); await refreshUser(); setAddressId(r.address._id); setAdding(false); toast.success('Address added'); };

  return (
    <div className="container-page py-8">
      <h1 className="mb-6 text-2xl font-bold">Checkout</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="card p-5" aria-labelledby="addr-h">
            <div className="mb-4 flex items-center justify-between"><h2 id="addr-h" className="text-lg font-bold">1. Delivery address</h2>{!adding && addresses.length > 0 && <button className="btn-secondary btn-sm" onClick={() => setAdding(true)}>+ Add new</button>}</div>
            {adding || addresses.length === 0 ? (
              <>{addresses.length === 0 && <p className="mb-3 text-sm text-ink-500">You have no saved addresses yet. Add one to continue.</p>}<AddressForm onSubmit={addAddress} onCancel={addresses.length ? () => setAdding(false) : undefined} submitLabel="Save and use this address" /></>
            ) : (
              <div role="radiogroup" aria-label="Delivery address" className="grid gap-3 sm:grid-cols-2">
                {addresses.map((a) => (
                  <label key={a._id} className={`cursor-pointer rounded-xl border p-4 text-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-600 ${addressId === a._id ? 'border-brand-600 bg-brand-50' : 'border-slate-300 hover:bg-slate-50'}`}>
                    <input type="radio" name="address" className="sr-only" checked={addressId === a._id} onChange={() => setAddressId(a._id)} />
                    <div className="flex items-center justify-between"><span className="font-semibold">{a.fullName}</span><span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs">{a.label}{a.isDefault ? ' · Default' : ''}</span></div>
                    <p className="mt-1 text-ink-700">{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.postalCode}<br />📞 {a.phone}</p>
                  </label>
                ))}
              </div>
            )}
          </section>
          <section className="card p-5" aria-labelledby="pay-h">
            <h2 id="pay-h" className="sr-only">2. Payment</h2>
            <PaymentForm value={payment} onChange={setPayment} errors={errors} />
          </section>
        </div>

        <aside className="card h-fit space-y-4 p-5 lg:sticky lg:top-24" aria-label="Order summary">
          <h2 className="text-lg font-bold">Order summary</h2>
          <ul className="max-h-56 space-y-2 overflow-y-auto text-sm">{cart.items.map((i) => <li key={`${i.product}${i.sku}`} className="flex justify-between gap-3"><span className="truncate">{i.quantity} × {i.name} <span className="text-ink-500">({i.variantLabel})</span></span></li>)}</ul>
          <PriceSummary pricing={cart.pricing} couponCode={cart.couponCode} />
          {error && <Alert>{error}{stockIssues.length > 0 && <ul className="mt-2 list-disc pl-5">{stockIssues.map((s) => <li key={s.sku}>{s.name}{s.available !== undefined ? ` — requested ${s.requested}, available ${s.available}` : ''}</li>)}</ul>}{stockIssues.length > 0 && <Link to="/cart" className="mt-2 block font-semibold underline">Review cart</Link>}</Alert>}
          <button className="btn-primary w-full py-3 text-base" onClick={place} disabled={busy || addresses.length === 0}>{busy ? 'Placing order…' : `Pay & place order`}</button>
          <p className="text-center text-xs text-ink-500">Stock and prices are re-checked on the server when you place the order.</p>
        </aside>
      </div>
    </div>
  );
}
