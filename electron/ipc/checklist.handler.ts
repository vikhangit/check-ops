import { ipcMain } from 'electron'
import { ChecklistRepository } from '../database/repositories/ChecklistRepository'

const repo = new ChecklistRepository()

export function registerChecklistHandlers() {
  ipcMain.handle('checklist:getByDate', (_event, date: string) => {
    return repo.getByDate(date)
  })

  ipcMain.handle('checklist:getAll', (_event, filters) => {
    return repo.getAll(filters)
  })

  ipcMain.handle('checklist:create', (_event, data) => {
    return repo.create(data)
  })

  ipcMain.handle('checklist:update', (_event, id: string, data) => {
    return repo.update(id, data)
  })

  ipcMain.handle('checklist:updateStatus', (_event, id: string, status: string, notes?: string) => {
    return repo.updateStatus(id, status, notes)
  })

  ipcMain.handle('checklist:delete', (_event, id: string) => {
    return repo.delete(id)
  })

  ipcMain.handle('checklist:duplicateFromDate', (_event, fromDate: string, toDate: string) => {
    return repo.duplicateFromDate(fromDate, toDate)
  })

  ipcMain.handle('checklist:generateFromTemplates', (_event, date: string) => {
    return repo.generateFromTemplates(date)
  })

  ipcMain.handle('checklist:getStats', (_event, params) => {
    return repo.getStats(params)
  })
}
