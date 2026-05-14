import { useState } from 'react'
import { useUserStore } from '../../store/useUserStore'
import { useAppStore } from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { login } = useUserStore()
  const { toast } = useAppStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email.trim() || !password.trim()) {
      toast.error('Vui lòng nhập đầy đủ thông tin')
      return
    }

    setLoading(true)
    try {
      // Sign In
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
      })

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('Sai email hoặc mật khẩu. Vui lòng thử lại.')
        }
        throw error
      }

      if (data.user) {
        await handleLoginSuccess(data.user)
      }
    } catch (err: any) {
      toast.error(err.message || 'Thao tác thất bại')
    } finally {
      setLoading(false)
    }
  }

  const handleLoginSuccess = async (user: any) => {
    try {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        console.warn('Profile not found yet:', profileError)
        const fallbackUser = {
          id: user.id,
          name: user.user_metadata?.name || user.email?.split('@')[0] || 'User',
          role: (email.trim().toLowerCase() === 'tranphuong0512@gmail.com' ? 'admin' : 'staff') as 'admin' | 'staff',
          avatar: '',
          is_active: 1,
          created_at: user.created_at,
          email: user.email,
          permissions: undefined
        }
        login(fallbackUser as any)
        toast.success(`Chào mừng! (Hệ thống đang đồng bộ hồ sơ)`)
      } else {
        login({
          id: user.id,
          name: profile.name,
          role: profile.role,
          avatar: profile.avatar || '',
          is_active: profile.is_active ? 1 : 0,
          created_at: profile.created_at,
          permissions: profile.permissions || undefined
        })
        toast.success(`Chào mừng ${profile.name}!`)
      }
    } catch (pErr) {
      console.error('Profile fetch crash:', pErr)
      throw new Error('Không thể tải hồ sơ người dùng.')
    }
  }

  return (
    <div className={styles.page}>
      {/* Background decorations */}
      <div className={styles.bg}>
        <div className={styles.bgOrb1} />
        <div className={styles.bgOrb2} />
        <div className={styles.bgGrid} />
      </div>

      <div className={styles.container}>
        {/* Logo */}
        <div className={styles.logo}>
          <div className={styles.logoIcon}>✅</div>
          <div className={styles.logoText}>
            <h1 className={styles.logoTitle}>CheckOps</h1>
            <p className={styles.logoSub}>Hệ Thống Quản Lý Vận Hành</p>
          </div>
        </div>

        {/* Card */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Đăng Nhập</h2>
            <p className={styles.cardSub}>Nhập thông tin tài khoản để tiếp tục</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                id="login-email"
                type="email"
                className="form-input"
                placeholder="example@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mật Khẩu</label>
              <input
                id="login-password"
                type="password"
                className="form-input"
                placeholder="Nhập mật khẩu..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            <button
              id="login-submit"
              type="submit"
              className="btn btn-primary w-full btn-lg"
              disabled={loading}
              style={{ marginTop: 8 }}
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Đang xử lý...
                </>
              ) : (
                <>🔐 Đăng Nhập</>
              )}
            </button>
          </form>

          <div className={styles.hint}>
            <p>Chào Mừng Bạn: <strong>Đến Với Hệ Thống CheckList</strong></p>
          </div>
        </div>

        <p className={styles.footer}>
          © 2026 CheckOps Vận Hành · Dữ liệu lưu trữ offline an toàn
        </p>
      </div>
    </div>
  )
}
