import { useState, useEffect } from 'react'
import { useUserStore } from '../../store/useUserStore'
import { useAppStore } from '../../store/useAppStore'
import { supabase } from '../../lib/supabase'
import type { User, Category } from '../../types/electron'
import { UpdateTab } from './UpdateTab'
import styles from './SettingsPage.module.css'

type Tab = 'users' | 'categories' | 'about' | 'update'

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('users')
  const { currentUser, theme, setTheme } = useUserStore()

  const tabs = [
    { id: 'users' as Tab, icon: '👥', label: 'Người Dùng' },
    { id: 'categories' as Tab, icon: '📂', label: 'Danh Mục' },
    { id: 'update' as Tab, icon: '📦', label: 'Cập Nhật' },
    { id: 'about' as Tab, icon: 'ℹ️', label: 'Thông Tin' },
  ]

  return (
    <div className={styles.page}>
      <div className={styles.sidebar}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className={styles.content}>
        {activeTab === 'users' && <UsersTab currentUser={currentUser} />}
        {activeTab === 'categories' && <CategoriesTab />}
        {activeTab === 'update' && <UpdateTab />}
        {activeTab === 'about' && <AboutTab theme={theme} setTheme={setTheme} />}
      </div>
    </div>
  )
}

// ─── Users Tab ───
function UsersTab({ currentUser }: { currentUser: User | null }) {
  const { toast } = useAppStore()
  const [users, setUsers] = useState<User[]>([])
  const [isForm, setIsForm] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [form, setForm] = useState<any>({ name: '', email: '', password: '', role: 'staff', permissions: null })
  const [pwdForm, setPwdForm] = useState({ userId: '', oldPwd: '', newPwd: '' })
  const [isPwdForm, setIsPwdForm] = useState(false)

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data: profiles } = await supabase.from('profiles').select('*')
    if (profiles) setUsers(profiles.map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
      permissions: p.permissions || undefined,
      avatar: p.avatar_url,
      is_active: p.is_active ? 1 : 0,
      created_at: p.created_at
    })) as any)
  }

  const openCreate = () => {
    setEditUser(null)
    setForm({ name: '', email: '', password: '', role: 'staff' })
    setIsForm(true)
  }

  const openEdit = (u: User) => {
    setEditUser(u)
    const perms = u.permissions || {
      checklist: { view: true, add: true, edit: true, delete: false },
      templates: { view: false, add: false, edit: false, delete: false },
      reports: { view: false, add: false, edit: false, delete: false },
      settings: { view: false, add: false, edit: false, delete: false }
    }
    setForm({ name: u.name, email: u.email || '', password: '', role: u.role, permissions: perms } as any)
    setIsForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { toast.error('Tên không được để trống'); return }
    
    try {
      if (editUser) {
        const { error } = await supabase
          .from('profiles')
          .update({ name: form.name, role: form.role, permissions: (form as any).permissions })
          .eq('id', editUser.id)
        if (error) throw error
        toast.success('Đã cập nhật hồ sơ')
        setIsForm(false)
        load()
      }
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu')
    }
  }

  const handleDelete = async (u: User) => {
    if (u.id === currentUser?.id) { toast.error('Không thể xoá tài khoản đang đăng nhập'); return }
    if (!confirm(`Xoá hồ sơ "${u.name}"? (Lưu ý: Auth User vẫn tồn tại)`)) return
    const { error } = await supabase.from('profiles').delete().eq('id', u.id)
    if (error) toast.error(error.message)
    else toast.success('Đã xoá hồ sơ')
    load()
  }

  const handleChangePwd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwdForm.newPwd.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự')
      return
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: pwdForm.newPwd })
      if (error) throw error
      toast.success('Đã đổi mật khẩu thành công!')
      setIsPwdForm(false)
      setPwdForm({ userId: '', oldPwd: '', newPwd: '' })
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi đổi mật khẩu')
    }
  }

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>👥 Quản Lý Người Dùng</h3>
        {currentUser?.role === 'admin' && (
          <button className="btn btn-primary btn-sm" onClick={openCreate}>➕ Thêm</button>
        )}
      </div>

      <div className={styles.userList}>
        {users.map((u: User) => (
          <div key={u.id} className={styles.userRow}>
            <div className={styles.userAvatar}>{u.name.charAt(0).toUpperCase()}</div>
            <div className={styles.userInfo}>
              <span className={styles.userName}>{u.name} {u.id === currentUser?.id && <span className={styles.youBadge}>Bạn</span>}</span>
              <span className={styles.userEmail}>{u.email || 'Không có email'}</span>
            </div>
            <span className={`${styles.roleBadge} ${u.role === 'admin' ? styles.adminBadge : ''}`}>
              {u.role === 'admin' ? '👑 Admin' : '👤 Staff'}
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              {u.id === currentUser?.id && (
                <button className="btn btn-ghost btn-sm" onClick={() => setIsPwdForm(true)} title="Đổi mật khẩu cá nhân">🔑 Đổi Pass</button>
              )}
              {currentUser?.role === 'admin' && (
                <>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => openEdit(u)}>✏️</button>
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => handleDelete(u)}>🗑️</button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {isForm && (
        <div className="modal-overlay" onClick={() => setIsForm(false)}>
          <div className="modal" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editUser ? 'Sửa Người Dùng' : '📢 Thêm Nhân Sự Mới'}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setIsForm(false)}>✕</button>
            </div>
            {editUser ? (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group">
                    <label className="form-label">Tên *</label>
                    <input type="text" className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Vai Trò</label>
                    <select className="form-select" value={form.role} onChange={(e) => setForm((f: any) => ({ ...f, role: e.target.value }))}>
                      <option value="staff">👤 Staff</option>
                      <option value="admin">👑 Admin</option>
                    </select>
                  </div>
                </div>

                {form.role === 'staff' && (form as any).permissions && (
                  <div style={{ marginTop: 16 }}>
                    <label className="form-label">Ma Trận Quyền Hạn</label>
                    <div style={{ background: 'var(--bg-secondary)', padding: 12, borderRadius: 8 }}>
                      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                            <th style={{ paddingBottom: 8 }}>Module</th>
                            <th style={{ paddingBottom: 8, textAlign: 'center' }}>Xem</th>
                            <th style={{ paddingBottom: 8, textAlign: 'center' }}>Thêm</th>
                            <th style={{ paddingBottom: 8, textAlign: 'center' }}>Sửa / Update</th>
                            <th style={{ paddingBottom: 8, textAlign: 'center' }}>Xoá</th>
                          </tr>
                        </thead>
                        <tbody>
                          {['checklist', 'templates', 'reports', 'settings'].map(mod => {
                            const modLabel = mod === 'checklist' ? '✅ Công Việc Ngày' : mod === 'templates' ? '📂 Danh Mục & Mẫu' : mod === 'reports' ? '📊 Báo Cáo' : '⚙️ Cài Đặt';
                            const p = (form as any).permissions[mod];
                            const toggle = (field: string) => {
                              setForm(f => ({
                                ...f,
                                permissions: { ...f.permissions, [mod]: { ...f.permissions[mod], [field]: !p[field] } }
                              } as any))
                            }
                            return (
                              <tr key={mod} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '8px 0', fontWeight: 600 }}>{modLabel}</td>
                                <td style={{ textAlign: 'center' }}><input type="checkbox" checked={p.view} onChange={() => toggle('view')} /></td>
                                <td style={{ textAlign: 'center' }}><input type="checkbox" checked={p.add} onChange={() => toggle('add')} disabled={mod === 'settings'} /></td>
                                <td style={{ textAlign: 'center' }}><input type="checkbox" checked={p.edit} onChange={() => toggle('edit')} disabled={mod === 'settings'} /></td>
                                <td style={{ textAlign: 'center' }}><input type="checkbox" checked={p.delete} onChange={() => toggle('delete')} disabled={mod === 'settings'} /></td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="modal-footer" style={{ marginTop: 16 }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsForm(false)}>Huỷ</button>
                  <button type="submit" className="btn btn-primary">💾 Cập Nhật</button>
                </div>
              </form>
            ) : (
              <div style={{ padding: '0 0' }}>
                <div style={{ background: 'var(--bg-secondary)', padding: "16px", borderRadius: "8px", fontSize: "14px", lineHeight: "1.6", color: "var(--text-secondary)" }}>
                  <p style={{ marginBottom: '12px', color: 'var(--text-primary)', fontWeight: 'bold' }}>
                    Hệ thống hiện tại sử dụng Bảo mật Điện toán Đám mây (Supabase), vì vậy bạn không thể tạo tài khoản hộ nhân viên.
                  </p>
                  <p style={{ marginBottom: '8px' }}><strong>Cách thêm nhân sự:</strong></p>
                  <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>Yêu cầu nhân viên mở phần mềm CheckOps.</li>
                    <li>Ở màn hình đăng nhập, chọn tab <strong>Đăng Ký</strong>.</li>
                    <li>Nhân viên tự nhập Email, Tên hiển thị và Mật khẩu tự chọn.</li>
                    <li>Sau khi đăng ký thành công, hệ thống sẽ tự động gán quyền <strong>Staff</strong> (Nhân viên).</li>
                    <li>Tài khoản đó sẽ xuất hiện trong danh sách này và bạn có thể phân quyền hoặc đổi tên sau.</li>
                  </ol>
                </div>
                <div className="modal-footer" style={{ marginTop: '20px' }}>
                  <button type="button" className="btn btn-primary" onClick={() => setIsForm(false)}>Đã hiểu</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isPwdForm && (
        <div className="modal-overlay" onClick={() => setIsPwdForm(false)}>
          <div className="modal" style={{ maxWidth: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🔑 Đổi Mật Khẩu</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setIsPwdForm(false)}>✕</button>
            </div>
            <form onSubmit={handleChangePwd}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Mật Khẩu Mới (Tự động đổi cho tài khoản của bạn)</label>
                  <input type="password" className="form-input" value={pwdForm.newPwd} onChange={(e) => setPwdForm((f) => ({ ...f, newPwd: e.target.value }))} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsPwdForm(false)}>Huỷ</button>
                <button type="submit" className="btn btn-primary">🔑 Đổi Mật Khẩu</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Categories Tab ───
function CategoriesTab() {
  const { currentUser } = useUserStore()
  const { toast } = useAppStore()
  const [categories, setCategories] = useState<Category[]>([])
  const [isForm, setIsForm] = useState(false)
  const [editCat, setEditCat] = useState<Category | null>(null)
  const [form, setForm] = useState({ name: '', group_type: 'system', color: '#6366f1', icon: '📋' })

  useEffect(() => { load() }, [])

  const load = async () => {
    const { data } = await supabase.from('categories').select('*').order('sort_order', { ascending: true })
    if (data) setCategories(data as any)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editCat) {
        const { error } = await supabase.from('categories').update(form).eq('id', editCat.id)
        if (error) throw error
        toast.success('Đã cập nhật danh mục')
      } else {
        const { error } = await supabase.from('categories').insert([{ ...form, sort_order: categories.length }])
        if (error) throw error
        toast.success('Đã thêm danh mục')
      }
      setIsForm(false)
      load()
    } catch (err: any) {
      toast.error(err.message || 'Lỗi khi lưu')
    }
  }

  const systemCats = categories.filter((c: Category) => c.group_type === 'system')
  const customerCats = categories.filter((c: Category) => c.group_type === 'customer')

  return (
    <div>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>📂 Quản Lý Danh Mục</h3>
        {(currentUser?.role === 'admin' || currentUser?.permissions?.templates?.add) && (
          <button className="btn btn-primary btn-sm" onClick={() => { setEditCat(null); setForm({ name: '', group_type: 'system', color: '#6366f1', icon: '📋' }); setIsForm(true) }}>
            ➕ Thêm
          </button>
        )}
      </div>

      {['system', 'customer'].map((group) => (
        <div key={group} className={styles.catGroup}>
          <div className={styles.catGroupTitle}>
            {group === 'system' ? '🖥️ Kiểm Tra Hệ Thống Nền Tảng' : '💬 Kiểm Tra Phản Hồi Khách Hàng'}
          </div>
          {(group === 'system' ? systemCats : customerCats).map((c: Category) => (
            <div key={c.id} className={styles.catRow}>
              <span className={styles.catDot} style={{ background: c.color }} />
              <span className={styles.catIcon}>{c.icon}</span>
              <span className={styles.catName}>{c.name}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                {(currentUser?.role === 'admin' || currentUser?.permissions?.templates?.edit) && (
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={() => { setEditCat(c); setForm({ name: c.name, group_type: c.group_type, color: c.color, icon: c.icon }); setIsForm(true) }}>✏️</button>
                )}
                {(currentUser?.role === 'admin' || currentUser?.permissions?.templates?.delete) && (
                  <button className="btn btn-ghost btn-sm btn-icon" onClick={async () => { 
                    const { error } = await supabase.from('categories').delete().eq('id', c.id)
                    if (error) toast.error(error.message)
                    else { load(); toast.success('Đã xoá') }
                  }}>🗑️</button>
                )}
              </div>
            </div>
          ))}
        </div>
      ))}

      {isForm && (
        <div className="modal-overlay" onClick={() => setIsForm(false)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editCat ? '✏️ Sửa Danh Mục' : '➕ Thêm Danh Mục'}</h3>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setIsForm(false)}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="form-group">
                  <label className="form-label">Tên Danh Mục *</label>
                  <input type="text" className="form-input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div className="form-group">
                    <label className="form-label">Nhóm</label>
                    <select className="form-select" value={form.group_type} onChange={(e) => setForm((f) => ({ ...f, group_type: e.target.value }))}>
                      <option value="system">🖥️ Hệ Thống</option>
                      <option value="customer">💬 Khách Hàng</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Icon (Emoji)</label>
                    <input type="text" className="form-input" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="📋" />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Màu</label>
                  <input type="color" className="form-input" style={{ height: 40, padding: 4, cursor: 'pointer' }} value={form.color} onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsForm(false)}>Huỷ</button>
                <button type="submit" className="btn btn-primary">{editCat ? '💾 Cập Nhật' : '➕ Thêm'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── About Tab ───
function AboutTab({ theme, setTheme }: { theme: 'dark' | 'light'; setTheme: (t: 'dark' | 'light') => void }) {
  return (
    <div>
      <h3 className={styles.sectionTitle}>ℹ️ Thông Tin Ứng Dụng</h3>
      <div className={`card ${styles.syncCard}`}>
        <div className={styles.aboutGrid}>
          <div>
            <span className={styles.aboutLabel}>Tên</span>
            <span className={styles.aboutVal}>CheckOps - Quản Lý Vận Hành</span>
          </div>
          <div>
            <span className={styles.aboutLabel}>Phiên Bản</span>
            <span className={styles.aboutVal}>2.1.0</span>
          </div>
          <div>
            <span className={styles.aboutLabel}>Stack</span>
            <span className={styles.aboutVal}>Electron + Supabase Cloud + Real-time</span>
          </div>
          <div>
            <span className={styles.aboutLabel}>Database</span>
            <span className={styles.aboutVal}>PostgreSQL (Supabase)</span>
          </div>
        </div>
        <div className="divider" />
        <div>
          <div className={styles.aboutLabel} style={{ marginBottom: 8 }}>Giao Diện</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTheme('dark')}>
              🌙 Dark Mode
            </button>
            <button className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setTheme('light')}>
              ☀️ Light Mode
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
