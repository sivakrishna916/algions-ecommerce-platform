import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Alert, Field } from '../components/ui';
import { fieldErrors } from '../api/client';

function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="container-page flex min-h-[70vh] items-center justify-center py-12">
      <div className="card w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-ink-500">{subtitle}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-center text-sm text-ink-500">{footer}</p>
      </div>
    </div>
  );
}

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault(); setError(''); setErrors({});
    if (!form.email.trim() || !form.password) { setErrors({ email: !form.email.trim() ? 'Enter your email' : undefined, password: !form.password ? 'Enter your password' : undefined }); return; }
    setBusy(true);
    try {
      const u = await login(form.email.trim(), form.password);
      navigate(u.role === 'admin' ? '/admin' : location.state?.from || '/', { replace: true });
    } catch (err) { setError(err.message); setErrors(fieldErrors(err)); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Welcome back" subtitle="Log in to your account" footer={<>New here? <Link className="font-semibold text-brand-700" to="/register" state={location.state}>Create an account</Link></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Email" error={errors.email}>{(p) => <input {...p} type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />}</Field>
        <Field label="Password" error={errors.password}>{(p) => <input {...p} type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />}</Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Logging in…' : 'Log in'}</button>
      </form>
      <div className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-ink-500">
        <p className="font-semibold text-ink-700">Demo accounts (dummy data)</p>
        <button type="button" className="mt-1 block underline" onClick={() => setForm({ email: 'customer@demo.test', password: 'Customer@12345' })}>Fill customer login</button>
        <button type="button" className="block underline" onClick={() => setForm({ email: 'admin@demo.test', password: 'Admin@12345' })}>Fill admin login</button>
      </div>
    </AuthShell>
  );
}

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault(); setError('');
    const next = {};
    if (form.name.trim().length < 2) next.name = 'Enter your name';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email';
    if (form.password.length < 8 || !/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password)) next.password = 'At least 8 characters with a letter and a number';
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const body = { name: form.name.trim(), email: form.email.trim(), password: form.password };
      if (form.phone.trim()) body.phone = form.phone.trim();
      await register(body);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) { const fe = fieldErrors(err); setErrors(fe); setError(Object.keys(fe).length ? '' : err.message); } finally { setBusy(false); }
  };

  return (
    <AuthShell title="Create your account" subtitle="Start shopping in under a minute" footer={<>Already registered? <Link className="font-semibold text-brand-700" to="/login" state={location.state}>Log in</Link></>}>
      <form onSubmit={submit} noValidate className="space-y-4">
        {error && <Alert>{error}</Alert>}
        <Field label="Full name" error={errors.name} required>{(p) => <input {...p} autoComplete="name" value={form.name} onChange={set('name')} />}</Field>
        <Field label="Email" error={errors.email} required>{(p) => <input {...p} type="email" autoComplete="email" value={form.email} onChange={set('email')} />}</Field>
        <Field label="Phone (optional)" error={errors.phone}>{(p) => <input {...p} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />}</Field>
        <Field label="Password" error={errors.password} hint="At least 8 characters, with a letter and a number." required>{(p) => <input {...p} type="password" autoComplete="new-password" value={form.password} onChange={set('password')} />}</Field>
        <button className="btn-primary w-full" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
      </form>
    </AuthShell>
  );
}
