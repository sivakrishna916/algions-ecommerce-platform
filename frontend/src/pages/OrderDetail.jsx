import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { orderApi } from '../api/services';
import { fieldErrors } from '../api/client';
import useFetch from '../utils/useFetch';
import { useToast } from '../context/ToastContext';
import ProductImage from '../components/ProductImage';
import { PaymentForm, emptyPayment, toPaymentPayload } from '../components/forms';
import { Alert, ConfirmDialog, ErrorState, OrderTimeline, Spinner, StatusBadge } from '../components/ui';
import { PriceSummary } from './Cart';
import { formatDate, formatMoney } from '../utils/format';

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { data, loading, error, reload } = useFetch(() => orderApi.get(id), [id]);
  const toast = useToast();
  const [payment, setPayment] = useState({ ...emptyPayment });
  const [payErrors, setPayErrors] = useState({});
  const [payMsg, setPayMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  if (loading && !data) return <Spinner label="Loading order…" className="min-h-[50vh]" />;
  if (error) return <div className="container-page py-12"><ErrorState title={error.status === 404 ? 'Order not found' : undefined} error={error} onRetry={error.status === 404 ? undefined : reload} /><div className="mt-4 text-center"><Link to="/orders" className="btn-secondary">My orders</Link></div></div>;

  const { order, payments, allowed } = data;
  const lastFailure = [...payments].reverse().find((p) => p.status === 'FAILED');
  const needsPayment = order.status === 'PLACED';
  const justPlaced = params.get('placed') === '1';

  const pay = async () => {
    setBusy(true); setPayMsg(''); setPayErrors({});
    try {
      const r = await orderApi.pay(order._id, toPaymentPayload(payment));
      if (r.paymentSucceeded) toast.success('Payment successful'); else setPayMsg(r.payment?.failureReason || 'Payment declined');
      await reload();
    } catch (e) { setPayErrors(fieldErrors(e)); setPayMsg(e.message); } finally { setBusy(false); }
  };
  const cancel = async () => {
    setBusy(true);
    try { await orderApi.cancel(order._id, 'Cancelled by customer'); toast.success('Order cancelled'); setConfirmCancel(false); await reload(); }
    catch (e) { toast.error(e.message); setConfirmCancel(false); await reload(); } finally { setBusy(false); }
  };

  return (
    <div className="container-page py-8">
      {justPlaced && order.paymentStatus === 'PAID' && (
        <div className="mb-6 rounded-2xl bg-emerald-50 p-6 text-center ring-1 ring-emerald-200" role="status">
          <div className="text-4xl" aria-hidden="true">🎉</div>
          <h1 className="mt-2 text-2xl font-extrabold text-emerald-900">Thank you! Your order is confirmed.</h1>
          <p className="mt-1 text-emerald-800">Order <b>{order.orderNumber}</b> · we have received your payment of {formatMoney(order.pricing.total)}.</p>
        </div>
      )}
      {justPlaced && needsPayment && <Alert type="warning" className="mb-6"><b>Order {order.orderNumber} is saved but not paid yet.</b> {lastFailure ? `Last attempt failed: ${lastFailure.failureReason}.` : ''} Your items are reserved — retry payment below or cancel the order.</Alert>}

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div><Link to="/orders" className="text-sm font-semibold text-brand-700">← All orders</Link><h2 className="mt-1 text-2xl font-bold">Order {order.orderNumber}</h2><p className="text-sm text-ink-500">Placed on {formatDate(order.createdAt)}</p></div>
        <div className="flex items-center gap-3"><StatusBadge status={order.status} />{order.paymentStatus === 'REFUNDED' && <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-xs font-semibold">Refunded</span>}</div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="card p-5" aria-label="Order progress"><h3 className="mb-4 font-semibold">Order progress</h3><OrderTimeline history={order.statusHistory} status={order.status} />{order.status === 'CANCELLED' && order.cancelReason && <p className="mt-3 text-sm text-ink-500">Reason: {order.cancelReason}</p>}</section>

          {needsPayment && (
            <section className="card border-amber-300 p-5" aria-label="Complete payment">
              <h3 className="mb-1 font-semibold">Complete payment — {formatMoney(order.pricing.total)}</h3>
              {payMsg && <Alert className="mb-3">{payMsg}</Alert>}
              <PaymentForm value={payment} onChange={setPayment} errors={payErrors} />
              <button className="btn-primary mt-4" onClick={pay} disabled={busy}>{busy ? 'Processing…' : `Pay ${formatMoney(order.pricing.total)}`}</button>
            </section>
          )}

          <section className="card divide-y divide-slate-100" aria-label="Items">
            <h3 className="p-5 pb-3 font-semibold">Items</h3>
            {order.items.map((i) => (
              <div key={i.sku} className="flex gap-4 p-5"><div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100"><ProductImage src={i.image} alt={i.name} className="h-full w-full" /></div>
                <div className="flex-1 text-sm"><p className="font-semibold">{i.name}</p><p className="text-ink-500">{i.variantLabel} · Qty {i.quantity} × {formatMoney(i.unitPrice)}</p></div><p className="text-sm font-bold">{formatMoney(i.lineTotal)}</p></div>
            ))}
          </section>
        </div>

        <aside className="space-y-6">
          <section className="card space-y-4 p-5"><h3 className="font-semibold">Payment summary</h3><PriceSummary pricing={order.pricing} couponCode={order.couponCode} />
            {payments.length > 0 && <div className="border-t border-slate-100 pt-3"><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Payment attempts</h4><ul className="space-y-1.5 text-sm">{payments.map((p) => <li key={p.id} className="flex justify-between gap-2"><span>{p.instrument}</span><span className={p.status === 'FAILED' ? 'font-semibold text-rose-600' : p.status === 'REFUNDED' ? 'font-semibold text-slate-600' : 'font-semibold text-emerald-600'}>{p.status === 'SUCCEEDED' ? 'Paid' : p.status === 'FAILED' ? 'Failed' : 'Refunded'}</span></li>)}</ul></div>}
          </section>
          <section className="card p-5 text-sm"><h3 className="mb-2 font-semibold">Delivering to</h3><p className="font-medium">{order.shippingAddress.fullName}</p><p className="text-ink-700">{order.shippingAddress.line1}{order.shippingAddress.line2 ? `, ${order.shippingAddress.line2}` : ''}<br />{order.shippingAddress.city}, {order.shippingAddress.state} {order.shippingAddress.postalCode}<br />📞 {order.shippingAddress.phone}</p></section>
          {allowed.cancel && <button className="btn-secondary w-full !border-rose-300 text-rose-700 hover:!bg-rose-50" onClick={() => setConfirmCancel(true)}>Cancel order</button>}
          {order.status === 'PACKED' && <p className="text-xs text-ink-500">This order has been packed and can no longer be cancelled online.</p>}
        </aside>
      </div>
      <ConfirmDialog open={confirmCancel} danger title="Cancel this order?" message={order.paymentStatus === 'PAID' ? 'Your payment will be refunded and the items returned to stock.' : 'The reserved items will be returned to stock.'} confirmLabel="Yes, cancel order" busy={busy} onConfirm={cancel} onCancel={() => setConfirmCancel(false)} />
    </div>
  );
}
