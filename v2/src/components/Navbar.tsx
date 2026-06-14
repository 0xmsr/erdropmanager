import { Link, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { path: '/',      label: '⌂ Intro' },
  { path: '/home',           label: 'Home' },
  { path: '/waitlist',   label: 'Waitlist' },
  { path: '/finance',    label: 'Keuangan' },
  { path: '/faucet',     label: 'Faucet' },
  { path: '/portfolio',  label: 'Portfolio' },
  { path: '/ai',         label: '✦ AI' },
  { path: '/dashboard',  label: 'Dashboard' },
  { path: '/wallet-gen', label: 'WalletGen' },
];

export const Navbar = () => {
  const location = useLocation();

  return (
    <nav className="navigation-buttons" aria-label="Main navigation">
      {NAV_ITEMS.map(({ path, label }) => {
        const active = location.pathname === path;
        const isAI = label.startsWith('✦');
        return (
          <Link key={path} to={path} style={{ textDecoration: 'none', flexShrink: 0 }}>
            <button
              className={active ? 'active-nav' : ''}
              aria-current={active ? 'page' : undefined}
              style={
                isAI && !active
                  ? { color: '#01a2ff', borderColor: 'rgba(1,162,255,0.35)' }
                  : undefined
              }
            >
              {label}
            </button>
          </Link>
        );
      })}
    </nav>
  );
};
