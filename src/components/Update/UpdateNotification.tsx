import React from 'react'
import { useAutoUpdate } from '../../hooks/useAutoUpdate'

export const UpdateNotification: React.FC = () => {
  const {
    updateAvailable,
    newVersion,
    isDownloading,
    downloadProgress,
    isDownloaded,
    error,
    downloadUpdate,
    installUpdate
  } = useAutoUpdate()

  if (!updateAvailable && !isDownloading && !isDownloaded && !error) {
    return null
  }

  // Don't show if there was an error unless we want to show it
  if (error && !updateAvailable) {
    return null
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 20,
        right: 20,
        width: 320,
        backgroundColor: 'var(--bg-surface-2)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        animation: 'slideIn 0.3s ease-out',
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .update-btn {
          padding: 8px 12px;
          border-radius: 6px;
          border: none;
          cursor: pointer;
          font-weight: 600;
          font-size: 13px;
          transition: all 0.2s;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
        }
        .update-btn-primary {
          background: var(--c-primary);
          color: white;
        }
        .update-btn-primary:hover {
          background: var(--c-primary-hover);
        }
        .update-btn-success {
          background: #10b981;
          color: white;
        }
        .update-btn-success:hover {
          background: #059669;
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: 'var(--c-primary)20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
          }}
        >
          🚀
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14 }}>Cập Nhật Mới Có Sẵn!</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Phiên bản v{newVersion} đã sẵn sàng</div>
        </div>
      </div>

      {isDownloading && !isDownloaded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
            <span>Đang tải xuống...</span>
            <span>{downloadProgress}%</span>
          </div>
          <div style={{ height: 6, backgroundColor: 'var(--bg-primary)', borderRadius: 3, overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${downloadProgress}%`,
                backgroundColor: 'var(--c-primary)',
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      )}

      {isDownloaded && (
        <div style={{ fontSize: 12, color: '#10b981', backgroundColor: '#10b98115', padding: '6px 10px', borderRadius: 6, border: '1px solid #10b98130' }}>
          ✅ Đã tải xong! Khởi động lại để áp dụng.
        </div>
      )}

      {error && (
        <div style={{ fontSize: 11, color: '#ef4444', backgroundColor: '#ef444415', padding: '6px 10px', borderRadius: 6, border: '1px solid #ef444430' }}>
          ❌ Lỗi: {error}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        {!isDownloaded && !isDownloading && (
          <button className="update-btn update-btn-primary" style={{ flex: 1 }} onClick={downloadUpdate}>
            ⬇️ Tải Xuống
          </button>
        )}
        {isDownloaded && (
          <button className="update-btn update-btn-success" style={{ flex: 1 }} onClick={installUpdate}>
            🚀 Cài Đặt & Khởi Động Lại
          </button>
        )}
      </div>
    </div>
  )
}
