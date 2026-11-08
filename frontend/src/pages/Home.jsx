import { Link } from 'react-router-dom';
import { catalogApi } from '../api/services';
import useFetch from '../utils/useFetch';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
import { ErrorState } from '../components/ui';

const ICONS = { Electronics: '🎧', Fashion: '👕', 'Home & Kitchen': '🏠', Books: '📚', 'Sports & Fitness': '🏋️' };

export default function Home() {
  const cats = useFetch(() => catalogApi.categories(), []);
  const popular = useFetch(() => catalogApi.products({ sort: 'popular', limit: 8 }), []);
  return (
    <>
      <section className="bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-500 text-white">
        <div className="container-page grid items-center gap-8 py-14 md:grid-cols-2 md:py-20">
          <div>
            <p className="mb-3 inline-block rounded-full bg-white/15 px-3 py-1 text-xs font-semibold tracking-wide">FREE SHIPPING ON ORDERS ABOVE ₹999</p>
            <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">Everything you need,<br />delivered with care.</h1>
            <p className="mt-4 max-w-lg text-brand-100">Browse electronics, fashion, home essentials, books and fitness gear. Use code <b>WELCOME10</b> for 10% off your first big order.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/products" className="btn bg-white text-brand-700 hover:bg-brand-50">Shop now</Link>
              <Link to="/products?sort=popular" className="btn border border-white/40 text-white hover:bg-white/10">Best sellers</Link>
            </div>
          </div>
          <div className="hidden justify-center md:flex" aria-hidden="true">
            <div className="grid grid-cols-2 gap-4">
              {['/products/nova-x-smartphone.svg', '/products/stride-running-shoes.svg', '/products/orbit-smart-watch.svg', '/products/urban-commuter-backpack.svg'].map((s, i) => (
                <img key={s} src={s} alt="" className={`h-40 w-40 rounded-2xl bg-white/10 object-cover shadow-lift ${i % 2 ? 'translate-y-4' : ''}`} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-page py-12">
        <h2 className="text-xl font-bold">Shop by category</h2>
        {cats.error ? <ErrorState error={cats.error} onRetry={cats.reload} /> : (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {cats.loading ? Array.from({ length: 5 }, (_, i) => <div key={i} className="skeleton h-24" />) : cats.data.categories.map((c) => (
              <Link key={c._id} to={`/products?category=${c.slug}`} className="card flex flex-col items-center gap-2 p-5 text-center transition hover:-translate-y-0.5 hover:shadow-lift">
                <span className="text-3xl" aria-hidden="true">{ICONS[c.name] || '🛍️'}</span>
                <span className="text-sm font-semibold">{c.name}</span>
                <span className="text-xs text-ink-500">{c.productCount} products</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="container-page pb-4">
        <div className="mb-4 flex items-end justify-between"><h2 className="text-xl font-bold">Popular right now</h2><Link to="/products?sort=popular" className="text-sm font-semibold text-brand-700">View all →</Link></div>
        {popular.error ? <ErrorState error={popular.error} onRetry={popular.reload} /> : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
            {popular.loading ? Array.from({ length: 8 }, (_, i) => <ProductCardSkeleton key={i} />) : popular.data.products.map((p) => <ProductCard key={p._id} product={p} />)}
          </div>
        )}
      </section>

      <section className="container-page py-10">
        <div className="grid gap-4 rounded-2xl bg-white p-6 shadow-card sm:grid-cols-3">
          {[['🚚', 'Fast delivery', 'Track every step from placed to delivered'], ['🔒', 'Safe checkout', 'Stock re-checked and duplicates prevented'], ['↩️', 'Easy cancellation', 'Cancel before packing for an instant refund']].map(([i, t, d]) => (
            <div key={t} className="flex items-start gap-3"><span className="text-2xl" aria-hidden="true">{i}</span><div><h3 className="font-semibold">{t}</h3><p className="text-sm text-ink-500">{d}</p></div></div>
          ))}
        </div>
      </section>
    </>
  );
}
