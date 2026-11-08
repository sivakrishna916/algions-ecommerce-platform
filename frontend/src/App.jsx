import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { CustomerLayout } from './components/Layouts';
import { RequireAuth } from './components/RouteGuards';
import { Spinner } from './components/ui';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Profile from './pages/Profile';
import { Login, Register } from './pages/Auth';
import NotFound from './pages/NotFound';

// The admin area is a separate bundle: customers never download it.
const AdminRoutes = lazy(() => import('./pages/admin/AdminRoutes'));

export default function App() {
  return (
    <Routes>
      <Route element={<CustomerLayout />}>
        <Route index element={<Home />} />
        <Route path="products" element={<Catalog />} />
        <Route path="products/:slug" element={<ProductDetail />} />
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route element={<RequireAuth role="customer" />}>
          <Route path="cart" element={<Cart />} />
          <Route path="checkout" element={<Checkout />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="profile" element={<Profile />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Route>
      <Route element={<RequireAuth role="admin" />}>
        <Route path="admin/*" element={<Suspense fallback={<Spinner label="Loading admin…" className="min-h-screen" />}><AdminRoutes /></Suspense>} />
      </Route>
    </Routes>
  );
}
