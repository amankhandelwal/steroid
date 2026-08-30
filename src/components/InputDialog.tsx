/**
 * InputDialog - Modal input dialog for collecting user input
 *
 * Styles live in the sibling `InputDialog.css`, which is pulled into the bundle
 * by `src/index.css` (the single stylesheet injected into the extension's
 * shadow root).
 */

import { useEffect, useRef, useState } from 'react';

interface InputDialogProps {
  title: string;
  placeholder?: string;
  defaultValue?: string;
  inputType?: 'text' | 'password';
  submitLabel?: string;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const InputDialog = ({
  title,
  placeholder,
  defaultValue = '',
  inputType = 'text',
  submitLabel = 'Submit',
  onSubmit,
  onCancel
}: InputDialogProps) => {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedValue = value.trim();
    if (trimmedValue) {
      onSubmit(trimmedValue);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onCancel();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      const trimmedValue = value.trim();
      if (trimmedValue) {
        onSubmit(trimmedValue);
      }
    }
  };

  // Secrets (API keys) render monospaced so individual characters stay legible.
  const inputClassName = inputType === 'password'
    ? 'steroid-dialog-input steroid-dialog-input--mono'
    : 'steroid-dialog-input';

  return (
    <div className="steroid-dialog-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div className="steroid-dialog-card">
        <h3 className="steroid-dialog-title">{title}</h3>

        <form onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type={inputType}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label={title}
            className={inputClassName}
          />

          <div className="steroid-dialog-actions">
            <button
              type="button"
              onClick={onCancel}
              className="steroid-dialog-button steroid-dialog-button--secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="steroid-dialog-button steroid-dialog-button--primary"
            >
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InputDialog;
