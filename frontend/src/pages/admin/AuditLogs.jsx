import { useState } from 'react';
import { adminApi } from '../../api/services';
import useFetch from '../../utils/useFetch';
import { EmptyState, ErrorState, Pagination, Spinner } from '../../components/ui';
import { formatDate } from '../../utils/format';
import { PageHeader } from './Dashboard';

const GROUPS = [['', 'All actions'], ['order.', 'Orders'], ['payment.', 'Payments'], ['product.', 'Products'], ['inventory.', 'Inventory'], ['category.', 'Categories'], ['customer.', 'Customers'], ['auth.', 'Sign-ups']];

export default function AuditLogs() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useFetch(() => adminApi.auditLogs({ action: action || undefined, from: from || undefined, to: to || undefined, page, limit: 20 }), [action, from, to, page]);
  return (
    <>
      <PageHeader title="Audit log" subtitle="Read-only record of material business actions: who did what, and when." />
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div><label htmlFor="aact" className="mb-1 block text-xs font-medium text-ink-500">Action</label><select id="aact" className="input" value={action} onChange={(e) => { setAction(e.target.value); setPage(1); }}>{GROUPS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label htmlFor="afrom" className="mb-1 block text-xs font-medium text-ink-500">From</label><input id="afrom" type="date" className="input" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></div>
        <div><label htmlFor="ato" className="mb-1 block text-xs font-medium text-ink-500">To</label><input id="ato" type="date" className="input" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <Spinner /> : data.logs.length === 0 ? <EmptyState icon="🧾" title="No log entries" message="Nothing matches these filters." /> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr><th className="th">When</th><th className="th">Who</th><th className="th">Action</th><th className="th">Details</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.logs.map((l) => (
            <tr key={l._id}><td className="td whitespace-nowrap text-xs">{formatDate(l.createdAt)}</td><td className="td"><p className="text-sm">{l.actorEmail || 'system'}</p><p className="text-xs text-ink-500">{l.actorRole}</p></td><td className="td"><code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{l.action}</code></td><td className="td">{l.summary}</td></tr>
          ))}</tbody>
        </table></div></div>
      )}
      {data && <Pagination meta={data.meta} onPage={setPage} />}
    </>
  );
}
