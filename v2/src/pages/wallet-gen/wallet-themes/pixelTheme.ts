// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr
//
// Tema "Pixel Block" untuk tab Send / Receive. Murni CSS override yang di-scope
// ke wrapper `.px-scope[data-ui="pixel"]` — jadi tidak menyentuh tab lain, dan
// tinggal matikan lewat pengaturan (uiStyle = 'default') untuk kembali ke tampilan asli.
//
// Kenapa pakai !important & attribute selector: hampir seluruh style di
// TransferTab adalah inline style, dan inline style hanya bisa dikalahkan
// oleh rule !important. Kartu dikenali lewat warna background-nya (#0d0d0d →
// "rgb(13, 13, 13)" di atribut style hasil serialisasi browser).

export type UiStyle = 'default' | 'pixel';

// Warna aksen per chain — dipakai sebagai border & bayangan blok.
export function chainAccent(chain: string): string {
  switch (chain) {
    case 'sol':  return '#9945FF';
    case 'tron': return '#EF0027';
    case 'axm':  return '#75bbe9';
    case 'gram': return '#0088CC';
    case 'sui':  return '#4DA2FF';
    case 'apt':  return '#00D2AA';
    case 'ase':  return '#6B6BFF';
    case 'atom': return '#8A8FB5';
    default:     return '#01a2ff';
  }
}

export const PIXEL_FONT_IMPORT =
  "@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap');";

export function pixelThemeCss(scope: string = '.px-scope[data-ui="pixel"]'): string {
  const S = scope;
  // Semua teks memakai font bitmap 8×8 blok penuh. Ukuran dipetakan ke
  // kelipatan grid font (8/10/12/16px) supaya piksel tetap tajam & kotak.
  const HEAD = `'Press Start 2P', ui-monospace, 'Courier New', monospace`;
  const BODY = HEAD;

  let sizeRules = '';
  for (let n = 9; n <= 28; n++) {
    const to = n <= 11 ? 8 : n <= 14 ? 10 : n <= 18 ? 12 : n <= 24 ? 16 : 20;
    sizeRules += `${S} :not(button):not(h1):not(h2):not(h3):not(label):not(svg)[style*="font-size: ${n}px"]{font-size:${to}px !important;line-height:1.7 !important}\n`;
  }

  return `${PIXEL_FONT_IMPORT}
${S}{
  --px: var(--ui-accent, #01a2ff); --px-dim: var(--ui-accent-dim, #01a2ff66);
  font-family:${BODY}; font-size:10px; line-height:1.7; -webkit-font-smoothing:none; -moz-osx-font-smoothing:grayscale; font-smooth:never; image-rendering:pixelated;
  padding:14px; position:relative;
  background-color:#07070c;
  background-image:
    linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px);
  background-size:8px 8px;
  border:4px solid var(--px);
  box-shadow: 8px 8px 0 0 var(--px-dim);
}
${S} *{ border-radius:0 !important; transition:none !important; text-shadow:none !important; }
${S} *:not(svg):not(path):not(button):not(h1):not(h2):not(h3):not(label){ font-family:${BODY} !important; }
${sizeRules}
/* Judul, tombol, label → font pixel bitmap */
${S} h1, ${S} h2, ${S} h3, ${S} button, ${S} label{
  font-family:${HEAD} !important; font-size:9px !important; line-height:1.7 !important;
  letter-spacing:0 !important; text-transform:uppercase;
}
${S} h2{ font-size:12px !important; }
${S} h3{ font-size:10px !important; }
${S} *{ text-shadow:1px 1px 0 #000 !important; }

/* Kartu utama */
${S} div[style*="background: rgb(13, 13, 13)"], ${S} .form-container{
  background:#0b0b16 !important;
  border:4px solid var(--px) !important;
  box-shadow:6px 6px 0 0 var(--px-dim) !important;
}
/* Panel di dalam kartu */
${S} div[style*="background: rgb(7, 7, 7)"], ${S} div[style*="background: rgb(10, 10, 10)"], ${S} div[style*="background: rgb(0, 0, 0)"]{
  border:2px solid #3a3a52 !important;
  box-shadow: inset 3px 3px 0 0 #000 !important;
}
/* Tombol: blok tebal + bayangan keras, "ditekan" saat hover/active */
${S} button{
  border:3px solid var(--px) !important;
  box-shadow:4px 4px 0 0 var(--px-dim) !important;
  cursor:pointer;
}
${S} button:not(:disabled):hover{ transform:translate(2px,2px); box-shadow:2px 2px 0 0 var(--px-dim) !important; filter:brightness(1.15); }
${S} button:not(:disabled):active{ transform:translate(4px,4px); box-shadow:0 0 0 0 transparent !important; }
${S} button:disabled{ opacity:.75; box-shadow:none !important; cursor:not-allowed; }

/* Input */
${S} input, ${S} select, ${S} textarea{
  background:#000 !important; color:#e8e8ff !important;
  border:3px solid #4a4a66 !important;
  box-shadow: inset 3px 3px 0 0 #1a1a2a !important;
  font-size:10px !important; line-height:1.7 !important; outline:none !important;
}
${S} input:focus, ${S} select:focus, ${S} textarea:focus{
  border-color:var(--px) !important; box-shadow:3px 3px 0 0 var(--px-dim) !important;
}
${S} input::placeholder, ${S} textarea::placeholder{ color:#5a5a78; }
${S} code{ background:#000 !important; border:2px solid #3a3a52 !important; font-size:8px !important; }
${S} a{ text-decoration:none; border-bottom:2px solid currentColor; }
${S} a[style*="border"]{ border-bottom-width:2px; box-shadow:3px 3px 0 0 var(--px-dim); }

/* Scrollbar blok */
${S} ::-webkit-scrollbar{ width:14px; height:14px; }
${S} ::-webkit-scrollbar-track{ background:#000; border:2px solid #222; }
${S} ::-webkit-scrollbar-thumb{ background:var(--px); border:2px solid #000; }
`;
}
