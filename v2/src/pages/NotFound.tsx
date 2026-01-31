import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';

export const NotFound: React.FC = () => {
  return (
    <div className="app-container" style={{ textAlign: 'center', minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <header><h1>404 - ERROR</h1></header>
      <Navbar />
      
      <div style={{ padding: '20px', position: 'relative' }}>
        
        {/* Kontainer Dino dan Speech Bubble */}
        <div style={{ 
          display: 'inline-block', 
          fontFamily: 'monospace', 
          whiteSpace: 'pre', 
          fontSize: '14px', 
          color: '#01a2ff',
          marginBottom: '30px',
          textAlign: 'left'
        }}>
          {/* Gelembung Teks */}
          <div style={{ 
            border: '2px solid #fff', 
            padding: '10px', 
            borderRadius: '15px', 
            marginLeft: '60px', 
            marginBottom: '5px',
            backgroundColor: '#000',
            color: '#fff',
            display: 'inline-block',
            fontWeight: 'bold',
            animation: 'bounce 2s infinite'
          }}>
             RAWWRR! 404 NOT FOUND!
          </div>
          
          {`

⠀⠀⠀⠀⠀⠀  ⣠⠲⣄⡤⠖⢲⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀   ⣠⠤⠗⠒⠚⠓⠦⣼⢤⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀ ⢀⡴⠋⠀⠀⠀⠀ ⠀ ⠀  ⠘⡆⣠⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
  ⡏⠀⠀⠀⠛⠀⠀⠀   ⠀  ⠀⣿⠓⢤⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
  ⣇⠀⠀⠀⠀⠀⠀⠀⠀⠀ ⠀    ⣿⢀⡴⠃⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀ ⠈⠓⠦⣄⡀⠀⠀⠀⠀⠀⠀    ⣿⠙⠲⣄⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀  ⠸⡆⡠⠆⠀⠀     ⢹⠀⣠⠏⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⢀⡴⠋⠀⠀⠀⠀  ⠀    ⠘⣏⠉⠙⢲⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⣠⠋⠀⠀⢀⡴⠂⠀⠀ ⠀    ⠘⣆⣠⣏⣀⣀⣀⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⢰⠃⠀⢀⡴⠋⠀⠀⠀⠀ ⠀⠀    ⠈⠻⡀⠀⢀⡏⠀⠀⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠈⠳⠔⠋⡇⠀⠀⠀⠀⠀⠀⠀⠀⠀    ⠙⣦⠮⠤⠤⣤⠀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⣇⠀⠀⠀⣀⠀⠀⠀⠀⠀⠀    ⠈⢧⠀⣠⢏⡀⠀⠀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠸⡄⢀⡞⠁⠀⠀⠀⠀ ⠀⠀  ⠀⠈⢻⡋⠉⣹⢀⡀⠀⠀⠀⠀
⠀⠀⠀⠀⠀⠀⠀⠙⣾⠀⠀⠀⠀⡄⠀⠀⠀     ⠀ ⠦⣟⣉⠹⡴⠲⡄⠀
⠀⠀⠀⠀⠀⠀⠀⢀⡽  ⠀⠀ ⣧⣀⡀⢀⣀⣀.⣀.⣀⣀⣀⣈⣉⣉⣙⣳⠆
⠀⠀⠀⠀⠀⠀⠀⠘⠦⠤⠤⠴⠞⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀
          `}
        </div>

        <h2 style={{ border: 'none', color: '#fff' }}>MAAP, HALAMAN TIDAK DITEMUKAN</h2>
        <p style={{ color: '#888', marginBottom: '30px' }}>
          URL yang Anda tuju tidak valid atau mungkin sudah "dimakan t-rex".
        </p>
        
        <Link to="/">
          <button style={{ 
            padding: '15px 30px', 
            fontSize: '16px', 
            cursor: 'pointer',
            backgroundColor: '#fff',
            color: '#000',
            border: 'none',
            fontWeight: 'bold'
          }}>
            KEMBALI KE HOME
          </button>
        </Link>
      </div>

      {/* Tambahkan sedikit CSS animasi langsung di file ini */}
      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        pre {
          line-height: 1.2;
        }
      `}</style>

      <footer className="app-footer" style={{ marginTop: 'auto' }}>
        Powered by IAC Community
      </footer>
    </div>
  );
};