import { useState } from 'react';
import { adminApi } from '../../api/services';
import { fieldErrors } from '../../api/client';
import useFetch from '../../utils/useFetch';
import { useToast } from '../../context/ToastContext';
import { Alert, ConfirmDialog, EmptyState, ErrorState, Field, Modal, Spinner } from '../../components/ui';
import { PageHeader } from './Dashboard';

export default function Categories() {
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(() => adminApi.categories(), []);
  const [edit, setEdit] = useState(null); // 'new' | category
  const [form, setForm] = useState({ name: '', description: '', isActive: true });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [del, setDel] = useState(null);
  const [delError, setDelError] = useState('');
  const [busy, setBusy] = useState(false);

  const open = (c) => { setEdit(c); setErrors({}); setFormError(''); setForm(c === 'new' ? { name: '', description: '', isActive: true } : { name: c.name, description: c.description || '', isActive: c.isActive }); };
  const save = async (e) => {
    e.preventDefault(); setErrors({}); setFormError('');
    if (form.name.trim().length < 2) return setErrors({ name: 'Enter a category name' });
    setBusy(true);
    const body = { name: form.name.trim(), description: form.description.trim() || undefined, isActive: form.isActive };
    try { if (edit === 'new') await adminApi.createCategory(body); else await adminApi.updateCategory(edit._id, body); toast.success('Category saved'); setEdit(null); reload(); }
    catch (err) { const fe = fieldErrors(err); setErrors(fe); setFormError(Object.keys(fe).length ? '' : err.message); } finally { setBusy(false); }
  };
  const remove = async () => { setBusy(true); setDelError(''); try { await adminApi.deleteCategory(del._id); toast.success('Category deleted'); setDel(null); reload(); } catch (e) { setDelError(e.message); } finally { setBusy(false); } };

  return (
    <>
      <PageHeader title="Categories" subtitle="Group products so customers can browse and filter." actions={<button className="btn-primary" onClick={() => open('new')}>+ New category</button>} />
      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <Spinner /> : data.categories.length === 0 ? <EmptyState icon="🗂️" title="No categories yet" /> : (
        <div className="card overflow-hidden"><table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr><th className="th">Name</th><th className="th">Slug</th><th className="th">Products</th><th className="th">Status</th><th className="th text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.categories.map((c) => (
            <tr key={c._id}><td className="td"><p className="font-medium text-ink-900">{c.name}</p><p className="text-xs text-ink-500">{c.description}</p></td><td className="td font-mono text-xs">{c.slug}</td><td className="td">{c.productCount}</td>
              <td className="td">{c.isActive ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span> : <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold">Hidden</span>}</td>
              <td className="td"><div className="flex justify-end gap-1.5"><button className="btn-secondary btn-sm" onClick={() => open(c)}>Edit</button><button className="btn-ghost btn-sm text-rose-600" onClick={() => { setDelError(''); setDel(c); }}>Delete</button></div></td></tr>
          ))}</tbody>
        </table></div>
      )}
      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit === 'new' ? 'New category' : 'Edit category'}>
        <form onSubmit={save} noValidate className="space-y-4">
          {formError && <Alert>{formError}</Alert>}
          <Field label="Name" error={errors.name} required>{(p) => <input {...p} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />}</Field>
          <Field label="Description" error={errors.description}>{(p) => <input {...p} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />}</Field>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Visible in the store</label>
          <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" disabled={busy}>Save</button></div>
        </form>
      </Modal>
      <ConfirmDialog open={!!del} danger title="Delete category?" confirmLabel="Delete" busy={busy} onConfirm={remove} onCancel={() => setDel(null)}
        message={<>{del && `“${del.name}” will be permanently deleted. `}{delError && <span className="mt-2 block font-semibold text-rose-600" role="alert">{delError}</span>}</>} />
    </>
  );
}
