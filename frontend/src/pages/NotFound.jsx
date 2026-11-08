import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return <div className="container-page py-16"><EmptyState icon="🧭" title="Page not found" message="The page you are looking for does not exist or has moved." action={<Link to="/" className="btn-primary">Go home</Link>} /></div>;
}
