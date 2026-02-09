import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { type FaucetItem } from '../types';
import { FaSearch, FaTint, FaExternalLinkAlt, FaLink } from 'react-icons/fa';

const FAUCET_DATA: FaucetItem[] = [
  {
    id: 'republicai',
    name: 'Republic AI Testnet',
    description: 'Connect Wallet dan Claim token RAI untuk pengujian di Republic AI Testnet',
    url: 'https://points.republicai.io/faucet',
    urlText: 'Request RAI',
    color: '#D9E9EF'
  },
  {
      id: 'mawari',
      name: 'Mawari Network Testnet',
      description: 'Dapatkan Faucet Native Token [MAWARI] di jaringan Mawari Network Testnet',
      url: 'https://hub.testnet.mawari.net/',
      urlText: 'Drip Mawari',
      color: '#01a2ff'
  },
  {
      id: 'giwa',
      name: 'Giwa Sepolia',
      description: 'Dapatkan ETH di jaringan Giwa Sepolia',
      url: 'https://faucet.giwa.io',
      urlText: 'Get Giwa ETH',
      color: '#2640a7'
  },
  {
      id: 'pharos',
      name: 'Pharos Testnet',
      description: 'Dapatkan PHRS di jaringan Pharos Testnet dari Zan, Bitget wallet & Okx wallet',
      color: '#1000f0',
      links: [
          { url: 'https://testnet.pharosnetwork.xyz/', text: 'Pharos Main Hub' },
          { url: 'https://zan.top/faucet/pharos', text: 'Zan Faucet' },
          { url: 'https://web3.okx.com/zh-hans/faucet/pharos/100013', text: 'OKX Faucet' },
          { url: 'https://newshare.bwb.global/en/earnCoinsTasks?uuid=6b728693-35b6-4892-9991-a45e63aaf2a1', text: 'Bitget Wallet' },
      ]
  },
  {
      id: 'monad',
      name: 'Monad Testnet',
      description: 'Dapatkan MON di jaringan Monad Testnet',
      color: '#836efd',
      links: [
          { url: 'https://faucet.monad.xyz/', text: 'Monad Official' },
          { url: 'https://www.gas.zip/faucet/monad', text: 'Gas Zip' },
          { url: 'https://faucet.trade/monad-testnet-mon-faucet', text: 'Faucet Trade' },
          { url: 'https://owlto.finance/Faucet/Monad', text: 'Owlto Finance' },
      ]
  },
  {
      id: 'sepolia',
      name: 'Sepolia ETH',
      description: 'Dapatkan ETH testnet di jaringan ETH Sepolia',
      color: '#9e9e9e',
      links: [
          { url: 'https://sepolia-faucet.pk910.de/', text: 'PoW Faucet' },
          { url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia', text: 'Google Cloud' },
          { url: 'https://sepoliafaucet.com/', text: 'Alchemy' },
          { url: 'https://faucet.quicknode.com/ethereum/sepolia', text: 'QuickNode' },
      ]
  },
  {
      id: 'holesky',
      name: 'Holesky ETH',
      description: 'Dapatkan ETH testnet di jaringan Holesky Testnet',
      url: 'https://holeskyfaucet.io/',
      urlText: 'Claim Holesky ETH',
      color: '#aa33ff'
  },
  {
      id: 'bnb',
      name: 'BNB Testnet',
      description: 'Dapatkan BNB testnet di jaringan BNB Testnet',
      color: '#F3BA2F',
      links: [
          { url: 'https://testnet.binance.org/faucet-smart', text: 'Binance Official' },
          { url: 'https://faucet.quicknode.com/binance/bnb-testnet', text: 'QuickNode' }
      ]
  },
  {
      id: 'mumbai',
      name: 'Mumbai (Polygon)',
      description: 'Dapatkan MATIC testnet untuk jaringan Mumbai (Polygon).',
      url: 'https://faucet.polygon.technology/',
      urlText: 'Polygon Faucet',
      color: '#8247E5'
  },
  {
      id: 'base',
      name: 'Base Goerli',
      description: 'Dapatkan ETH testnet di jaringan Base Goerli',
      url: 'https://faucet.quicknode.com/base/goerli',
      urlText: 'Get Base ETH',
      color: '#0052FF'
  },
  {
      id: 'arbitrum',
      name: 'Arbitrum Sepolia',
      description: 'Dapatkan ETH testnet di jaringan Arbitrum Sepolia.',
      url: 'https://faucet.triangleplatform.com/arbitrum/sepolia',
      urlText: 'Arbitrum Faucet',
      color: '#28A0F0'
  }
];

export const Faucet: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredFaucets = FAUCET_DATA.filter(f => 
    f.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    f.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="app-container">
      <header>
        <h1>
          <FaTint style={{marginRight: '10px', color: '#ffffff'}}/>
          Info Faucet
        </h1>
      </header>
      <Navbar />
      
      <div className="faucet-container">
        <div className="search-filter-bar" style={{marginBottom: '25px'}}>
           <div className="search-input-wrapper">
               <FaSearch className="search-icon" />
               <input 
                type="search" 
                placeholder="Cari network (Monad, Sepolia, etc)..." 
                className="search-faucet"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                style={{ color: '#ffffff' }}
              />
           </div>
        </div>

        <div className="faucet-list" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
          {filteredFaucets.length > 0 ? filteredFaucets.map(f => (
            <div key={f.id} className="faucet-item" style={{
                border: '1px solid #333',
                borderLeft: `5px solid ${(f as any).color || '#fff'}`,
                padding: '20px', 
                backgroundColor: '#111', 
                display: 'flex', 
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'transform 0.2s'
            }}>
              <div>
                <h3 style={{marginTop: 0, fontSize: '1.2em',display: 'inline-block',padding: '4px 12px',backgroundColor: `${f.color}22`,
                color: f.color || '#01a2ff',borderLeft: `3px solid ${f.color || '#01a2ff'}`,borderRadius: '4px',marginBottom: '10px'}}>{f.name}</h3>
                <p style={{fontSize: '0.9em', color: '#bbb', lineHeight: '1.5', minHeight: '45px'}}>
                    {f.description}
                </p>
              </div>
              
              <div style={{marginTop: '15px'}}>
                {f.links ? (
                  <div style={{position: 'relative'}}>
                      <FaLink style={{position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#000', zIndex: 1}} />
                      <select 
                        style={{
                            width: '100%', 
                            padding: '12px 10px 12px 40px', 
                            cursor: 'pointer', 
                            backgroundColor: '#ffffff', 
                            color: '#000000',
                            fontWeight: 'bold',
                            border: 'none',
                            borderRadius: '4px'
                        }}
                        onChange={(e) => { if(e.target.value) window.open(e.target.value, '_blank') }}
                        value=""
                      >
                        <option value="" disabled>SELECT SOURCE</option>
                        {f.links.map((l, idx) => (
                            <option key={idx} value={l.url}>
                                {l.text}
                            </option>
                        ))}
                      </select>
                  </div>
                ) : (
                  <a href={f.url} target="_blank" rel="noreferrer" className="btn-manage btn-export" style={{
                      display:'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      width: '100%', 
                      boxSizing: 'border-box',
                      textDecoration: 'none',
                      padding: '12px',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                   }}>
                    <FaExternalLinkAlt style={{marginRight: '8px'}} /> {f.urlText}
                  </a>
                )}
              </div>
            </div>
          )) : (
              <div style={{gridColumn: '1 / -1', textAlign: 'center', padding: '40px', color: '#888', border: '1px dashed #444'}}>
                  <p>Tidak ditemukan.</p>
              </div>
          )}
        </div>
      </div>
      
      <footer className="app-footer" style={{marginTop: '40px', textAlign: 'center', color: '#666', fontSize: '0.8em'}}>
        Powered by IAC Community
      </footer>
    </div>
  );
};
