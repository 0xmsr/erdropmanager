import { Link } from 'react-router-dom';

export const Navbar = () => {
  return (
    <div className="navigation-buttons" style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
      <Link to="/"><button>Garapan (Home)</button></Link>
      <Link to="/waitlist"><button>Waitlist</button></Link>
      <Link to="/finance"><button>Keuangan</button></Link>
      <Link to="/faucet"><button>Faucet</button></Link>
    </div>
  );
};
