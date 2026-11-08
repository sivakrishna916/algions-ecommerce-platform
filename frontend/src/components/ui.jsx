import { useEffect, useId, useRef } from 'react';
import { STATUS_LABEL, STATUS_STYLES } from '../utils/format';

export function Spinner({ label = 'Loading…', className = '' }) {
  return (
    <div role="status" className={`flex items-center justify-center gap-3 py-16 text-ink-500 ${className}`}>
      <svg className="h-6 w-6 animate-spin text-brand-600" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".2" /><path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" /></svg>
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon = '🛍️', title, message, action }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mb-3 text-4xl" aria-hidden="true">{icon}</div>
      <h3 className="text-lg font-semibold text-ink-900">{title}</h3>
      {message && <p className="mt-1 max-w-md text-sm text-ink-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, title = 'Something went wrong' }) {
  return (
    <div role="alert" className="flex flex-col items-center rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
      <div className="mb-2 text-3xl" aria-hidden="true">⚠️</div>
      <h3 className="text-base font-semibold text-rose-900">{title}</h3>
      <p className="mt-1 max-w-md text-sm text-rose-800">{error?.message || 'Please try again.'}</p>
      {onRetry && <button className="btn-secondary mt-4" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Alert({ type = 'error', children, className = '' }) {
  const s = { error: 'border-rose-200 bg-rose-50 text-rose-800', success: 'border-emerald-200 bg-emerald-50 text-emerald-800', warning: 'border-amber-200 bg-amber-50 text-amber-900', info: 'border-sky-200 bg-sky-50 text-sky-800' };
  return <div role={type === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${s[type]} ${className}`}>{children}</div>;
}

export function StatusBadge({ status }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STATUS_STYLES[status] || 'bg-slate-100 text-slate-700 ring-slate-200'}`}>{STATUS_LABEL[status] || status}</span>;
}

/** Accessible field: label is programmatically tied to the input; errors are announced via aria-describedby. */
export function Field({ label, error, hint, children, className = '', required }) {
  const id = useId();
  const child = children({ id, 'aria-invalid': !!error || undefined, 'aria-describedby': error ? `${id}-err` : hint ? `${id}-hint` : undefined, className: `input ${error ? 'input-error' : ''}` });
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-ink-700">{label}{required && <span className="text-rose-600" aria-hidden="true"> *</span>}</label>
      {child}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-ink-500">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-xs font-medium text-rose-600">{error}</p>}
    </div>
  );
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  const { page, totalPages } = meta;
  const pages = [];
  for (let p = 1; p <= totalPages; p += 1) if (p === 1 || p === totalPages || Math.abs(p - page) <= 1) pages.push(p);
  const withGaps = pages.flatMap((p, i) => (i > 0 && p - pages[i - 1] > 1 ? ['…', p] : [p]));
  return (
    <nav aria-label="Pagination" className="mt-8 flex flex-wrap items-center justify-center gap-1.5">
      <button className="btn-secondary btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>← Prev</button>
      {withGaps.map((p, i) => p === '…'
        ? <span key={`g${i}`} className="px-2 text-ink-500" aria-hidden="true">…</span>
        : <button key={p} onClick={() => onPage(p)} aria-current={p === page ? 'page' : undefined} aria-label={`Page ${p}`}
            className={`btn btn-sm min-w-[2.25rem] ${p === page ? 'bg-brand-600 text-white' : 'border border-slate-300 bg-white text-ink-700 hover:bg-slate-50'}`}>{p}</button>)}
      <button className="btn-secondary btn-sm" disabled={page >= totalPages} onClick={() => onPage(page + 1)}>Next →</button>
    </nav>
  );
}

export function Modal({ open, title, onClose, children, wide }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-lift outline-none sm:rounded-2xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'}`}>
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Close dialog" className="rounded-lg p-1.5 text-ink-500 hover:bg-slate-100">✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger, busy, onConfirm, onCancel }) {
  return (
    <Modal open={open} title={title} onClose={onCancel}>
      <p className="text-sm text-ink-700">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button className="btn-secondary" onClick={onCancel} disabled={busy}>Keep it</button>
        <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm} disabled={busy}>{busy ? 'Working…' : confirmLabel}</button>
      </div>
    </Modal>
  );
}

export function OrderTimeline({ history = [], status }) {
  const FLOW = ['PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED'];
  const reached = new Map(history.map((h) => [h.status, h.at]));
  if (status === 'CANCELLED') {
    return (
      <ol className="space-y-3" aria-label="Order progress">
        {history.map((h) => (
          <li key={h.status + h.at} className="flex items-center gap-3 text-sm"><span className={`h-3 w-3 rounded-full ${h.status === 'CANCELLED' ? 'bg-rose-500' : 'bg-emerald-500'}`} /><span className="font-medium">{h.status === 'CANCELLED' ? 'Cancelled' : h.status[0] + h.status.slice(1).toLowerCase()}</span><span className="text-ink-500">{new Date(h.at).toLocaleString('en-IN')}</span></li>
        ))}
      </ol>
    );
  }
  return (
    <ol className="grid grid-cols-5 gap-1" aria-label="Order progress">
      {FLOW.map((s, i) => {
        const done = reached.has(s);
        return (
          <li key={s} className="flex flex-col items-center text-center" aria-current={s === status ? 'step' : undefined}>
            <div className="flex w-full items-center">
              <div className={`h-0.5 flex-1 ${i === 0 ? 'invisible' : done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
              <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${done ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-ink-500'}`}>{done ? '✓' : i + 1}</div>
              <div className={`h-0.5 flex-1 ${i === FLOW.length - 1 ? 'invisible' : reached.has(FLOW[i + 1]) ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            </div>
            <span className={`mt-1.5 text-xs font-medium ${done ? 'text-ink-900' : 'text-ink-500'}`}>{s[0] + s.slice(1).toLowerCase()}</span>
          </li>
        );
      })}
    </ol>
  );
}
