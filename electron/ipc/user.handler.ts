import { ipcMain } from 'electron'
import { UserRepository } from '../database/repositories/UserRepository'

const repo = new UserRepository()

export function registerUserHandlers() {
  ipcMain.handle('user:getAll', () => repo.getAll())

  ipcMain.handle('user:login', (_event, name: string, password: string) => {
    const user = repo.findByCredentials(name, password)
    if (!user) return { success: false, message: 'Tên đăng nhập hoặc mật khẩu không đúng' }
    return {
      success: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
      },
    }
  })

  ipcMain.handle('user:create', (_event, data) => repo.create(data))
  ipcMain.handle('user:update', (_event, id: string, data) => repo.update(id, data))
  ipcMain.handle('user:delete', (_event, id: string) => repo.delete(id))

  ipcMain.handle('user:updatePassword', (_event, id: string, oldPwd: string, newPwd: string) => {
    const ok = repo.updatePassword(id, oldPwd, newPwd)
    return { success: ok, message: ok ? 'Đổi mật khẩu thành công' : 'Mật khẩu cũ không đúng' }
  })
}
