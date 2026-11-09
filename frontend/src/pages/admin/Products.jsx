import { useState } from 'react';
import { adminApi } from '../../api/services';
import { fieldErrors } from '../../api/client';
import useFetch from '../../utils/useFetch';
import { useToast } from '../../context/ToastContext';
import ProductImage from '../../components/ProductImage';
import { Alert, ConfirmDialog, EmptyState, ErrorState, Field, Modal, Pagination, Spinner } from '../../components/ui';
import { formatMoney, paiseToRupees, rupeesToPaise } from '../../utils/format';
import { PageHeader } from './Dashboard';

const blankVariant = () => ({ sku: '', label: '', price: '', mrp: '', stock: '0', existing: false });

function ProductForm({ product, categories, onSaved, onCancel }) {
  const editing = !!product;
  const [f, setF] = useState(() => ({
    name: product?.name || '', brand: product?.brand || '', category: product?.category?._id || '', description: product?.description || '',
    images: (product?.images || []).join('\n'), tags: (product?.tags || []).join(', '), isActive: product?.isActive ?? true,
    variants: product ? product.variants.map((v) => ({ sku: v.sku, label: v.label, price: String(paiseToRupees(v.price)), mrp: v.mrp ? String(paiseToRupees(v.mrp)) : '', stock: String(v.stock), existing: true })) : [blankVariant()],
  }));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setVariant = (i, k, v) => setF({ ...f, variants: f.variants.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)) });

  const submit = async (e) => {
    e.preventDefault(); setFormError('');
    const local = {};
    if (f.name.trim().length < 2) local.name = 'Enter a product name';
    if (!f.category) local.category = 'Choose a category';
    const skus = f.variants.map((v) => v.sku.trim().toUpperCase());
    f.variants.forEach((v, i) => {
      if (v.sku.trim().length < 2) local[`variants.${i}.sku`] = 'SKU required';
      else if (skus.indexOf(v.sku.trim().toUpperCase()) !== i) local[`variants.${i}.sku`] = 'Duplicate SKU';
      if (!v.label.trim()) local[`variants.${i}.label`] = 'Label required';
      if (!(Number(v.price) > 0)) local[`variants.${i}.price`] = 'Price must be > 0';
      if (v.mrp !== '' && Number(v.mrp) < Number(v.price)) local[`variants.${i}.mrp`] = 'MRP must be ≥ price';
      if (!v.existing && (!Number.isInteger(Number(v.stock)) || Number(v.stock) < 0)) local[`variants.${i}.stock`] = 'Whole number ≥ 0';
    });
    setErrors(local);
    if (Object.keys(local).length) return;
    const body = {
      name: f.name.trim(), brand: f.brand.trim() || undefined, category: f.category, description: f.description.trim(), isActive: f.isActive,
      images: f.images.split('\n').map((s) => s.trim()).filter(Boolean), tags: f.tags.split(',').map((s) => s.trim()).filter(Boolean),
      variants: f.variants.map((v) => ({ sku: v.sku.trim(), label: v.label.trim(), price: rupeesToPaise(v.price), ...(v.mrp !== '' ? { mrp: rupeesToPaise(v.mrp) } : {}), stock: Number(v.stock) || 0 })),
    };
    setBusy(true);
    try { const r = editing ? await adminApi.updateProduct(product._id, body) : await adminApi.createProduct(body); onSaved(r.product, editing); }
    catch (err) { const fe = fieldErrors(err); setErrors(fe); setFormError(Object.keys(fe).length ? 'Please fix the highlighted fields.' : err.message); } finally { setBusy(false); }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {formError && <Alert>{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name} required className="sm:col-span-2">{(p) => <input {...p} value={f.name} onChange={set('name')} />}</Field>
        <Field label="Brand" error={errors.brand}>{(p) => <input {...p} value={f.brand} onChange={set('brand')} />}</Field>
        <Field label="Category" error={errors.category} required>{(p) => <select {...p} value={f.category} onChange={set('category')}><option value="">Select…</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>}</Field>
        <Field label="Description" error={errors.description} className="sm:col-span-2">{(p) => <textarea {...p} rows={3} value={f.description} onChange={set('description')} />}</Field>
        <Field label="Image URLs or /paths (one per line)" error={errors.images} hint="e.g. /products/my-item.svg or https://…" className="sm:col-span-2">{(p) => <textarea {...p} rows={2} value={f.images} onChange={set('images')} />}</Field>
        <Field label="Tags (comma separated)" error={errors.tags}>{(p) => <input {...p} value={f.tags} onChange={set('tags')} />}</Field>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={f.isActive} onChange={set('isActive')} /> Visible in the store</label>
      </div>

      <fieldset className="rounded-xl border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">Variants (price in ₹)</legend>
        {editing && <p className="mb-3 text-xs text-ink-500">Stock of existing variants is changed with <b>Adjust stock</b> so edits can never overwrite stock that changed because of orders.</p>}
        <div className="space-y-3">
          {f.variants.map((v, i) => (
            <div key={i} className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-6">
              <Field label="SKU" error={errors[`variants.${i}.sku`]} className="sm:col-span-1">{(p) => <input {...p} disabled={v.existing} value={v.sku} onChange={(e) => setVariant(i, 'sku', e.target.value)} />}</Field>
              <Field label="Label" error={errors[`variants.${i}.label`]} className="sm:col-span-2">{(p) => <input {...p} value={v.label} onChange={(e) => setVariant(i, 'label', e.target.value)} />}</Field>
              <Field label="Price ₹" error={errors[`variants.${i}.price`]}>{(p) => <input {...p} inputMode="decimal" value={v.price} onChange={(e) => setVariant(i, 'price', e.target.value)} />}</Field>
              <Field label="MRP ₹" error={errors[`variants.${i}.mrp`]}>{(p) => <input {...p} inputMode="decimal" value={v.mrp} onChange={(e) => setVariant(i, 'mrp', e.target.value)} />}</Field>
              <Field label={v.existing ? 'Stock' : 'Opening stock'} error={errors[`variants.${i}.stock`]}>{(p) => <input {...p} inputMode="numeric" disabled={v.existing} value={v.stock} onChange={(e) => setVariant(i, 'stock', e.target.value)} />}</Field>
              {!v.existing && f.variants.length > 1 && <button type="button" className="btn-ghost btn-sm col-span-2 text-rose-600 sm:col-span-6" onClick={() => setF({ ...f, variants: f.variants.filter((_, idx) => idx !== i) })}>Remove variant</button>}
            </div>
          ))}
        </div>
        {errors.variants && <p className="mt-2 text-xs font-medium text-rose-600">{errors.variants}</p>}
        <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => setF({ ...f, variants: [...f.variants, blankVariant()] })}>+ Add variant</button>
      </fieldset>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Create product'}</button></div>
    </form>
  );
}

function StockDialog({ product, onClose, onDone }) {
  const toast = useToast();
  const [sku, setSku] = useState(product.variants[0].sku);
  const [delta, setDelta] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const current = product.variants.find((v) => v.sku === sku);
  const n = Number(delta);
  const valid = Number.isInteger(n) && n !== 0;
  const submit = async (e) => {
    e.preventDefault(); setErr('');
    if (!valid) return setErr('Enter a whole number other than 0 (use a minus sign to remove stock).');
    setBusy(true);
    try { await adminApi.adjustStock(product._id, { sku, delta: n, reason: reason.trim() || undefined }); toast.success(`Stock updated for ${sku}`); onDone(); }
    catch (e2) { setErr(e2.message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {err && <Alert>{err}</Alert>}
      <Field label="Variant">{(p) => <select {...p} value={sku} onChange={(e) => setSku(e.target.value)}>{product.variants.map((v) => <option key={v.sku} value={v.sku}>{v.label} ({v.sku}) — {v.stock} in stock</option>)}</select>}</Field>
      <Field label="Change (+ add / − remove)" hint={valid ? `New stock will be ${current.stock + n}` : 'e.g. 25 to receive a shipment, -3 for damaged units'}>{(p) => <input {...p} inputMode="numeric" value={delta} onChange={(e) => setDelta(e.target.value)} />}</Field>
      <Field label="Reason (optional)">{(p) => <input {...p} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="New shipment, stock take, damaged…" />}</Field>
      <p className="text-xs text-ink-500">The server applies this atomically and refuses any change that would make stock negative.</p>
      <div className="flex justify-end gap-2"><button type="button" className="btn-secondary" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={busy}>{busy ? 'Applying…' : 'Apply change'}</button></div>
    </form>
  );
}

export default function Products() {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [lowStock, setLowStock] = useState(false);
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const cats = useFetch(() => adminApi.categories(), []);
  const { data, loading, error, reload } = useFetch(() => adminApi.products({ q: search || undefined, status, category: category || undefined, lowStock: lowStock ? 'true' : undefined, page, limit: 10 }), [search, status, lowStock, category, page]);
  const [form, setForm] = useState(null); // 'new' | product
  const [stock, setStock] = useState(null);
  const [del, setDel] = useState(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => { setBusy(true); try { await adminApi.deleteProduct(del._id); toast.success('Product removed from the store'); setDel(null); reload(); } catch (e) { toast.error(e.message); } finally { setBusy(false); } };
  const totalStock = (p) => p.variants.reduce((s, v) => s + v.stock, 0);

  return (
    <>
      <PageHeader title="Products & inventory" subtitle="Create products, edit details and adjust stock." actions={<button className="btn-primary" onClick={() => setForm('new')} disabled={!cats.data}>+ New product</button>} />
      <div className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <form className="min-w-[200px] flex-1" role="search" onSubmit={(e) => { e.preventDefault(); setSearch(q.trim()); setPage(1); }}>
          <label htmlFor="psearch" className="mb-1 block text-xs font-medium text-ink-500">Search name, brand or SKU</label>
          <div className="flex gap-2"><input id="psearch" className="input" value={q} onChange={(e) => setQ(e.target.value)} /><button className="btn-secondary">Search</button></div>
        </form>
        <div><label htmlFor="pcat" className="mb-1 block text-xs font-medium text-ink-500">Category</label><select id="pcat" className="input" value={category} onChange={(e) => { setCategory(e.target.value); setPage(1); }}><option value="">All</option>{cats.data?.categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select></div>
        <div><label htmlFor="pstat" className="mb-1 block text-xs font-medium text-ink-500">Status</label><select id="pstat" className="input" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}><option value="all">All</option><option value="active">Active</option><option value="inactive">Inactive</option></select></div>
        <label className="flex items-center gap-2 pb-2.5 text-sm"><input type="checkbox" className="h-4 w-4 rounded border-slate-300 text-brand-600" checked={lowStock} onChange={(e) => { setLowStock(e.target.checked); setPage(1); }} /> Low stock only</label>
      </div>

      {error ? <ErrorState error={error} onRetry={reload} /> : loading ? <Spinner /> : data.products.length === 0 ? <EmptyState icon="📭" title="No products match" message="Try different filters or create a new product." /> : (
        <div className="card overflow-hidden"><div className="overflow-x-auto"><table className="min-w-full divide-y divide-slate-100">
          <thead className="bg-slate-50"><tr><th className="th">Product</th><th className="th">Category</th><th className="th">Price</th><th className="th">Stock</th><th className="th">Status</th><th className="th text-right">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{data.products.map((p) => (
            <tr key={p._id} className={p.isActive ? '' : 'bg-slate-50/70 text-ink-500'}>
              <td className="td"><div className="flex items-center gap-3"><ProductImage src={p.images[0]} alt="" className="h-11 w-11 shrink-0 rounded-lg" /><div className="min-w-0"><p className="truncate font-medium text-ink-900">{p.name}</p><p className="text-xs text-ink-500">{p.variants.length} variant{p.variants.length > 1 ? 's' : ''} · {p.variants.map((v) => v.sku).join(', ').slice(0, 40)}</p></div></div></td>
              <td className="td">{p.category?.name}</td><td className="td">{formatMoney(p.minPrice)}{p.variants.length > 1 && '+'}</td>
              <td className="td"><span className={`font-semibold ${totalStock(p) === 0 ? 'text-rose-600' : p.variants.some((v) => v.stock <= 5) ? 'text-amber-600' : ''}`}>{totalStock(p)}</span></td>
              <td className="td">{p.isActive ? <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">Active</span> : <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold">Inactive</span>}</td>
              <td className="td"><div className="flex justify-end gap-1.5"><button className="btn-secondary btn-sm" onClick={() => setStock(p)}>Adjust stock</button><button className="btn-secondary btn-sm" onClick={() => setForm(p)}>Edit</button>{p.isActive && <button className="btn-ghost btn-sm text-rose-600" onClick={() => setDel(p)}>Remove</button>}</div></td>
            </tr>
          ))}</tbody>
        </table></div></div>
      )}
      {data && <Pagination meta={data.meta} onPage={setPage} />}

      <Modal open={!!form} onClose={() => setForm(null)} title={form === 'new' ? 'New product' : 'Edit product'} wide>
        {form && <ProductForm product={form === 'new' ? null : form} categories={cats.data?.categories || []} onCancel={() => setForm(null)} onSaved={(p, wasEdit) => { toast.success(wasEdit ? 'Product updated' : 'Product created'); setForm(null); reload(); }} />}
      </Modal>
      <Modal open={!!stock} onClose={() => setStock(null)} title={stock ? `Adjust stock — ${stock.name}` : ''}>{stock && <StockDialog product={stock} onClose={() => setStock(null)} onDone={() => { setStock(null); reload(); }} />}</Modal>
      <ConfirmDialog open={!!del} danger title="Remove from store?" message={del ? `“${del.name}” will be hidden from customers. Existing orders keep their history, and you can re-activate it later by editing the product.` : ''} confirmLabel="Remove" busy={busy} onConfirm={remove} onCancel={() => setDel(null)} />
    </>
  );
}
