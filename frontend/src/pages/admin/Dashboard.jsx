import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { adminApi } from '../../api/services';
import useFetch from '../../utils/useFetch';
import { ErrorState, Spinner, StatusBadge } from '../../components/ui';
import { formatDate, formatMoney, STATUS_LABEL } from '../../utils/format';

export const PageHeader = ({ title, subtitle, actions }) => (
  <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
    <div><h1 className="text-2xl font-bold">{title}</h1>{subtitle && <p className="text-sm text-ink-500">{subtitle}</p>}</div>{actions}
  </div>
);

const STATUS_COLORS = { PLACED: '#f59e0b', PAID: '#0ea5e9', PACKED: '#8b5cf6', SHIPPED: '#6366f1', DELIVERED: '#10b981', CANCELLED: '#f43f5e' };

function Kpi({ label, value, hint, icon }) {
  return (
    <div className="card flex items-center gap-4 p-5">
      <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-2xl" aria-hidden="true">{icon}</span>
      <div><p className="text-sm text-ink-500">{label}</p><p className="text-2xl font-extrabold">{value}</p>{hint && <p className="text-xs text-ink-500">{hint}</p>}</div>
    </div>
  );
}

export default function Dashboard() {
  const { data, loading, error, reload } = useFetch(() => adminApi.dashboard(), []);
  if (loading) return <Spinner label="Loading dashboard…" />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { totals, statusCounts, salesByDay, recentOrders, lowStock, lowStockThreshold } = data;
  const statusData = Object.entries(statusCounts).map(([status, count]) => ({ status, label: STATUS_LABEL[status], count }));
  const daily = salesByDay.map((d) => ({ ...d, label: d.date.slice(5), rupees: d.revenue / 100 }));

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Revenue counts orders whose payment is PAID (cancelled and refunded orders are excluded)." actions={<button className="btn-secondary btn-sm" onClick={reload}>↻ Refresh</button>} />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Total revenue" value={formatMoney(totals.revenue)} hint={`${totals.paidOrders} paid orders`} icon="💰" />
        <Kpi label="Total orders" value={totals.orders} icon="📦" />
        <Kpi label="Customers" value={totals.customers} icon="👥" />
        <Kpi label="Active products" value={totals.products} icon="🏷️" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card p-5 xl:col-span-2" aria-label="Sales over the last 14 days">
          <h2 className="mb-4 font-semibold">Sales — last 14 days</h2>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%">
            <LineChart data={daily} margin={{ left: 0, right: 12, top: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" /><XAxis dataKey="label" fontSize={12} /><YAxis fontSize={12} tickFormatter={(v) => `₹${v >= 1000 ? `${Math.round(v / 1000)}k` : v}`} width={52} />
              <Tooltip formatter={(v, n) => (n === 'rupees' ? [formatMoney(v * 100), 'Revenue'] : [v, 'Orders'])} />
              <Line type="monotone" dataKey="rupees" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer></div>
        </section>
        <section className="card p-5" aria-label="Orders by status">
          <h2 className="mb-4 font-semibold">Orders by status</h2>
          <div className="h-72"><ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData} layout="vertical" margin={{ left: 10, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} /><XAxis type="number" allowDecimals={false} fontSize={12} /><YAxis type="category" dataKey="label" fontSize={12} width={72} />
              <Tooltip /><Bar dataKey="count" radius={[0, 6, 6, 0]}>{statusData.map((d) => <Cell key={d.status} fill={STATUS_COLORS[d.status]} />)}</Bar>
            </BarChart>
          </ResponsiveContainer></div>
          <table className="sr-only"><caption>Orders by status</caption><tbody>{statusData.map((d) => <tr key={d.status}><th>{d.label}</th><td>{d.count}</td></tr>)}</tbody></table>
        </section>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <section className="card overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between p-5 pb-3"><h2 className="font-semibold">Recent orders</h2><Link to="/admin/orders" className="text-sm font-semibold text-brand-700">View all →</Link></div>
          <div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100">
            <thead><tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Status</th><th className="th text-right">Total</th></tr></thead>
            <tbody className="divide-y divide-slate-100">{recentOrders.map((o) => (
              <tr key={o._id}><td className="td"><p className="font-medium text-ink-900">{o.orderNumber}</p><p className="text-xs text-ink-500">{formatDate(o.createdAt)}</p></td><td className="td">{o.user?.name || '—'}</td><td className="td"><StatusBadge status={o.status} /></td><td className="td text-right font-semibold">{formatMoney(o.pricing.total)}</td></tr>
            ))}</tbody>
          </table></div>
        </section>
        <section className="card p-5" aria-label="Low stock">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Low stock</h2><span className="text-xs text-ink-500">≤ {lowStockThreshold} units</span></div>
          {lowStock.length === 0 ? <p className="py-6 text-center text-sm text-ink-500">All products are well stocked 🎉</p> : (
            <ul className="divide-y divide-slate-100">{lowStock.map((l) => (
              <li key={l.sku} className="flex items-center justify-between gap-3 py-2.5 text-sm"><div className="min-w-0"><p className="truncate font-medium">{l.name}</p><p className="text-xs text-ink-500">{l.label} · {l.sku}</p></div><span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${l.stock === 0 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{l.stock === 0 ? 'Out' : `${l.stock} left`}</span></li>
            ))}</ul>
          )}
          <Link to="/admin/products" className="mt-3 block text-sm font-semibold text-brand-700">Manage inventory →</Link>
        </section>
      </div>
    </>
  );
}
