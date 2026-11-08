import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { catalogApi } from '../api/services';
import useFetch from '../utils/useFetch';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useToast } from '../context/ToastContext';
import ProductImage from '../components/ProductImage';
import { Alert, ErrorState, Spinner } from '../components/ui';
import { discountPercent, formatMoney } from '../utils/format';

export default function ProductDetail() {
  const { slug } = useParams();
  const { data, loading, error, reload } = useFetch(() => catalogApi.product(slug), [slug]);
  const { user, isAdmin, loading: authLoading } = useAuth();
  const { add, cart } = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [sku, setSku] = useState(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => { if (data) { const first = data.product.variants.find((v) => v.stock > 0) || data.product.variants[0]; setSku(first.sku); setQty(1); setMsg(''); } }, [data]);

  if (loading) return <Spinner label="Loading product…" className="min-h-[50vh]" />;
  if (error) return <div className="container-page py-12">{error.status === 404 ? <ErrorState title="Product not found" error={{ message: 'This product does not exist or is no longer available.' }} /> : <ErrorState error={error} onRetry={reload} />}<div className="mt-4 text-center"><Link to="/products" className="btn-secondary">Back to shop</Link></div></div>;

  const p = data.product;
  const v = p.variants.find((x) => x.sku === sku) || p.variants[0];
  const inCart = cart.items.find((i) => i.product === p._id && i.sku === v.sku)?.quantity || 0;
  const maxQty = Math.max(0, Math.min(10, v.stock) - inCart);
  const off = discountPercent(v.price, v.mrp);

  const addToCart = async () => {
    if (!user) return navigate('/login', { state: { from: location.pathname } });
    setBusy(true); setMsg('');
    try { await add(p._id, v.sku, qty); toast.success(`Added ${qty} × ${p.name} to your cart`); } catch (e) { setMsg(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="container-page py-8">
      <nav aria-label="Breadcrumb" className="mb-5 text-sm text-ink-500">
        <Link to="/" className="hover:text-brand-700">Home</Link> / <Link to={`/products?category=${p.category.slug}`} className="hover:text-brand-700">{p.category.name}</Link> / <span className="text-ink-900">{p.name}</span>
      </nav>
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="card overflow-hidden"><ProductImage src={p.images[0]} alt={p.name} className="aspect-square w-full" /></div>
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-ink-500">{p.brand}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{p.name}</h1>
          <div className="mt-4 flex items-baseline gap-3">
            <span className="text-3xl font-extrabold">{formatMoney(v.price)}</span>
            {v.mrp > v.price && <><span className="text-lg text-ink-500 line-through">{formatMoney(v.mrp)}</span><span className="rounded-full bg-emerald-100 px-2 py-0.5 text-sm font-bold text-emerald-700">{off}% off</span></>}
          </div>
          <p className="mt-1 text-xs text-ink-500">Inclusive of price; 18% GST and shipping are calculated at checkout.</p>
          <p className="mt-5 leading-relaxed text-ink-700">{p.description}</p>

          <fieldset className="mt-6">
            <legend className="mb-2 text-sm font-semibold">Option</legend>
            <div className="flex flex-wrap gap-2">
              {p.variants.map((x) => (
                <label key={x.sku} className={`cursor-pointer rounded-lg border px-4 py-2 text-sm font-medium has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-brand-600 ${x.sku === v.sku ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white hover:bg-slate-50'} ${x.stock === 0 ? 'opacity-50' : ''}`}>
                  <input type="radio" name="variant" className="sr-only" checked={x.sku === v.sku} onChange={() => { setSku(x.sku); setQty(1); setMsg(''); }} />
                  {x.label}{x.stock === 0 && ' (sold out)'}
                </label>
              ))}
            </div>
          </fieldset>

          <p className={`mt-4 text-sm font-semibold ${v.stock === 0 ? 'text-rose-600' : v.stock <= 5 ? 'text-amber-600' : 'text-emerald-600'}`} aria-live="polite">
            {v.stock === 0 ? 'Out of stock' : v.stock <= 5 ? `Hurry — only ${v.stock} left` : 'In stock'}
          </p>

          {msg && <Alert className="mt-3">{msg}</Alert>}
          {isAdmin ? <Alert type="info" className="mt-5">Admin accounts browse only. Log in as a customer to shop.</Alert> : (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border border-slate-300" role="group" aria-label="Quantity">
                <button className="px-3 py-2.5 text-lg disabled:opacity-40" onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity">−</button>
                <span className="w-10 text-center text-sm font-semibold" aria-live="polite">{qty}</span>
                <button className="px-3 py-2.5 text-lg disabled:opacity-40" onClick={() => setQty((q) => Math.min(maxQty, q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity">+</button>
              </div>
              <button className="btn-primary flex-1 sm:flex-none sm:px-10" onClick={addToCart} disabled={busy || authLoading || v.stock === 0 || maxQty === 0}>
                {busy ? 'Adding…' : v.stock === 0 ? 'Sold out' : maxQty === 0 ? 'Max quantity in cart' : 'Add to cart'}
              </button>
              {inCart > 0 && <Link to="/cart" className="text-sm font-semibold text-brand-700">{inCart} in cart · View</Link>}
            </div>
          )}
          {p.tags.length > 0 && <div className="mt-6 flex flex-wrap gap-1.5">{p.tags.map((t) => <Link key={t} to={`/products?q=${t}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs text-ink-700 hover:bg-slate-200">#{t}</Link>)}</div>}
        </div>
      </div>
    </div>
  );
}
