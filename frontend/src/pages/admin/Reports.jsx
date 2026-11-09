import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi } from '../../api/services';
import useFetch from '../../utils/useFetch';
import { Alert, ErrorState, Spinner } from '../../components/ui';
import { formatMoney } from '../../utils/format';
import { PageHeader } from './Dashboard';

const isMoney = (name) => /revenue|total|refund|payment/i.test(name) && !/number|count/i.test(name);

function Reconciliation() {
  const { data, loading, error, reload } = useFetch(() => adminApi.reconciliation(), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  return (
    <section className="card p-5" aria-label="Reconciliation">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-semibold">Reconciliation: orders vs payments vs reports</h2><p className="text-sm text-ink-500">Every check compares two independently calculated numbers.</p></div>
        <button className="btn-secondary btn-sm" onClick={reload}>↻ Re-run</button>
      </div>
      <Alert type={data.balanced ? 'success' : 'error'} className="mb-4"><b>{data.balanced ? '✔ Everything reconciles.' : '✖ Mismatch detected — investigate the failing checks below.'}</b></Alert>
      <ul className="divide-y divide-slate-100">{data.checks.map((c) => (
        <li key={c.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm"><span className="flex items-center gap-2"><span aria-hidden="true">{c.ok ? '✅' : '❌'}</span><span className="sr-only">{c.ok ? 'Pass:' : 'Fail:'}</span>{c.name}</span>
          <span className={`font-mono text-xs ${c.ok ? 'text-ink-500' : 'font-bold text-rose-600'}`}>expected {isMoney(c.name) ? formatMoney(c.expected) : c.expected} · actual {isMoney(c.name) ? formatMoney(c.actual) : c.actual}</span></li>
      ))}</ul>
    </section>
  );
}

export default function Reports() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [applied, setApplied] = useState({});
  const { data, loading, error, reload } = useFetch(() => adminApi.sales({ from: applied.from || undefined, to: applied.to || undefined }), [applied.from, applied.to]);
  const chart = data?.daily.map((d) => ({ ...d, label: d.date.slice(5), rupees: d.revenue / 100 })) || [];
  return (
    <>
      <PageHeader title="Reports" subtitle="Sales summary for a date range, plus an integrity check across orders and payments." />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4" onSubmit={(e) => { e.preventDefault(); setApplied(range); }}>
        <div><label htmlFor="rfrom" className="mb-1 block text-xs font-medium text-ink-500">From</label><input id="rfrom" type="date" className="input" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} /></div>
        <div><label htmlFor="rto" className="mb-1 block text-xs font-medium text-ink-500">To</label><input id="rto" type="date" className="input" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} /></div>
        <button className="btn-primary">Apply</button><button type="button" className="btn-ghost" onClick={() => { setRange({ from: '', to: '' }); setApplied({}); }}>Last 30 days</button>
      </form>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <Spinner /> : (
        <div className="space-y-6">
          <p className="text-sm text-ink-500">Showing {data.range.from} → {data.range.to}</p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            {[['Revenue', formatMoney(data.totals.revenue)], ['Paid orders', data.totals.orders], ['Avg. order value', formatMoney(data.totals.averageOrderValue)], ['Tax collected', formatMoney(data.totals.tax)], ['Discounts given', formatMoney(data.totals.discount)]].map(([l, v]) => <div key={l} className="card p-4"><p className="text-xs text-ink-500">{l}</p><p className="text-xl font-extrabold">{v}</p></div>)}
          </div>
          <section className="card p-5" aria-label="Daily revenue"><h2 className="mb-3 font-semibold">Daily revenue</h2>
            {chart.length === 0 ? <p className="py-10 text-center text-sm text-ink-500">No paid orders in this range.</p> : <div className="h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} width={52} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} /><Tooltip formatter={(v) => [formatMoney(v * 100), 'Revenue']} /><Bar dataKey="rupees" fill="#4f46e5" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></div>}
          </section>
          <section className="card overflow-hidden"><h2 className="p-5 pb-3 font-semibold">Top products by revenue</h2>
            {data.topProducts.length === 0 ? <p className="px-5 pb-6 text-sm text-ink-500">Nothing sold in this range.</p> : <table className="min-w-full divide-y divide-slate-100"><thead className="bg-slate-50"><tr><th className="th">Product</th><th className="th text-right">Units</th><th className="th text-right">Revenue</th></tr></thead><tbody className="divide-y divide-slate-100">{data.topProducts.map((p) => <tr key={String(p.productId)}><td className="td font-medium text-ink-900">{p.name}</td><td className="td text-right">{p.units}</td><td className="td text-right font-semibold">{formatMoney(p.revenue)}</td></tr>)}</tbody></table>}
          </section>
          <Reconciliation />
        </div>
      )}
    </>
  );
}
