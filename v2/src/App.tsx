import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { Finance } from './pages/Finance';
import { Faucet } from './pages/Faucet';
import { Waitlist } from './pages/Waitlist';
import { NotFound } from './pages/NotFound';
import { Dashboard } from './pages/Dashboard';
import { Portfolio } from './pages/Portfolio';
import { AIAssistant } from './pages/AIAssistant';
import { WalletGenerator } from './pages/Walletgenerator';
import './App.css';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/faucet" element={<Faucet />} />
        <Route path="/waitlist" element={<Waitlist />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/portfolio" element={<Portfolio />} />
        <Route path="/wallet-gen" element={<WalletGenerator />} />
        <Route path="/ai" element={<AIAssistant />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
