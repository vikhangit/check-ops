import { useState, useEffect } from 'react'
import { useAutoUpdate } from '../../hooks/useAutoUpdate'
import { useAppStore } from '../../store/useAppStore'

export function UpdateTab() {
  const { toast } = useAppStore()
  const updateState = useAutoUpdate()
  const [checking, setChecking] = useState(false)

  const handleCheckForUpdates = async () => {
    setChecking(true)
    try {
      await updateState.checkForUpdates()
      if (!updateState.updateAvailable) {
        toast.info(`Bạn đang dùng phiên bản ${updateState.currentVersion} - Phiên bản mới nhất!`)
      }
    } catch (err) {
      console.error('Check error:', err)
    } finally {
      setChecking(false)
    }
  }

  const handleDownloadAndInstall = async () => {
    try {
      if (!updateState.isDownloaded) {
        await updateState.downloadUpdate()
      } else {
        await updateState.installUpdate()
      }
    } catch (err) {
      console.error('Update error:', err)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ background: 'var(--bg-surface-2)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ marginBottom: 4, fontSize: 16, fontWeight: 600 }}>📦 Cập Nhật Ứng Dụng</h3>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Kiểm tra và cài đặt phiên bản mới của CheckOps</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div style={{ background: 'var(--bg-primary)', padding: 12, borderRadius: 6 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Phiên bản hiện tại</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--c-primary)' }}>{updateState.currentVersion}</div>
          </div>
          {updateState.newVersion && (
            <div style={{ background: 'var(--c-success)20', padding: 12, borderRadius: 6, border: '1px solid var(--c-success)40' }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Phiên bản mới có sẵn</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--c-success)' }}>v{updateState.newVersion}</div>
            </div>
          )}
        </div>

        {updateState.error && (
          <div style={{ background: '#ef44441a', padding: 10, borderRadius: 6, marginBottom: 12, color: '#ef4444', fontSize: 13, border: '1px solid #ef44444a' }}>
            ❌ {updateState.error}
          </div>
        )}

        {updateState.isDownloading && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
              Đang tải xuống ({updateState.downloadProgress}%)
            </div>
            <div style={{ background: 'var(--bg-secondary)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${updateState.downloadProgress}%`,
                  background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          </div>
        )}

        {updateState.isDownloaded && (
          <div style={{ background: '#10b9811a', padding: 10, borderRadius: 6, marginBottom: 12, color: '#10b981', fontSize: 13, border: '1px solid #10b9814a' }}>
            ✅ Phiên bản mới đã tải xuống - Bấm "Cài Đặt & Khởi Động Lại" để cập nhật
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-secondary"
            onClick={handleCheckForUpdates}
            disabled={checking || (updateState.isDownloading && !updateState.isDownloaded)}
            style={{ display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {checking ? (
              <>
                <span className="spinner" style={{ width: 14, height: 14 }} />
                Đang kiểm tra...
              </>
            ) : (
              <>🔄 Kiểm Tra Cập Nhật</>
            )}
          </button>

          {updateState.updateAvailable && (
            <button
              className="btn btn-primary"
              onClick={handleDownloadAndInstall}
              disabled={updateState.isDownloading && !updateState.isDownloaded}
              style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--c-success)' }}
            >
              {updateState.isDownloading && !updateState.isDownloaded ? (
                <>
                  <span className="spinner" style={{ width: 14, height: 14 }} />
                  Đang tải ({updateState.downloadProgress}%)...
                </>
              ) : updateState.isDownloaded ? (
                <>🚀 Cài Đặt & Khởi Động Lại</>
              ) : (
                <>⬇️ Tải Xuống Cập Nhật</>
              )}
            </button>
          )}
        </div>

        {updateState.releaseNotes && (
          <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border)' }}>
            <h4 style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📝 Ghi Chú Phát Hành</h4>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 200, overflow: 'auto' }}>
              {typeof updateState.releaseNotes === 'string'
                ? updateState.releaseNotes
                : Array.isArray(updateState.releaseNotes)
                ? updateState.releaseNotes.join('\n')
                : JSON.stringify(updateState.releaseNotes, null, 2)}
            </div>
          </div>
        )}
      </div>

      <div style={{ background: 'var(--bg-surface-2)', padding: 16, borderRadius: 8, border: '1px solid var(--border)' }}>
        <h3 style={{ marginBottom: 8, fontSize: 14, fontWeight: 600 }}>📖 Hướng Dẫn Cập Nhật</h3>
        <ul style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.8, paddingLeft: 20 }}>
          <li>Bấm "Kiểm Tra Cập Nhật" để tìm phiên bản mới</li>
          <li>Nếu có phiên bản mới, bấm "Tải Xuống Cập Nhật"</li>
          <li>Bấm "Cài Đặt & Khởi Động Lại" để cài đặt và khởi động lại ứng dụng</li>
          <li>⚠️ Không tắt ứng dụng trong quá trình cập nhật</li>
        </ul>
      </div>
    </div>
  )
}
