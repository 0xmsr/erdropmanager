import { Link, useLocation } from 'react-router-dom';

export const Navbar = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    return location.pathname === path ? 'active-nav' : '';
  };

  return (
    <div className="navigation-buttons" style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
      <Link to="/">
        <button className={isActive('/')}>Garapan (Home)</button>
      </Link>
      <Link to="/waitlist">
        <button className={isActive('/waitlist')}>Waitlist</button>
      </Link>
      <Link to="/finance">
        <button className={isActive('/finance')}>Keuangan</button>
      </Link>
      <Link to="/faucet">
        <button className={isActive('/faucet')}>Faucet</button>
      </Link>
    </div>
  );
};
