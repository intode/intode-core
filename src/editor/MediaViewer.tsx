import React, { useState } from 'react';
import { FileTab } from '../files/TabManager';
import { getMimeType } from '../lib/file-utils';

interface Props {
  tab: FileTab;
  onDownload?: () => void;
}

function codeText(code: number): string {
  switch (code) {
    case 1: return 'aborted';
    case 2: return 'network error';
    case 3: return 'decode error (codec not supported)';
    case 4: return 'source not supported';
    default: return `code ${code}`;
  }
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function MediaError({ message }: { message: string }) {
  return (
    <div style={{ marginTop: 8, color: 'var(--accent-red, #ff4444)', fontSize: 12 }}>
      {message}
    </div>
  );
}

export function MediaViewer({ tab, onDownload }: Props) {
  const [audioError, setAudioError] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  if (tab.isLoading) {
    return (
      <div style={styles.center}>
        <span style={{ color: 'var(--text-muted)' }}>Loading...</span>
      </div>
    );
  }

  if (tab.content && tab.content.startsWith('__TOO_LARGE__:')) {
    const parts = tab.content.split(':');
    const size = parseInt(parts[1] ?? '0', 10);
    const cap = parseInt(parts[2] ?? '0', 10);
    return (
      <div style={styles.center}>
        <div style={{ textAlign: 'center', padding: 24, color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>{'\u{1F4E6}'}</div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>{tab.fileName}</div>
          <div style={{ fontSize: 13, marginBottom: 16 }}>
            File too large to preview ({formatBytes(size)} &gt; {formatBytes(cap)} cap)
          </div>
          {onDownload && (
            <button
              onClick={onDownload}
              style={{
                background: 'var(--accent-blue, #4a9eff)',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              {'\u2B07'} Download to view
            </button>
          )}
        </div>
      </div>
    );
  }

  if (tab.content && tab.content.startsWith('__ERROR__:')) {
    return (
      <div style={styles.center}>
        <div style={{ color: 'var(--accent-red, #ff4444)', fontSize: 13, padding: 24 }}>
          {tab.content.slice('__ERROR__:'.length)}
        </div>
      </div>
    );
  }

  if (!tab.blobUrl) return null;

  if (tab.mediaKind === 'image') {
    return (
      <div style={styles.imageWrap}>
        <img
          src={tab.blobUrl}
          alt={tab.fileName}
          style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block', margin: 'auto' }}
        />
      </div>
    );
  }

  if (tab.mediaKind === 'audio') {
    const mime = getMimeType(tab.fileName);
    return (
      <div style={styles.center}>
        <div style={{ width: '100%', maxWidth: 480, padding: 24 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-primary)' }}>{tab.fileName}</div>
          <audio
            controls
            preload="metadata"
            style={{ width: '100%' }}
            onError={(e) => {
              const el = e.currentTarget;
              const err = el.error;
              setAudioError(err ? `Audio error (code ${err.code}): ${err.message || codeText(err.code)}` : 'Audio failed to load');
            }}
          >
            <source src={tab.blobUrl} type={mime} />
          </audio>
          <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-muted)' }}>{mime}</div>
          {audioError && <MediaError message={audioError} />}
        </div>
      </div>
    );
  }

  if (tab.mediaKind === 'video') {
    const mime = getMimeType(tab.fileName);
    return (
      <div style={styles.videoWrap}>
        <video
          controls
          playsInline
          preload="metadata"
          style={{ width: '100%', maxHeight: '100%', display: 'block', margin: 'auto', background: '#000' }}
          onError={(e) => {
            const el = e.currentTarget;
            const err = el.error;
            setVideoError(err ? `Video error (code ${err.code}): ${err.message || codeText(err.code)}` : 'Video failed to load');
          }}
        >
          <source src={tab.blobUrl} type={mime} />
        </video>
        {videoError && (
          <div style={{ position: 'absolute', bottom: 16, left: 16, right: 16, textAlign: 'center' }}>
            <MediaError message={videoError} />
          </div>
        )}
      </div>
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  center: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
    background: 'var(--bg-base)',
  },
  imageWrap: {
    width: '100%',
    height: '100%',
    overflow: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-crust, #0a0d10)',
  },
  videoWrap: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#000',
  },
};
