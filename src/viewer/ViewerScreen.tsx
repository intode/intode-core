import React, { useMemo, useState } from 'react';
import type { IntentFile } from '../intent/provider';
import { CodeEditor } from '../editor/CodeEditor';
import { MarkdownPreview } from '../md-preview/MarkdownPreview';
import { detectFileType } from '../lib/file-utils';
import { decodeBase64Utf8 } from '../lib/encoding';

export interface ViewerScreenProps {
  file: IntentFile;
  onClose: () => void;
}

export function ViewerScreen({ file, onClose }: ViewerScreenProps) {
  const type = useMemo(() => detectFileType(file.fileName), [file.fileName]);
  const isMd = type === 'markdown';
  // Treat html as plain code in the viewer — preview would need an asset resolver
  // (sandboxed iframe + SFTP-backed fetch) that is not available outside a workspace.
  const isCodeLike = type === 'code' || type === 'html';
  const isUnsupported = type === 'binary' || type === 'media';

  const text = useMemo(() => {
    if (isUnsupported) return '';
    try {
      return decodeBase64Utf8(file.content);
    } catch {
      return '';
    }
  }, [file.content, isUnsupported]);

  const [preview, setPreview] = useState<boolean>(isMd);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={onClose} style={styles.backBtn} aria-label="Back">
          ←
        </button>
        <span style={styles.fileName}>{file.fileName}</span>
        {isMd && (
          <button
            onClick={() => setPreview((p) => !p)}
            style={preview ? styles.toggleBtnActive : styles.toggleBtn}
          >
            {preview ? 'Source' : 'Preview'}
          </button>
        )}
      </div>

      <div style={styles.body}>
        {isUnsupported ? (
          <div style={styles.placeholder}>
            <p style={styles.placeholderTitle}>Can't open this file type</p>
            <p style={styles.placeholderSub}>
              Intode opens text and code files. Binary or media files are not supported here yet.
            </p>
          </div>
        ) : isMd && preview ? (
          <MarkdownPreview content={text} visible={true} />
        ) : (
          <CodeEditor
            key={file.fileName}
            content={text}
            fileName={file.fileName}
            visible={true}
            readOnly={true}
          />
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    backgroundColor: 'var(--bg-base)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderBottom: '1px solid var(--bg-surface0)',
    backgroundColor: 'var(--bg-mantle)',
    minHeight: 44,
  },
  backBtn: {
    background: 'transparent',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 22,
    lineHeight: 1,
    padding: '4px 10px',
    cursor: 'pointer',
  },
  fileName: {
    flex: 1,
    color: 'var(--text-primary)',
    fontSize: 14,
    fontFamily: 'var(--font-mono)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  toggleBtn: {
    background: 'var(--bg-surface1)',
    border: 'none',
    color: 'var(--text-primary)',
    fontSize: 12,
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer',
  },
  toggleBtnActive: {
    background: 'var(--accent-blue)',
    border: 'none',
    color: 'var(--bg-base)',
    fontSize: 12,
    padding: '6px 12px',
    borderRadius: 4,
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative',
  },
  placeholder: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: 24,
    textAlign: 'center',
  },
  placeholderTitle: {
    color: 'var(--text-primary)',
    fontSize: 16,
    margin: 0,
    marginBottom: 8,
  },
  placeholderSub: {
    color: 'var(--text-muted)',
    fontSize: 13,
    margin: 0,
    maxWidth: 320,
    lineHeight: 1.4,
  },
};
