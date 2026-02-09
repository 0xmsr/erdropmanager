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
