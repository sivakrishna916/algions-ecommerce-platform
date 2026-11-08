import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { catalogApi } from '../api/services';
import useFetch from '../utils/useFetch';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
import { EmptyState, ErrorState, Pagination } from '../components/ui';
import { paiseToRupees, rupeesToPaise } from '../utils/format';

const SORTS = [['newest', 'Newest'], ['popular', 'Popularity'], ['price_asc', 'Price: low to high'], ['price_desc', 'Price: high to low']];

export default function Catalog() {
  const [params, setParams] = useSearchParams();
  const get = (k, d = '') => params.get(k) ?? d;
  const query = { q: get('q') || undefined, category: get('category') || undefined, minPrice: get('minPrice') || undefined, maxPrice: get('maxPrice') || undefined, inStock: get('inStock') || undefined, sort: get('sort', 'newest'), page: Number(get('page', 1)), limit: 12 };

  const cats = useFetch(() => catalogApi.categories(), []);
  const { data, loading, error, reload } = useFetch(() => catalogApi.products(query), [params.toString()]);
  const [price, setPrice] = useState({ min: '', max: '' });
  const [showFilters, setShowFilters] = useState(false);
  const [priceErr, setPriceErr] = useState('');

  useEffect(() => { setPrice({ min: get('minPrice') ? String(paiseToRupees(get('minPrice'))) : '', max: get('maxPrice') ? String(paiseToRupees(get('maxPrice'))) : '' }); /* eslint-disable-next-line */ }, [params.toString()]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v === undefined || v === '' || v === false ? next.delete(k) : next.set(k, String(v))));
    if (!('page' in patch)) next.delete('page'); // any filter change goes back to page 1
    setParams(next);
  };
  const applyPrice = (e) => {
    e.preventDefault();
    const min = price.min === '' ? undefined : rupeesToPaise(price.min);
    const max = price.max === '' ? undefined : rupeesToPaise(price.max);
    if ((min !== undefined && (Number.isNaN(min) || min < 0)) || (max !== undefined && (Number.isNaN(max) || max < 0))) return setPriceErr('Enter valid amounts');
    if (min !== undefined && max !== undefined && min > max) return setPriceErr('Minimum cannot exceed maximum');
    setPriceErr(''); return update({ minPrice: min, maxPrice: max });
  };
  const activeCat = get('category');
  const hasFilters = ['q', 'category', 'minPrice', 'maxPrice', 'inStock'].some((k) => params.get(k));

  const filters = (
    <div className="space-y-6">
      <div>
        <h2 className="mb-2 text-sm font-semibold">Category</h2>
        <ul className="space-y-1">
          <li><button onClick={() => update({ category: '' })} className={`w-full rounded-lg px-3 py-2 text-left text-sm ${!activeCat ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-slate-100'}`}>All categories</button></li>
          {cats.data?.categories.map((c) => (
            <li key={c._id}><button onClick={() => update({ category: c.slug })} aria-pressed={activeCat === c.slug} className={`flex w-full justify-between rounded-lg px-3 py-2 text-left text-sm ${activeCat === c.slug ? 'bg-brand-50 font-semibold text-brand-700' : 'hover:bg-slate-100'}`}><span>{c.name}</span><span className="text-ink-500">{c.productCount}</span></button></li>
          ))}
        </ul>
      </div>
      <form onSubmit={applyPrice}>
        <h2 className="mb-2 text-sm font-semibold">Price (₹)</h2>
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor="pmin">Minimum price</label><input id="pmin" className="input" inputMode="numeric" placeholder="Min" value={price.min} onChange={(e) => setPrice({ ...price, min: e.target.value })} />
          <span aria-hidden="true">–</span>
          <label className="sr-only" htmlFor="pmax">Maximum price</label><input id="pmax" className="input" inputMode="numeric" placeholder="Max" value={price.max} onChange={(e) => setPrice({ ...price, max: e.target.value })} />
        </div>
        {priceErr && <p role="alert" className="mt-1 text-xs font-medium text-rose-600">{priceErr}</p>}
        <button className="btn-secondary btn-sm mt-2 w-full">Apply</button>
      </form>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={get('inStock') === 'true'} onChange={(e) => update({ inStock: e.target.checked ? 'true' : '' })} /> In stock only</label>
      {hasFilters && <button className="btn-ghost btn-sm w-full" onClick={() => setParams(new URLSearchParams())}>Clear all filters</button>}
    </div>
  );

  return (
    <div className="container-page py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{get('q') ? `Results for “${get('q')}”` : activeCat ? cats.data?.categories.find((c) => c.slug === activeCat)?.name || 'Products' : 'All products'}</h1>
          <p className="text-sm text-ink-500" aria-live="polite">{loading ? 'Loading…' : `${data?.meta.total ?? 0} product${data?.meta.total === 1 ? '' : 's'}`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary btn-sm lg:hidden" aria-expanded={showFilters} onClick={() => setShowFilters((s) => !s)}>Filters</button>
          <label htmlFor="sort" className="sr-only">Sort by</label>
          <select id="sort" className="input !w-auto !py-2" value={get('sort', 'newest')} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })}>
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="grid gap-8 lg:grid-cols-[250px_1fr]">
        <aside aria-label="Filters" className={`${showFilters ? 'block' : 'hidden'} card h-fit p-5 lg:block`}>{filters}</aside>
        <section aria-label="Products">
          {error ? <ErrorState error={error} onRetry={reload} /> : loading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <ProductCardSkeleton key={i} />)}</div>
          ) : data.products.length === 0 ? (
            <EmptyState icon="🔍" title="No products found" message="Try a different search term or remove some filters." action={<button className="btn-primary" onClick={() => setParams(new URLSearchParams())}>Clear filters</button>} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{data.products.map((p) => <ProductCard key={p._id} product={p} />)}</div>
              <Pagination meta={data.meta} onPage={(page) => { update({ page: page > 1 ? page : '' }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
