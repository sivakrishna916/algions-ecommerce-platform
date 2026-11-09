import { useState } from 'react';
import { NavLink, Navigate, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Dashboard from './Dashboard';
import Products from './Products';
import Categories from './Categories';
import Orders from './Orders';
import Customers from './Customers';
import Reports from './Reports';
import AuditLogs from './AuditLogs';

const NAV = [
  ['', 'Dashboard', '📊'], ['orders', 'Orders', '📦'], ['products', 'Products & stock', '🏷️'], ['categories', 'Categories', '🗂️'],
  ['customers', 'Customers', '👥'], ['reports', 'Reports', '📈'], ['audit', 'Audit log', '🧾'],
];

function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const link = ({ isActive }) => `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${isActive ? 'bg-brand-600 text-white' : 'text-slate-300 hover:bg-slate-800 hover:text-white'}`;
  const nav = (
    <nav aria-label="Admin" className="space-y-1">
      {NAV.map(([to, label, icon]) => <NavLink key={to} to={to === '' ? '/admin' : `/admin/${to}`} end={to === ''} className={link} onClick={() => setOpen(false)}><span aria-hidden="true">{icon}</span>{label}</NavLink>)}
    </nav>
  );
  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">Skip to content</a>
      <aside className="hidden w-64 shrink-0 flex-col bg-slate-900 p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2 px-2 text-lg font-extrabold text-white"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">A</span> Admin Console</div>
        {nav}
        <div className="mt-auto border-t border-slate-800 pt-4 text-sm text-slate-300">
          <p className="truncate font-semibold text-white">{user.name}</p><p className="truncate text-xs">{user.email}</p>
          <div className="mt-3 flex gap-2"><button className="btn-secondary btn-sm flex-1" onClick={() => navigate('/')}>View store</button><button className="btn btn-sm flex-1 bg-slate-800 text-white hover:bg-slate-700" onClick={() => { logout(); navigate('/login'); }}>Log out</button></div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white lg:hidden">
          <span className="font-extrabold">Admin Console</span>
          <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label="Toggle menu" className="rounded-lg p-2 hover:bg-slate-800">☰</button>
        </header>
        {open && <div className="bg-slate-900 p-3 lg:hidden">{nav}<button className="mt-3 w-full rounded-lg bg-slate-800 py-2 text-sm text-white" onClick={() => { logout(); navigate('/login'); }}>Log out</button></div>}
        <main id="admin-main" className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8"><Outlet /></main>
      </div>
    </div>
  );
}

export default function AdminRoutes() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="orders" element={<Orders />} />
        <Route path="products" element={<Products />} />
        <Route path="categories" element={<Categories />} />
        <Route path="customers" element={<Customers />} />
        <Route path="reports" element={<Reports />} />
        <Route path="audit" element={<AuditLogs />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}
