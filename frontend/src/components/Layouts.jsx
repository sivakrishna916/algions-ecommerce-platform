import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-ink-900">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white" aria-hidden="true">A</span>
      Algions<span className="text-brand-600">Store</span>
    </Link>
  );
}

function SearchBox({ className = '' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  return (
    <form role="search" className={className} onSubmit={(e) => { e.preventDefault(); navigate(`/products${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`); }}>
      <label htmlFor="site-search" className="sr-only">Search products</label>
      <div className="relative">
        <input id="site-search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search for products, brands…" className="input pl-10" />
        <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" strokeLinecap="round" /></svg>
      </div>
    </form>
  );
}

export function CustomerLayout() {
  const { user, logout, isAdmin } = useAuth();
  const { cart } = useCart();
  const navigate = useNavigate();
  const [menu, setMenu] = useState(false);
  const link = ({ isActive }) => `rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-700 hover:bg-slate-100'}`;
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[200] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-lift">Skip to content</a>
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="container-page flex h-16 items-center gap-4">
          <Logo />
          <SearchBox className="mx-4 hidden max-w-xl flex-1 md:block" />
          <nav aria-label="Main" className="ml-auto flex items-center gap-1">
            <NavLink to="/products" className={link}>Shop</NavLink>
            {user && !isAdmin && <NavLink to="/orders" className={link}>Orders</NavLink>}
            {isAdmin && <NavLink to="/admin" className={link}>Admin</NavLink>}
            {!isAdmin && (
              <Link to="/cart" className="relative rounded-lg p-2 text-ink-700 hover:bg-slate-100" aria-label={`Cart, ${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}`}>
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.76L20 8H6.2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="9.5" cy="20" r="1.3" /><circle cx="17" cy="20" r="1.3" /></svg>
                {cart.itemCount > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white">{cart.itemCount}</span>}
              </Link>
            )}
            {user ? (
              <div className="relative">
                <button onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu" className="flex items-center gap-2 rounded-lg p-1.5 hover:bg-slate-100">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">{user.name[0].toUpperCase()}</span>
                  <span className="sr-only">Account menu</span>
                </button>
                {menu && (
                  <div role="menu" className="absolute right-0 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lift" onClick={() => setMenu(false)}>
                    <div className="border-b border-slate-100 px-3 py-2"><p className="truncate text-sm font-semibold">{user.name}</p><p className="truncate text-xs text-ink-500">{user.email}</p></div>
                    {!isAdmin && <Link role="menuitem" to="/profile" className="mt-1 block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">Profile & addresses</Link>}
                    {!isAdmin && <Link role="menuitem" to="/orders" className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-100">My orders</Link>}
                    <button role="menuitem" className="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" onClick={() => { logout(); navigate('/'); }}>Log out</button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link to="/login" className="btn-ghost btn-sm">Log in</Link>
                <Link to="/register" className="btn-primary btn-sm hidden sm:inline-flex">Sign up</Link>
              </>
            )}
          </nav>
        </div>
        <div className="container-page pb-3 md:hidden"><SearchBox /></div>
      </header>
      <main id="main" className="flex-1"><Outlet /></main>
      <footer className="mt-16 border-t border-slate-200 bg-white">
        <div className="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div><Logo /><p className="mt-3 text-sm text-ink-500">A full-stack e-commerce demo built for the Algions AI Labs internship assessment.</p></div>
          <div><h3 className="text-sm font-semibold">Shop</h3><ul className="mt-3 space-y-2 text-sm text-ink-500"><li><Link className="hover:text-brand-700" to="/products">All products</Link></li><li><Link className="hover:text-brand-700" to="/products?sort=popular">Best sellers</Link></li></ul></div>
          <div><h3 className="text-sm font-semibold">Account</h3><ul className="mt-3 space-y-2 text-sm text-ink-500"><li><Link className="hover:text-brand-700" to="/orders">Track orders</Link></li><li><Link className="hover:text-brand-700" to="/profile">Addresses</Link></li></ul></div>
          <div><h3 className="text-sm font-semibold">Demo notice</h3><p className="mt-3 text-sm text-ink-500">Payments are simulated. No real money moves and no real card data is stored.</p></div>
        </div>
        <div className="border-t border-slate-100 py-4 text-center text-xs text-ink-500">© {new Date().getFullYear()} Algions Store (assessment project)</div>
      </footer>
    </div>
  );
}
