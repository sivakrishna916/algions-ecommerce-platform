
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import ProductImage from '../components/ProductImage';
import { Alert, EmptyState, Spinner } from '../components/ui';
import { formatMoney } from '../utils/format';

export function PriceSummary({ pricing, couponCode }) {
  const row = (label, value, cls = '') => <div className={`flex justify-between text-sm ${cls}`}><dt className="text-ink-500">{label}</dt><dd className="font-medium">{value}</dd></div>;
  return (
    <dl className="space-y-2.5">
      {row('Subtotal', formatMoney(pricing.subtotal))}
      {pricing.discount > 0 && row(`Discount${couponCode ? ` (${couponCode})` : ''}`, `− ${formatMoney(pricing.discount)}`, 'text-emerald-700')}
      {row('GST (18%)', formatMoney(pricing.tax))}
      {row('Shipping', pricing.shipping === 0 ? 'FREE' : formatMoney(pricing.shipping))}
      <div className="flex justify-between border-t border-slate-200 pt-3 text-base"><dt className="font-semibold">Total payable</dt><dd className="text-xl font-extrabold">{formatMoney(pricing.total)}</dd></div>
    </dl>
  );
}

const ISSUE = { OUT_OF_STOCK: 'Out of stock — remove it to continue', INSUFFICIENT_STOCK: 'Not enough stock for this quantity', UNAVAILABLE: 'No longer available — remove it to continue' };

export default function Cart() {
  const { cart, loading, setQty, remove, applyCoupon, removeCoupon } = useCart();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [couponErr, setCouponErr] = useState('');
  const [busyKey, setBusyKey] = useState('');

  if (loading && !cart.items.length) return <Spinner label="Loading your cart…" className="min-h-[50vh]" />;
  if (!cart.items.length) return <div className="container-page py-12"><EmptyState icon="🛒" title="Your cart is empty" message="Looks like you haven't added anything yet." action={<Link to="/products" className="btn-primary">Start shopping</Link>} /></div>;

  const run = async (key, fn) => { setBusyKey(key); try { await fn(); } catch (e) { toast.error(e.message); } finally { setBusyKey(''); } };
  const submitCoupon = async (e) => { e.preventDefault(); setCouponErr(''); if (!code.trim()) return; try { await applyCoupon(code.trim()); setCode(''); toast.success('Coupon applied'); } catch (err) { setCouponErr(err.message); } };

  return (
    <div className="container-page py-8">
      <h1 className="mb-6 text-2xl font-bold">Shopping cart <span className="text-base font-normal text-ink-500">({cart.itemCount} item{cart.itemCount === 1 ? '' : 's'})</span></h1>
      {cart.hasIssues && <Alert type="warning" className="mb-4">Some items need attention before you can check out. Stock changes quickly — adjust the highlighted lines.</Alert>}
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <ul className="space-y-3">
          {cart.items.map((it) => {
            const key = `${it.product}:${it.sku}`;
            return (
              <li key={key} className={`card flex gap-4 p-4 ${it.issue ? 'border-amber-300 bg-amber-50/40' : ''}`}>
                <Link to={it.slug ? `/products/${it.slug}` : '#'} className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100"><ProductImage src={it.image} alt={it.name} className="h-full w-full" /></Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <div className="flex justify-between gap-3">
                    <div className="min-w-0"><h2 className="truncate text-sm font-semibold">{it.name}</h2><p className="text-xs text-ink-500">{it.variantLabel}</p></div>
                    <p className="font-bold">{formatMoney(it.lineTotal)}</p>
                  </div>
                  {it.issue && <p role="alert" className="mt-1 text-xs font-semibold text-amber-700">{ISSUE[it.issue]}{it.issue === 'INSUFFICIENT_STOCK' && ` (only ${it.stock} available)`}</p>}
                  <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-3">
                    <div className="flex items-center rounded-lg border border-slate-300" role="group" aria-label={`Quantity for ${it.name}`}>
                      <button className="px-2.5 py-1 disabled:opacity-40" aria-label="Decrease quantity" disabled={it.quantity <= 1 || busyKey === key} onClick={() => run(key, () => setQty(it.product, it.sku, it.quantity - 1))}>−</button>
                      <span className="w-8 text-center text-sm font-semibold">{it.quantity}</span>
                      <button className="px-2.5 py-1 disabled:opacity-40" aria-label="Increase quantity" disabled={it.quantity >= Math.min(10, it.stock) || busyKey === key} onClick={() => run(key, () => setQty(it.product, it.sku, it.quantity + 1))}>+</button>
                    </div>
                    <div className="flex w-full items-center justify-between gap-2 text-xs sm:w-auto sm:justify-end sm:gap-3 sm:text-sm">
                      <span className="text-ink-500">{formatMoney(it.unitPrice)} each</span>
                      <button className="font-semibold text-rose-600 hover:underline" disabled={busyKey === key} onClick={() => run(key, async () => { await remove(it.product, it.sku); toast.info('Item removed'); })}>Remove</button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>

        <aside className="card h-fit space-y-5 p-5 lg:sticky lg:top-24" aria-label="Order summary">
          <h2 className="text-lg font-bold">Order summary</h2>
          {cart.couponCode ? (
            <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-3 py-2 text-sm"><span>🏷️ <b>{cart.couponCode}</b> applied</span><button className="font-semibold text-rose-600" onClick={() => run('coupon', removeCoupon)}>Remove</button></div>
          ) : (
            <form onSubmit={submitCoupon}>
              <label htmlFor="coupon" className="mb-1 block text-sm font-medium">Have a coupon?</label>
              <div className="flex gap-2"><input id="coupon" className={`input ${couponErr ? 'input-error' : ''}`} placeholder="WELCOME10 or FLAT100" value={code} onChange={(e) => setCode(e.target.value)} aria-invalid={!!couponErr} aria-describedby={couponErr ? 'coupon-err' : undefined} /><button className="btn-secondary">Apply</button></div>
              {couponErr && <p id="coupon-err" role="alert" className="mt-1 text-xs font-medium text-rose-600">{couponErr}</p>}
            </form>
          )}
          {cart.couponError && <Alert type="warning">{cart.couponError}</Alert>}
          <PriceSummary pricing={cart.pricing} couponCode={cart.couponCode} />
          {cart.hasIssues ? <button className="btn-primary w-full" disabled>Fix cart issues to continue</button> : <Link to="/checkout" className="btn-primary w-full">Proceed to checkout</Link>}
          <Link to="/products" className="block text-center text-sm font-semibold text-brand-700">Continue shopping</Link>
        </aside>
      </div>
    </div>
  );
}
