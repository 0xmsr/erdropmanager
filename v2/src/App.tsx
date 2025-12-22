import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Finance } from './pages/Finance';
import { Faucet } from './pages/Faucet';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/faucet" element={<Faucet />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;