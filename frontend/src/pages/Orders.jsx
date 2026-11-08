import { useState } from 'react';
import { Link } from 'react-router-dom';
import { orderApi } from '../api/services';
import useFetch from '../utils/useFetch';
import { EmptyState, ErrorState, Pagination, Spinner, StatusBadge } from '../components/ui';
import { formatDate, formatMoney } from '../utils/format';

const FILTERS = [['', 'All'], ['PLACED', 'Awaiting payment'], ['PAID', 'Paid'], ['SHIPPED', 'Shipped'], ['DELIVERED', 'Delivered'], ['CANCELLED', 'Cancelled']];

export default function Orders() {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => orderApi.list({ status: status || undefined, page, limit: 8 }), [status, page]);
  return (
    <div className="container-page py-8">
      <h1 className="mb-4 text-2xl font-bold">My orders</h1>
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Filter by status">
        {FILTERS.map(([v, l]) => <button key={v} aria-pressed={status === v} onClick={() => { setStatus(v); setPage(1); }} className={`btn btn-sm ${status === v ? 'bg-brand-600 text-white' : 'border border-slate-300 bg-white text-ink-700 hover:bg-slate-50'}`}>{l}</button>)}
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <Spinner label="Loading orders…" /> : data.orders.length === 0 ? (
        <EmptyState icon="📦" title="No orders here yet" message={status ? 'No orders match this filter.' : 'When you place an order it will show up here.'} action={<Link to="/products" className="btn-primary">Browse products</Link>} />
      ) : (
        <>
          <ul className="space-y-3">
            {data.orders.map((o) => (
              <li key={o._id}>
                <Link to={`/orders/${o._id}`} className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:shadow-lift">
                  <div><p className="font-semibold">{o.orderNumber}</p><p className="text-xs text-ink-500">{formatDate(o.createdAt)} · {o.items.reduce((s, i) => s + i.quantity, 0)} item(s) — {o.items[0].name}{o.items.length > 1 ? ` +${o.items.length - 1} more` : ''}</p></div>
                  <div className="flex items-center gap-4"><StatusBadge status={o.status} /><span className="font-bold">{formatMoney(o.pricing.total)}</span><span aria-hidden="true">›</span></div>
                </Link>
              </li>
            ))}
          </ul>
          <Pagination meta={data.meta} onPage={setPage} />
        </>
      )}
    </div>
  );
}
