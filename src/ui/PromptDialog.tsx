import React, { useState, useEffect, useRef } from 'react';

interface Props {
  initialValue: string;
  title: string;
  submitLabel?: string;
  cancelLabel?: string;
  placeholder?: string;
  selectStemOnFocus?: boolean;
  validate?: (value: string, initial: string) => boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

const defaultValidate = (value: string, initial: string) =>
  value.trim().length > 0 && value !== initial && !value.includes('/');

export function PromptDialog({
  initialValue,
  title,
  submitLabel = 'OK',
  cancelLabel = 'Cancel',
  placeholder,
  selectStemOnFocus = false,
  validate = defaultValidate,
  onSubmit,
  onCancel,
}: Props) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      if (selectStemOnFocus) {
        const dot = initialValue.lastIndexOf('.');
        if (dot > 0) input.setSelectionRange(0, dot);
        else input.select();
      } else {
        input.select();
      }
    }, 50);
    return () => clearTimeout(t);
  }, []);

  const disabled = !validate(value, initialValue);
  const submit = () => {
    if (!disabled) onSubmit(value.trim());
  };

  return (
    <>
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10002 }}
        onClick={onCancel}
      />
      <div
        style={{
          position: 'fixed',
          left: 24,
          right: 24,
          top: '35%',
          zIndex: 10003,
          background: 'var(--bg-elevated, #151a1f)',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          padding: 16,
          color: 'var(--text-primary)',
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>{title}</div>
        <input
          ref={inputRef}
          value={value}
          placeholder={placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            } else if (e.key === 'Escape') {
              onCancel();
            }
          }}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '8px 10px',
            fontSize: 14,
            background: 'var(--bg-base, #0a0e13)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 4,
            fontFamily: 'var(--font-mono, monospace)',
          }}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'transparent',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
              borderRadius: 4,
              padding: '6px 14px',
              fontSize: 13,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={submit}
            disabled={disabled}
            style={{
              background: disabled ? 'transparent' : 'var(--accent-green, #00ff66)',
              border: '1px solid var(--accent-green, #00ff66)',
              color: disabled ? 'var(--text-tertiary)' : 'var(--bg-base, #0a0e13)',
              borderRadius: 4,
              padding: '6px 14px',
              fontSize: 13,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </>
  );
}
