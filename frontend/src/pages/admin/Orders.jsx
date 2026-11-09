import { useState } from 'react';
import { adminApi } from '../../api/services';
import useFetch from '../../utils/useFetch';
import { useToast } from '../../context/ToastContext';
import { Alert, ConfirmDialog, EmptyState, ErrorState, Modal, OrderTimeline, Pagination, Spinner, StatusBadge } from '../../components/ui';
import { formatDate, formatMoney } from '../../utils/format';
import { PageHeader } from './Dashboard';

const NEXT = { PAID: ['PACKED', 'Mark as packed'], PACKED: ['SHIPPED', 'Mark as shipped'], SHIPPED: ['DELIVERED', 'Mark as delivered'] };
const CANCELLABLE = ['PLACED', 'PAID', 'PACKED'];
const STATUSES = ['', 'PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

function OrderDetailModal({ id, onClose, onChanged }) {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => adminApi.order(id), [id]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState(false);

  const act = async (status, note) => {
    setBusy(true); setMsg('');
    try { await adminApi.setOrderStatus(id, status, note); toast.success(`Order updated to ${status.toLowerCase()}`); setConfirm(false); await reload(); onChanged(); }
    catch (e) { setMsg(e.message); setConfirm(false); await reload(); onChanged(); } finally { setBusy(false); }
  };
  if (loading && !data) return <Spinner />;
  if (error) return <ErrorState error={error} onRetry={reload} />;
  const { order, payments, logs } = data;
  const next = NEXT[order.status];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-lg font-bold">{order.orderNumber}</p><p className="text-sm text-ink-500">{formatDate(order.createdAt)} · {order.user?.name} ({order.user?.email})</p></div><StatusBadge status={order.status} /></div>
      {msg && <Alert>{msg}</Alert>}
      <OrderTimeline history={order.statusHistory} status={order.status} />
      <div className="flex flex-wrap gap-2">
        {next && <button className="btn-primary" disabled={busy} onClick={() => act(next[0])}>{next[1]}</button>}
        {CANCELLABLE.includes(order.status) && <button className="btn-secondary !border-rose-300 text-rose-700" disabled={busy} onClick={() => setConfirm(true)}>Cancel order</button>}
        {order.status === 'PLACED' && <p className="self-center text-xs text-ink-500">Awaiting customer payment — it cannot be packed until paid.</p>}
        {['DELIVERED', 'CANCELLED'].includes(order.status) && <p className="self-center text-xs text-ink-500">This order is final.</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-slate-200 p-4 text-sm"><h3 className="mb-2 font-semibold">Items</h3><ul className="space-y-1.5">{order.items.map((i) => <li key={i.sku} className="flex justify-between gap-2"><span>{i.quantity} × {i.name} <span className="text-ink-500">({i.sku})</span></span><span className="font-medium">{formatMoney(i.lineTotal)}</span></li>)}</ul>
          <dl className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-ink-700"><div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(order.pricing.subtotal)}</dd></div>{order.pricing.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>− {formatMoney(order.pricing.discount)}</dd></div>}<div className="flex justify-between"><dt>Tax</dt><dd>{formatMoney(order.pricing.tax)}</dd></div><div className="flex justify-between"><dt>Shipping</dt><dd>{formatMoney(order.pricing.shipping)}</dd></div><div className="flex justify-between border-t border-slate-100 pt-1 font-bold text-ink-900"><dt>Total</dt><dd>{formatMoney(order.pricing.total)}</dd></div></dl></section>
        <section className="space-y-4 text-sm">
          <div className="rounded-xl border border-slate-200 p-4"><h3 className="mb-2 font-semibold">Ship to</h3><p>{order.shippingAddress.fullName}<br />{order.shippingAddress.line1}, {order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />📞 {order.shippingAddress.phone}</p></div>
          <div className="rounded-xl border border-slate-200 p-4"><h3 className="mb-2 font-semibold">Payments</h3>{payments.length === 0 ? <p className="text-ink-500">No payment attempts.</p> : <ul className="space-y-1">{payments.map((p) => <li key={p._id} className="flex justify-between"><span>{p.method.toUpperCase()} {p.instrument}</span><span className="font-semibold">{p.status}{p.failureReason ? ` — ${p.failureReason}` : ''}</span></li>)}</ul>}</div>
        </section>
      </div>
      <section className="rounded-xl border border-slate-200 p-4 text-sm"><h3 className="mb-2 font-semibold">Audit trail for this order</h3><ul className="space-y-1.5">{logs.map((l) => <li key={l._id} className="flex flex-wrap justify-between gap-2"><span>{l.summary}</span><span className="text-xs text-ink-500">{l.actorEmail || 'system'} · {formatDate(l.createdAt)}</span></li>)}</ul></section>
      <ConfirmDialog open={confirm} danger title="Cancel this order?" message={order.paymentStatus === 'PAID' ? 'The payment will be refunded and stock returned to inventory.' : 'Reserved stock will be returned to inventory.'} confirmLabel="Cancel order" busy={busy} onConfirm={() => act('CANCELLED', 'Cancelled by admin')} onCancel={() => setConfirm(false)} />
    </div>
  );
}

export default function Orders() {
  const [status, setStatus] = useState('');
  const [q, setQ] = useState(''); const [search, setSearch] = useState('');
  const [from, setFrom] = useState(''); const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  const { data, loading, error, reload } = useFetch(() => adminApi.orders({ status: status || undefined, q: search || undefined, from: from || undefined, to: to || undefined, page, limit: 10 }), [status, search, from, to, page]);
  return (
    <>
      <PageHeader title="Orders" subtitle="Review orders and move them through fulfilment." />
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <form className="min-w-[220px] flex-1" role="search" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }}><label htmlFor="osearch" className="mb-1 block text-xs font-medium text-ink-500">Order number, customer name or email</label><div className="flex gap-2"><input id="osearch" className="input" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn-secondary">Search</button></div></form>
        <div><label htmlFor="ostatus" className="mb-1 block text-xs font-medium text-ink-500">Status</label><select id="ostatus" className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>{STATUSES.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}</select></div>
        <div><label htmlFor="ofrom" className="mb-1 block text-xs font-medium text-ink-500">From</label><input id="ofrom" type="date" className="input" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} /></div>
        <div><label htmlFor="oto" className="mb-1 block text-xs font-medium text-ink-500">To</label><input id="oto" type="date" className="input" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} /></div>
      </div>
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <Spinner /> : data.orders.length === 0 ? <EmptyState icon="📭" title="No orders found" message="Adjust the filters to see more orders." /> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr><th className="th">Order</th><th className="th">Customer</th><th className="th">Status</th><th className="th">Payment</th><th className="th text-right">Total</th><th className="th" /></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.orders.map((o) => (
            <tr key={o._id} className="hover:bg-slate-50"><td className="td"><p className="font-medium text-ink-900">{o.orderNumber}</p><p className="text-xs text-ink-500">{formatDate(o.createdAt)}</p></td><td className="td">{o.user?.name}<p className="text-xs text-ink-500">{o.user?.email}</p></td><td className="td"><StatusBadge status={o.status} /></td><td className="td text-xs font-semibold">{o.paymentStatus}</td><td className="td text-right font-semibold">{formatMoney(o.pricing.total)}</td><td className="td text-right"><button className="btn-secondary btn-sm" onClick={() => setOpen(o._id)} aria-label={`Open order ${o.orderNumber}`}>Open</button></td></tr>
          ))}</tbody>
        </table></div></div>
      )}
      {data && <Pagination meta={data.meta} onPage={setPage} />}
      <Modal open={!!open} onClose={() => setOpen(null)} title="Order details" wide>{open && <OrderDetailModal id={open} onClose={() => setOpen(null)} onChanged={reload} />}</Modal>
    </>
  );
}
