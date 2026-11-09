import { useState } from 'react';
import { adminApi } from '../../api/services';
import useFetch from '../../utils/useFetch';
import { useToast } from '../../context/ToastContext';
import { EmptyState, ErrorState, Pagination, Spinner } from '../../components/ui';
import { formatDate, formatMoney } from '../../utils/format';
import { PageHeader } from './Dashboard';

export default function Customers() {
  const toast = useToast();
  const [q, setQ] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => adminApi.customers({ q: search || undefined, page, limit: 10 }), [search, page]);
  const toggle = async (c) => { try { await adminApi.setCustomerActive(c._id, !c.isActive); toast.success(c.isActive ? 'Account disabled' : 'Account enabled'); reload(); } catch (e) { toast.error(e.message); } };
  return (
    <>
      <PageHeader title="Customers" subtitle="Registered shoppers, their orders and lifetime spend (paid orders)." />
      <form className="card mb-4 flex items-end gap-2 p-4" role="search" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }}>
        <div className="max-w-sm flex-1"><label htmlFor="csearch" className="mb-1 block text-xs font-medium text-ink-500">Search name or email</label><input id="csearch" className="input" value={q} onChange={(e) => setQ(e.target.value)} /></div><button className="btn-secondary">Search</button>
      </form>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <Spinner /> : data.customers.length === 0 ? <EmptyState icon="👥" title="No customers found" /> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr><th className="th">Customer</th><th className="th">Joined</th><th className="th text-right">Orders</th><th className="th text-right">Spent</th><th className="th">Status</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.customers.map((c) => (
            <tr key={c._id}><td className="td"><p className="font-medium text-ink-900">{c.name}</p><p className="text-xs text-ink-500">{c.email}</p></td><td className="td">{formatDate(c.createdAt, false)}</td><td className="td text-right">{c.orderCount}</td><td className="td text-right font-semibold">{formatMoney(c.totalSpent)}</td>
              <td className="td">{c.isActive ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span> : <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">Disabled</span>}</td>
              <td className="td text-right"><button className="btn-secondary btn-sm" onClick={() => toggle(c)}>{c.isActive ? 'Disable' : 'Enable'}</button></td></tr>
          ))}</tbody>
        </table></div></div>
      )}
      {data && <Pagination meta={data.meta} onPage={setPage} />}
    </>
  );
}
