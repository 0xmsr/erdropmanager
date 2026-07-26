import React, { useState, useEffect, useRef } from 'react';

interface BaseModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
}

interface AlertProps extends BaseModalProps {
  onClose: () => void;
  type?: 'success' | 'error' | 'hapus' | 'info';
}

interface ConfirmProps extends BaseModalProps {
  onConfirm: () => void;
  onCancel: () => void;
}

interface PromptProps extends BaseModalProps {
  onConfirm: (value: string) => void;
  onCancel: () => void;
  placeholder?: string;
  inputType?: 'text' | 'password';
}

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const CustomAlert: React.FC<AlertProps> = ({ isOpen, onClose, title, message, type = 'info' }) => {
  if (!isOpen) return null;

  return (
    <div className="custom-modal-overlay" onClick={onClose}>
      <div className="custom-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className={`custom-modal-title ${type}`}>
          {title || (type === 'error' ? 'ERROR' : type === 'hapus' ? 'DIHAPUS' : type === 'success' ? 'SUKSES' : 'INFO')}
        </div>
        <div className="custom-modal-message">
          {message}
        </div>
        <div className="custom-modal-buttons">
          <button onClick={onClose} className="action-btn">OK</button>
        </div>
      </div>
    </div>
  );
};

export const CustomConfirm: React.FC<ConfirmProps> = ({ isOpen, onConfirm, onCancel, title, message }) => {
  if (!isOpen) return null;

  return (
    <div className="custom-modal-overlay">
      <div className="custom-modal-box">
        <div className="custom-modal-title warning">
          {title || 'KONFIRMASI'}
        </div>
        <div className="custom-modal-message">
          {message}
        </div>
        <div className="custom-modal-buttons">
          <button onClick={onCancel} className="cancel-btn">Batal</button>
          <button onClick={onConfirm} className="ya-btn">Ya, Lanjutkan</button>
        </div>
      </div>
    </div>
  );
};

export const CustomPrompt: React.FC<PromptProps> = ({ isOpen, onConfirm, onCancel, title, message, placeholder, inputType = 'text' }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onConfirm(inputValue);
  };

  if (!isOpen) return null;

  return (
    <div className="custom-modal-overlay">
      <div className="custom-modal-box">
        <div className="custom-modal-title info">
          {title || 'INPUT DIPERLUKAN'}
        </div>
        <form onSubmit={handleSubmit}>
          <div className="custom-modal-message">
            <p style={{marginBottom: '10px'}}>{message}</p>
            <input 
              ref={inputRef}
              type={inputType}
              className="custom-modal-input"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={placeholder || ''}
              style={{ width: '100%', boxSizing: 'border-box' }}
            />
          </div>
          <div className="custom-modal-buttons">
            <button type="button" onClick={onCancel} className="cancel-btn">Batal</button>
            <button type="submit" className="action-btn">Submit</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export interface TxConfirmDetails {
  title: string;
  network?: string;
  to?: string;
  value?: string;
  data?: string;
  extra?: string;
}

interface TxConfirmModalProps {
  isOpen: boolean;
  details: TxConfirmDetails | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const TxConfirmModal: React.FC<TxConfirmModalProps> = ({ isOpen, details, onConfirm, onCancel }) => {
  if (!isOpen || !details) return null;

  const rows: { label: string; value: string }[] = [];
  if (details.network) rows.push({ label: 'Network', value: details.network });
  if (details.to)      rows.push({ label: 'Ke', value: details.to });
  if (details.value)   rows.push({ label: 'Jumlah', value: details.value });
  if (details.data && details.data !== '0x') rows.push({ label: 'Data', value: details.data });

  return (
    <div className="custom-modal-overlay">
      <div className="custom-modal-box" style={{ width: '90%', maxWidth: '460px', border: '1px solid #ff660055' }}>
        <div className="custom-modal-title warning" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          ⚠️ KONFIRMASI TRANSAKSI
        </div>
        <div className="custom-modal-message">
          <p style={{ marginBottom: '12px', fontWeight: 'bold' }}>{details.title}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {rows.map((r) => (
              <div key={r.label} style={{
                display: 'flex', flexDirection: 'column', gap: '2px',
                borderLeft: '2px solid #333', paddingLeft: '10px',
              }}>
                <span style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {r.label}
                </span>
                <span style={{ fontSize: '12px', color: '#eee', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                  {r.value}
                </span>
              </div>
            ))}
          </div>
          {details.extra && (
            <p style={{ fontSize: '11px', color: '#ffaa44', marginTop: '14px', lineHeight: '1.5' }}>
              ℹ️ {details.extra}
            </p>
          )}
          <p style={{ fontSize: '11px', color: '#666', marginTop: '14px' }}>
            Periksa detail di atas sebelum melanjutkan. Aksi ini tidak bisa dibatalkan setelah dikirim ke jaringan.
          </p>
        </div>
        <div className="custom-modal-buttons">
          <button onClick={onCancel} className="cancel-btn">Batal</button>
          <button onClick={onConfirm} className="ya-btn">Kirim Transaksi</button>
        </div>
      </div>
    </div>
  );
};

export const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="custom-modal-overlay">
      <div className="custom-modal-box" style={{ width: '90%', maxWidth: '600px' }}>
        <div className="custom-modal-title">
          {title}
        </div>
        <div className="custom-modal-content">
          {children}
        </div>
        <div className="custom-modal-buttons">
          <button onClick={onClose} className="cancel-btn">Tutup</button>
        </div>
      </div>
    </div>
  );
};
