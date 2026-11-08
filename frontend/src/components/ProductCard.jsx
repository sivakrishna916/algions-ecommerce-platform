import { Link } from 'react-router-dom';
import ProductImage from './ProductImage';
import { discountPercent, formatMoney } from '../utils/format';

export default function ProductCard({ product }) {
  const lowest = product.variants.reduce((a, b) => (b.price < a.price ? b : a), product.variants[0]);
  const totalStock = product.variants.reduce((s, v) => s + v.stock, 0);
  const off = discountPercent(lowest.price, lowest.mrp);
  const multi = product.variants.length > 1;
  return (
    <Link to={`/products/${product.slug}`} className="group card flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift focus-visible:outline-brand-600">
      <div className="relative aspect-square overflow-hidden bg-slate-100">
        <ProductImage src={product.images[0]} alt={product.name} className="h-full w-full transition duration-300 group-hover:scale-105" />
        {off > 0 && <span className="absolute left-3 top-3 rounded-full bg-rose-600 px-2.5 py-1 text-xs font-bold text-white">{off}% OFF</span>}
        {totalStock === 0 && <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-sm font-bold uppercase tracking-wide text-ink-700">Sold out</span>}
        {totalStock > 0 && totalStock <= 5 && <span className="absolute bottom-3 left-3 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-bold text-white">Only {totalStock} left</span>}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-ink-500">{product.brand || product.category?.name}</p>
        <h3 className="mt-1 line-clamp-2 text-sm font-semibold text-ink-900">{product.name}</h3>
        <div className="mt-auto flex items-baseline gap-2 pt-3">
          <span className="text-lg font-bold text-ink-900">{multi && <span className="text-xs font-medium text-ink-500">from </span>}{formatMoney(lowest.price)}</span>
          {lowest.mrp > lowest.price && <span className="text-xs text-ink-500 line-through">{formatMoney(lowest.mrp)}</span>}
        </div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden" aria-hidden="true">
      <div className="skeleton aspect-square rounded-none" />
      <div className="space-y-2 p-4"><div className="skeleton h-3 w-1/3" /><div className="skeleton h-4 w-4/5" /><div className="skeleton h-5 w-1/3" /></div>
    </div>
  );
}
