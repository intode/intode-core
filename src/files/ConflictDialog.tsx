import React from 'react';

export type ConflictChoice = 'overwrite' | 'rename' | 'skip' | 'cancel';

interface Props {
  conflictCount: number;
  totalCount: number;
  onChoose: (choice: ConflictChoice) => void;
}

export function ConflictDialog({ conflictCount, totalCount, onChoose }: Props) {
  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 10002 }} onClick={() => onChoose('cancel')} />
      <div style={{
        position: 'fixed', left: 24, right: 24, top: '40%', zIndex: 10003,
        background: 'var(--bg-elevated, #151a1f)', borderRadius: 8, border: '1px solid var(--border-subtle)',
        padding: 16, color: 'var(--text-primary)',
      }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>File conflict</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 16 }}>
          {conflictCount} of {totalCount} file(s) already exist on the server. How should Intode handle them?
        </div>
        {([
          { id: 'overwrite' as const, label: 'Overwrite all', hint: 'Replace server files' },
          { id: 'rename' as const, label: 'Rename conflicts', hint: 'Save as foo (1).txt etc.' },
          { id: 'skip' as const, label: 'Skip existing', hint: 'Upload only non-conflicting' },
          { id: 'cancel' as const, label: 'Cancel', hint: '' },
        ]).map((opt) => (
          <button key={opt.id} onClick={() => onChoose(opt.id)} style={{
            display: 'block', width: '100%', padding: '10px 12px', marginTop: 8,
            background: 'transparent', border: '1px solid var(--border-subtle)', borderRadius: 6,
            color: 'var(--text-primary)', textAlign: 'left', fontSize: 14,
          }}>
            <div>{opt.label}</div>
            {opt.hint && <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{opt.hint}</div>}
          </button>
        ))}
      </div>
    </>
  );
}
