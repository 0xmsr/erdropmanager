// Copyright (c) 2026 ErdropManager — MIT License
// Author - 0xmsr
//
// Registry gaya tampilan (tema) untuk tab Send / Receive.
//
// CARA MENAMBAH TEMA BARU:
//   1. Buat file baru, mis. `retroTheme.ts`, yang meng-export fungsi
//      `(scope: string) => string` berisi CSS. Semua selector HARUS diawali
//      `scope` (nilainya `.px-scope[data-ui="<id>"]`) supaya tidak bocor ke
//      tab lain. Warna aksen chain tersedia lewat CSS variable
//      `--ui-accent` dan `--ui-accent-dim` (lihat pixelTheme.ts sebagai contoh).
//   2. Daftarkan di UI_THEMES di bawah: { id, label, css }.
//   Selesai — tombol pilihan di bar pengaturan muncul otomatis, dan pilihan
//   user tersimpan di localStorage. Tema 'default' TIDAK punya css: artinya
//   tampilan asli tanpa override apa pun.

import { pixelThemeCss } from './pixelTheme';

export interface UiThemeDef {
  id: string;
  label: string;
  css?: (scope: string) => string;
}

export const UI_THEMES: UiThemeDef[] = [
  { id: 'default', label: 'Default' },
  { id: 'pixel',   label: '▦ Pixel Block', css: pixelThemeCss },
  // { id: 'retro', label: '◐ Retro CRT', css: retroThemeCss },   ← contoh tema berikutnya
];

export const DEFAULT_UI_STYLE = 'default';
export const UI_STYLE_STORAGE_KEY = 'transferUiStyle';

export function getUiTheme(id: string): UiThemeDef {
  return UI_THEMES.find(t => t.id === id) ?? UI_THEMES[0];
}

export function themeScope(id: string): string {
  return `.px-scope[data-ui="${id}"]`;
}

// Baca pilihan tersimpan; id yang sudah tidak ada di registry → kembali ke default.
export function loadUiStyle(): string {
  try {
    const v = localStorage.getItem(UI_STYLE_STORAGE_KEY);
    return v && UI_THEMES.some(t => t.id === v) ? v : DEFAULT_UI_STYLE;
  } catch { return DEFAULT_UI_STYLE; }
}
