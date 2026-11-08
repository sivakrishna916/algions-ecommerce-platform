/** Money is stored/transmitted as integer paise. Convert only at the edge, for display. */
export const formatMoney = (paise) => {
  const rupees = (Number(paise) || 0) / 100;
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: rupees % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 }).format(rupees);
};
export const rupeesToPaise = (rupees) => Math.round(Number(rupees) * 100);
export const paiseToRupees = (paise) => (Number(paise) || 0) / 100;

export const formatDate = (iso, withTime = true) => {
  if (!iso) return '—';
  const opts = withTime ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' };
  return new Date(iso).toLocaleString('en-IN', opts);
};

export const discountPercent = (price, mrp) => (mrp && mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0);

/** A new key per checkout attempt; reused only when retrying the SAME attempt (e.g. after a network error). */
export const newIdempotencyKey = () =>
  (globalThis.crypto && globalThis.crypto.randomUUID ? globalThis.crypto.randomUUID() : `k-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const STATUS_STYLES = {
  PLACED: 'bg-amber-100 text-amber-800 ring-amber-200',
  PAID: 'bg-sky-100 text-sky-800 ring-sky-200',
  PACKED: 'bg-violet-100 text-violet-800 ring-violet-200',
  SHIPPED: 'bg-indigo-100 text-indigo-800 ring-indigo-200',
  DELIVERED: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  CANCELLED: 'bg-rose-100 text-rose-800 ring-rose-200',
};
export const STATUS_LABEL = { PLACED: 'Placed', PAID: 'Paid', PACKED: 'Packed', SHIPPED: 'Shipped', DELIVERED: 'Delivered', CANCELLED: 'Cancelled' };
export const FLOW = ['PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED'];
