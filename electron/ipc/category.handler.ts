import { ipcMain } from 'electron'
import { CategoryRepository } from '../database/repositories/CategoryRepository'

const repo = new CategoryRepository()

export function registerCategoryHandlers() {
  ipcMain.handle('category:getAll', () => repo.getAll())
  ipcMain.handle('category:create', (_event, data) => repo.create(data))
  ipcMain.handle('category:update', (_event, id: string, data) => repo.update(id, data))
  ipcMain.handle('category:delete', (_event, id: string) => repo.delete(id))
}
