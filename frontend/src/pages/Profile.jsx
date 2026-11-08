import { useState } from 'react';
import { authApi } from '../api/services';
import { fieldErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { AddressForm } from '../components/forms';
import { Alert, ConfirmDialog, EmptyState, Field, Modal } from '../components/ui';

export default function Profile() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone || '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // address object | 'new'
  const [deleting, setDeleting] = useState(null);
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '' });
  const [pwErr, setPwErr] = useState('');

  const saveProfile = async (e) => {
    e.preventDefault(); setBusy(true); setErrors({});
    try { const body = { name: form.name }; if (form.phone.trim()) body.phone = form.phone; await authApi.updateMe(body); await refresh(); toast.success('Profile updated'); }
    catch (err) { setErrors(fieldErrors(err)); if (!Object.keys(fieldErrors(err)).length) toast.error(err.message); } finally { setBusy(false); }
  };
  const saveAddress = async (body) => { if (editing === 'new') await authApi.addAddress(body); else await authApi.updateAddress(editing._id, body); await refresh(); setEditing(null); toast.success('Address saved'); };
  const removeAddress = async () => { setBusy(true); try { await authApi.deleteAddress(deleting._id); await refresh(); toast.success('Address removed'); } catch (e) { toast.error(e.message); } finally { setBusy(false); setDeleting(null); } };
  const changePw = async (e) => { e.preventDefault(); setPwErr(''); try { await authApi.changePassword(pw); setPw({ currentPassword: '', newPassword: '' }); toast.success('Password changed'); } catch (err) { setPwErr(err.details?.[0]?.message || err.message); } };

  return (
    <div className="container-page grid gap-8 py-8 lg:grid-cols-[360px_1fr]">
      <div className="space-y-6">
        <section className="card p-5"><h1 className="mb-4 text-xl font-bold">My profile</h1>
          <form onSubmit={saveProfile} className="space-y-4" noValidate>
            <Field label="Email">{(p) => <input {...p} value={user.email} disabled readOnly />}</Field>
            <Field label="Full name" error={errors.name}>{(p) => <input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
            <Field label="Phone" error={errors.phone}>{(p) => <input {...p} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />}</Field>
            <button className="btn-primary" disabled={busy}>Save changes</button>
          </form>
        </section>
        <section className="card p-5"><h2 className="mb-4 text-lg font-bold">Change password</h2>
          <form onSubmit={changePw} className="space-y-4">{pwErr && <Alert>{pwErr}</Alert>}
            <Field label="Current password">{(p) => <input {...p} type="password" autoComplete="current-password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} />}</Field>
            <Field label="New password" hint="8+ characters with a letter and a number">{(p) => <input {...p} type="password" autoComplete="new-password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} />}</Field>
            <button className="btn-secondary" disabled={!pw.currentPassword || !pw.newPassword}>Update password</button>
          </form>
        </section>
      </div>
      <section aria-labelledby="ab">
        <div className="mb-4 flex items-center justify-between"><h2 id="ab" className="text-xl font-bold">Address book</h2><button className="btn-primary btn-sm" onClick={() => setEditing('new')}>+ Add address</button></div>
        {user.addresses.length === 0 ? <EmptyState icon="📍" title="No saved addresses" message="Add a delivery address to check out faster." action={<button className="btn-primary" onClick={() => setEditing('new')}>Add address</button>} /> : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {user.addresses.map((a) => (
              <li key={a._id} className="card p-4 text-sm">
                <div className="flex items-center justify-between"><span className="font-semibold">{a.fullName}</span><span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{a.label}{a.isDefault ? ' · Default' : ''}</span></div>
                <p className="mt-1 text-ink-700">{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.postalCode}<br />📞 {a.phone}</p>
                <div className="mt-3 flex gap-2"><button className="btn-secondary btn-sm" onClick={() => setEditing(a)}>Edit</button><button className="btn-ghost btn-sm text-rose-600" onClick={() => setDeleting(a)}>Delete</button></div>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Add address' : 'Edit address'} wide>{editing && <AddressForm initial={editing === 'new' ? null : editing} onSubmit={saveAddress} onCancel={() => setEditing(null)} />}</Modal>
      <ConfirmDialog open={!!deleting} danger title="Delete this address?" message="Past orders keep their own copy of the delivery address." confirmLabel="Delete" busy={busy} onConfirm={removeAddress} onCancel={() => setDeleting(null)} />
    </div>
  );
}
