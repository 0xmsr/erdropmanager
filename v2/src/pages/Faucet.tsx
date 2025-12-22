import React, { useState } from 'react';
import { Navbar } from '../components/Navbar';
import { type FaucetItem } from '../types';

const FAUCET_DATA: FaucetItem[] = [
  {
            id: 'mawari',
            name: 'Mawari Network Testnet',
            description: 'Dapatkan Faucet Native Token [MAWARI] di jaringan Mawari Network Testnet',
            url: 'https://hub.testnet.mawari.net/',
            urlText: 'Kunjungi hub.testnet.mawari.net'
        },
        {
            id: 'giwa',
            name: 'Giwa Sepolia',
            description: 'Dapatkan ETH di jaringan Giwa Sepolia',
            url: 'https://faucet.giwa.io',
            urlText: 'Kunjungi faucet.giwa.io'
        },
        {
            id: 'pharos',
            name: 'Pharos Testnet',
            description: 'Dapatkan PHRS di jaringan Pharos Testnet dari Zan, Bitget wallet & Okx wallet',
            links: [
                { url: 'https://testnet.pharosnetwork.xyz/', text: 'Kunjungi testnet.pharosnetwork.xyz' },
                { url: 'https://zan.top/faucet/pharos', text: 'Kunjungi zan.top' },
                { url: 'https://web3.okx.com/zh-hans/faucet/pharos/100013', text: 'Kunjungi web3.okx.com' },
                { url: 'https://newshare.bwb.global/en/earnCoinsTasks?uuid=6b728693-35b6-4892-9991-a45e63aaf2a1&_nocache=true&_nobar=true&deeplink=true&_needChain=eth', text: 'Kunjungi newshare.bwb.global' },
            ]
        },
        {
            id: 'monad',
            name: 'Monad Testnet',
            description: 'Dapatkan MON di jaringan Monad Testnet',
            links: [
                { url: 'https://faucet.monad.xyz/', text: 'Kunjungi faucet.monad.xyz' },
                { url: 'https://www.gas.zip/faucet/monad', text: 'Kunjungi gas.zip' },
                { url: 'https://faucet.trade/monad-testnet-mon-faucet', text: 'Kunjungi faucet.trade' },
                { url: 'https://owlto.finance/Faucet/Monad', text: 'Kunjungi owlto.finance' },
            ]
        },
        {
            id: 'sepolia',
            name: 'Sepolia ETH',
            description: 'Dapatkan ETH testnet di jaringan ETH Sepolia',
            links: [
                { url: 'https://sepolia-faucet.pk910.de/', text: 'Kunjungi sepolia-faucet.pk910.de' },
                { url: 'https://cloud.google.com/application/web3/faucet/ethereum/sepolia', text: 'Kunjungi cloud.google.com' },
                { url: 'https://sepoliafaucet.com/', text: 'Kunjungi alchemy.com' },
                { url: 'https://faucet.quicknode.com/ethereum/sepolia', text: 'Kunjungi quicknode.com' },
                { url: 'https://faucet.triangleplatform.com/ethereum/sepolia', text: 'Kunjungi triangleplatform.com' },
            ]
        },
        {
            id: 'holesky',
            name: 'Holesky ETH',
            description: 'Dapatkan ETH testnet di jaringan Holesky Testnet',
            url: 'https://holeskyfaucet.io/',
            urlText: 'Kunjungi holeskyFaucet.io'
        },
        {
            id: 'goerli',
            name: 'Goerli ETH',
            description: 'Dapatkan ETH testnet di jaringan ETH Goerli',
            url: 'https://goerlifaucet.com/',
            urlText: 'Kunjungi goerliFaucet.com'
        },
        {
            id: 'mumbai',
            name: 'Mumbai (Polygon)',
            description: 'Dapatkan MATIC testnet untuk jaringan Mumbai (Polygon).',
            url: 'https://faucet.polygon.technology/',
            urlText: 'Kunjungi polygon.technology'
        },
        {
            id: 'bnb',
            name: 'BNB Testnet',
            description: 'Dapatkan BNB testnet di jaringan BNB Testnet',
            links: [
                { url: 'https://testnet.binance.org/faucet-smart', text: 'Kunjungi binance.org' },
                { url: 'https://faucet.quicknode.com/binance/bnb-testnet', text: 'Kunjungi quicknode.com' }
            ]
        },
        {
            id: 'base',
            name: 'Base Goerli',
            description: 'Dapatkan ETH testnet di jaringan Base Goerli',
            url: 'https://base/goerli',
            urlText: 'Kunjungi quicknode.com'
        },
        {
            id: 'arbitrum',
            name: 'Arbitrum Sepolia',
            description: 'Dapatkan ETH testnet di jaringan Arbitrum Sepolia.',
            url: 'https://faucet.triangleplatform.com/arbitrum/sepolia',
            urlText: 'Kunjungi triangleplatform.com'
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
      <header><h1>Info Faucet</h1></header>
      <Navbar />
      
      <div className="faucet-container">
        <input 
          type="search" 
          placeholder="Cari faucet..." 
          className="search-faucet"
          onChange={e => setSearchTerm(e.target.value)}
          style={{marginBottom: '20px', padding: '10px', width: '100%'}}
        />

        <div className="faucet-list" style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px'}}>
          {filteredFaucets.map(f => (
            <div key={f.id} className="faucet-item" style={{border: '1px solid white', padding: '20px', backgroundColor: '#111'}}>
              <h3>{f.name}</h3>
              <p>{f.description}</p>
              
              {f.links ? (
                <select onChange={(e) => { if(e.target.value) window.open(e.target.value, '_blank') }}>
                  <option value="">-- Pilih Link --</option>
                  {f.links.map((l, idx) => <option key={idx} value={l.url}>{l.text}</option>)}
                </select>
              ) : (
                <a href={f.url} target="_blank" rel="noreferrer" className="open-link" style={{display:'block', textAlign:'center', marginTop:'10px'}}>
                  {f.urlText}
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    <footer className="app-footer">
        Powered by IAC Community
      </footer>

    </div>
  );
};