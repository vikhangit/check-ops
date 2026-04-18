import { ipcMain } from 'electron'
import { TemplateRepository } from '../database/repositories/TemplateRepository'

const repo = new TemplateRepository()

export function registerTemplateHandlers() {
  ipcMain.handle('template:getAll', () => repo.getAll())
  ipcMain.handle('template:create', (_event, data) => repo.create(data))
  ipcMain.handle('template:update', (_event, id: string, data) => repo.update(id, data))
  ipcMain.handle('template:delete', (_event, id: string) => repo.delete(id))
  ipcMain.handle('template:reorder', (_event, ids: string[]) => {
    repo.reorder(ids)
    return { success: true }
  })
}
