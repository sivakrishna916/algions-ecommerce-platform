import { useState } from 'react';
import { Alert, Field } from './ui';

export const TEST_CARDS = [
  { label: 'Success', number: '4242 4242 4242 4242' },
  { label: 'Declined', number: '4000 0000 0000 0002' },
  { label: 'Insufficient funds', number: '4000 0000 0000 9995' },
];

export const emptyPayment = { method: 'card', number: '4242 4242 4242 4242', expiry: '12/30', cvv: '123', vpa: '' };

/** Builds the API payload from form state (only the fields for the chosen method). */
export const toPaymentPayload = (p) => (p.method === 'card' ? { method: 'card', number: p.number, expiry: p.expiry, cvv: p.cvv } : { method: 'upi', vpa: p.vpa });

export function PaymentForm({ value, onChange, errors = {} }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">Payment method</legend>
      <div className="mb-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Payment method">
        {[['card', 'Card'], ['upi', 'UPI']].map(([m, label]) => (
          <button key={m} type="button" role="radio" aria-checked={value.method === m} onClick={() => onChange({ ...value, method: m })}
            className={`rounded-lg border px-4 py-2.5 text-sm font-semibold ${value.method === m ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-slate-300 bg-white text-ink-700 hover:bg-slate-50'}`}>{label}</button>
        ))}
      </div>
      {value.method === 'card' ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Card number" error={errors['payment.number'] || errors.number} className="sm:col-span-2" required>
            {(p) => <input {...p} inputMode="numeric" autoComplete="cc-number" value={value.number} onChange={set('number')} placeholder="4242 4242 4242 4242" />}
          </Field>
          <Field label="Expiry (MM/YY)" error={errors['payment.expiry'] || errors.expiry} required>
            {(p) => <input {...p} autoComplete="cc-exp" value={value.expiry} onChange={set('expiry')} placeholder="12/30" />}
          </Field>
          <Field label="CVV" error={errors['payment.cvv'] || errors.cvv} required>
            {(p) => <input {...p} inputMode="numeric" autoComplete="cc-csc" type="password" value={value.cvv} onChange={set('cvv')} placeholder="123" />}
          </Field>
          <div className="sm:col-span-2">
            <p className="text-xs text-ink-500">Sandbox cards — click to fill:</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">{TEST_CARDS.map((c) => <button key={c.label} type="button" className="btn-secondary btn-sm" onClick={() => onChange({ ...value, number: c.number })}>{c.label}</button>)}</div>
          </div>
        </div>
      ) : (
        <div>
          <Field label="UPI ID" error={errors['payment.vpa'] || errors.vpa} hint="Demo: any id succeeds; one ending in @fail is declined." required>
            {(p) => <input {...p} value={value.vpa} onChange={set('vpa')} placeholder="name@okbank" />}
          </Field>
        </div>
      )}
      <p className="mt-3 text-xs text-ink-500">🔒 Simulated gateway: no real payment is made. Only the last 4 digits of a card are kept.</p>
    </fieldset>
  );
}

const blank = { label: 'Home', fullName: '', phone: '', line1: '', line2: '', city: '', state: '', postalCode: '', isDefault: false };

export function AddressForm({ initial, onSubmit, onCancel, submitLabel = 'Save address' }) {
  const [v, setV] = useState({ ...blank, ...(initial || {}) });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const set = (k) => (e) => setV({ ...v, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (v.fullName.trim().length < 2) next.fullName = 'Enter the recipient name';
    if (!/^[0-9+\-\s]{7,15}$/.test(v.phone.trim())) next.phone = 'Enter a valid phone number';
    if (v.line1.trim().length < 3) next.line1 = 'Enter the street address';
    if (!v.city.trim()) next.city = 'Enter the city';
    if (!v.state.trim()) next.state = 'Enter the state';
    if (!/^[0-9A-Za-z\- ]{4,10}$/.test(v.postalCode.trim())) next.postalCode = 'Enter a valid postal code';
    setErrors(next); setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const body = { label: v.label, fullName: v.fullName, phone: v.phone, line1: v.line1, city: v.city, state: v.state, postalCode: v.postalCode, isDefault: v.isDefault };
      if (v.line2.trim()) body.line2 = v.line2;
      await onSubmit(body);
    } catch (err) {
      const fe = {}; (err.details || []).forEach((d) => { fe[d.field] = d.message; });
      setErrors(fe); setFormError(Object.keys(fe).length ? '' : err.message);
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate className="grid gap-3 sm:grid-cols-2">
      {formError && <Alert className="sm:col-span-2">{formError}</Alert>}
      <Field label="Label" error={errors.label}>{(p) => <input {...p} value={v.label} onChange={set('label')} placeholder="Home / Work" />}</Field>
      <Field label="Full name" error={errors.fullName} required>{(p) => <input {...p} autoComplete="name" value={v.fullName} onChange={set('fullName')} />}</Field>
      <Field label="Phone" error={errors.phone} required>{(p) => <input {...p} autoComplete="tel" inputMode="tel" value={v.phone} onChange={set('phone')} />}</Field>
      <Field label="Postal code" error={errors.postalCode} required>{(p) => <input {...p} autoComplete="postal-code" value={v.postalCode} onChange={set('postalCode')} />}</Field>
      <Field label="Address line 1" error={errors.line1} className="sm:col-span-2" required>{(p) => <input {...p} autoComplete="address-line1" value={v.line1} onChange={set('line1')} />}</Field>
      <Field label="Address line 2" error={errors.line2} className="sm:col-span-2">{(p) => <input {...p} autoComplete="address-line2" value={v.line2} onChange={set('line2')} />}</Field>
      <Field label="City" error={errors.city} required>{(p) => <input {...p} autoComplete="address-level2" value={v.city} onChange={set('city')} />}</Field>
      <Field label="State" error={errors.state} required>{(p) => <input {...p} autoComplete="address-level1" value={v.state} onChange={set('state')} />}</Field>
      <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={v.isDefault} onChange={set('isDefault')} /> Make this my default address</label>
      <div className="flex justify-end gap-2 sm:col-span-2">
        {onCancel && <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button>}
        <button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
      </div>
    </form>
  );
}
