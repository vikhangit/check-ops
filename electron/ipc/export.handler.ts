import { ipcMain, dialog, BrowserWindow } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import ExcelJS from 'exceljs'

const statusLabels: Record<string, string> = { 
  done: 'Hoàn&nbsp;thành', 
  error: 'Lỗi', 
  in_progress: 'Đang&nbsp;làm', 
  pending: 'Chưa&nbsp;làm' 
}

const statusColors: Record<string, string> = {
  done: '#10b981', // green-500
  error: '#ef4444', // red-500
  in_progress: '#3b82f6', // blue-500
  pending: '#94a3b8'  // slate-400
}

const priorityLabels: Record<string, string> = { 
  high: 'Cao !!!', 
  normal: 'Bình thường', 
  low: 'Thấp' 
}

const priorityColors: Record<string, string> = {
  high: '#ef4444',
  normal: '#3b82f6',
  low: '#94a3b8'
}

function esc(str: any) { 
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') 
}

function formatDateTime(value: any) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

let isPdfExporting = false

export function registerExportHandlers() {
  ipcMain.handle('export:toExcel', async (event, { items, dateRange, title }: any) => {
    const parentWin = BrowserWindow.fromWebContents(event.sender)
    const { filePath } = await dialog.showSaveDialog(parentWin!, {
      title: 'Xuất Excel', 
      defaultPath: `BaoCao-${dateRange}.xlsx`, 
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    })
    if (!filePath) return { success: false, message: 'Huỷ' }
    try {
      const wb = new ExcelJS.Workbook()
      const mainSheet = wb.addWorksheet('Cong Viec Chinh')
      const subSheet = wb.addWorksheet('Chi Tiet Muc Con')
      const errorSheet = wb.addWorksheet('Bien Ban Loi')

      const rowHeight = 28
      const headerStyle = (cell: any, bgColor = 'FF1E1B4B') => {
        cell.font = { name: 'Be Vietnam Pro', bold: true, color: { argb: 'FFFFFFFF' }, size: 12 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bgColor } }
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' }
        }
      }

      const titleStyle = (cell: any, color = 'FF1E1B4B', size = 18) => {
        cell.font = { name: 'Be Vietnam Pro', bold: true, color: { argb: color }, size: size }
        cell.alignment = { horizontal: 'center', vertical: 'middle' }
      }

      const borderGreen: Partial<ExcelJS.Borders> = {
        top: { style: 'medium', color: { argb: 'FF059669' } },
        left: { style: 'medium', color: { argb: 'FF059669' } },
        bottom: { style: 'medium', color: { argb: 'FF059669' } },
        right: { style: 'medium', color: { argb: 'FF059669' } }
      }

      // --- Sheet 1: Cong Viec Chinh ---
      mainSheet.columns = [
        { key: 'index', width: 6 },
        { key: 'date', width: 14 },
        { key: 'title', width: 35 },
        { key: 'description', width: 45 },
        { key: 'category_name', width: 18 },
        { key: 'assigned_user_name', width: 18 },
        { key: 'status', width: 15 },
        { key: 'priority', width: 15 },
        { key: 'check_time', width: 20 },
        { key: 'notes', width: 28 },
        { key: 'sub_total', width: 14 },
        { key: 'sub_error', width: 14 },
        { key: 'sub_done', width: 14 },
        { key: 'sub_remaining', width: 16 }
      ]

      // Title row 1
      const mainTitle1 = mainSheet.addRow([`Bao Cao Van Hanh CheckOps (${dateRange})`])
      mainSheet.mergeCells(1, 1, 1, 14)
      mainTitle1.height = 45
      titleStyle(mainTitle1.getCell(1), 'FF1E1B4B', 20)
      mainTitle1.getCell(1).border = borderGreen

      // Title row 2: Stats & Export Time
      const now = new Date()
      const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')} ${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`
      const mainTitle2 = mainSheet.addRow([`Xuất lúc: ${timeStr} | Tong: ${items.length} cong viec`])
      mainSheet.mergeCells(2, 1, 2, 14)
      mainTitle2.height = 20
      mainTitle2.getCell(1).font = { name: 'Be Vietnam Pro', italic: true, size: 10, color: { argb: 'FF64748B' } }
      mainTitle2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }

      // Header row 3
      const mainHeader = mainSheet.addRow(['STT', 'Ngay', 'Cong Viec', 'Mo Ta', 'Danh Muc', 'Nguoi Phu Trach', 'Trang Thai', 'Uu Tien', 'Check Luc', 'Ghi Chu', 'Muc Con (Tong)', 'Muc Con Loi', 'Muc Con Done', 'Muc Con Ton Dong'])
      mainHeader.eachCell((cell) => headerStyle(cell))
      mainHeader.height = rowHeight

      // --- Sheet 2: Chi Tiet Muc Con ---
      subSheet.columns = [
        { key: 'index', width: 6 },
        { key: 'date', width: 14 },
        { key: 'parent_title', width: 35 },
        { key: 'sub_title', width: 35 },
        { key: 'status', width: 15 },
        { key: 'has_error', width: 10 },
        { key: 'error_description', width: 35 },
        { key: 'reported_to', width: 22 },
        { key: 'handled_by', width: 22 },
        { key: 'error_status', width: 15 }
      ]

      const subTitle = subSheet.addRow([`CHI TIET MUC CON - ${dateRange.replace(' - ', ' den ')}`])
      subSheet.mergeCells(1, 1, 1, 10)
      subTitle.height = 45
      titleStyle(subTitle.getCell(1), 'FF1E1B4B', 20)
      subTitle.getCell(1).border = borderGreen

      const subHeader = subSheet.addRow(['STT', 'Ngay', 'Cong Viec Chinh', 'Muc Con', 'Trang Thai', 'Co Loi', 'Mo Ta Loi', 'Bo Phan Tiep Nhan', 'Nguoi Xu Ly', 'Trang Thai Loi'])
      subHeader.eachCell((cell) => headerStyle(cell))
      subHeader.height = rowHeight

      // --- Sheet 3: Bien Ban Loi ---
      errorSheet.columns = [
        { key: 'index', width: 6 },
        { key: 'date', width: 14 },
        { key: 'parent_title', width: 35 },
        { key: 'sub_title', width: 35 },
        { key: 'error_description', width: 35 },
        { key: 'reported_to', width: 22 },
        { key: 'handled_by', width: 22 },
        { key: 'reported_at', width: 20 },
        { key: 'resolved_at', width: 20 },
        { key: 'waiting_time', width: 18 },
        { key: 'status', width: 15 }
      ]

      const errorTitle = errorSheet.addRow([`BIEN BAN LOI MUC KIEM TRA - ${dateRange.replace(' - ', ' den ')}`])
      errorSheet.mergeCells(1, 1, 1, 11)
      errorTitle.height = 45
      titleStyle(errorTitle.getCell(1), 'FFEF4444', 20)
      errorTitle.getCell(1).border = borderGreen

      const errorHeader = errorSheet.addRow(['STT', 'Ngay', 'Cong Viec Chinh', 'Muc Kiem Tra', 'Mo Ta Loi', 'Bo Phan Tiep Nhan', 'Nguoi Xu Ly', 'TG Phat Hien', 'TG Giai Quyet', 'Thoi Gian Cho', 'Trang Thai'])
      errorHeader.eachCell((cell) => headerStyle(cell, 'FFEF4444'))
      errorHeader.height = rowHeight

      let totalErrorCount = 0
      let resolvedErrorCount = 0

      // Sort items: Sort Order ASC (Primary), then Date DESC (Secondary)
      const sortedItems = [...items].sort((a, b) => {
        const sa = Number(a.sort_order || 9999)
        const sb = Number(b.sort_order || 9999)
        if (sa !== sb) return sa - sb
        
        const da = new Date(a.date).getTime()
        const db = new Date(b.date).getTime()
        return db - da
      })

      sortedItems.forEach((it: any, i: number) => {
        const subs = Array.isArray(it.sub_items) ? it.sub_items : []
        const subTotal = subs.length
        const subDone = subs.filter((sub: any) => sub.status === 'done').length
        const subError = subs.filter((sub: any) => sub.status === 'error').length
        const subRemaining = subTotal - subDone

        const mainRow = mainSheet.addRow([
          i + 1,
          it.date || '',
          it.title || '',
          it.description || '',
          it.category_name || '',
          it.assigned_user_name || '',
          (statusLabels[it.status] || it.status).replace(/&nbsp;/g, ' '),
          priorityLabels[it.priority] || '',
          it.check_time ? formatDateTime(it.check_time) : '',
          it.notes || '',
          subTotal,
          subError,
          subDone,
          subRemaining
        ])
        mainRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
          cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
          cell.font = { name: 'Be Vietnam Pro', size: 11 }
          
          // Status styling
          if (colNumber === 7) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
            if (it.status === 'pending') {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA1A1AA' } }
              cell.font = { name: 'Be Vietnam Pro', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 }
            }
          }
          // Priority styling
          if (colNumber === 8) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' }
            if (it.priority === 'high') {
              cell.font = { name: 'Be Vietnam Pro', color: { argb: 'FFEF4444' }, bold: true, size: 11 }
            }
          }
        })
        mainRow.height = 30

        subs.forEach((sub: any, subIndex: number) => {
          const hasError = !!sub.error_details
          const errorDetails = sub.error_details || {}
          if (hasError) {
            totalErrorCount++
            if (errorDetails.is_resolved) resolvedErrorCount++
          }

          const reportedAt = errorDetails.reported_at ? formatDateTime(errorDetails.reported_at) : ''
          const resolvedAt = errorDetails.resolved_at ? formatDateTime(errorDetails.resolved_at) : ''
          const waitingTime = errorDetails.reported_at && errorDetails.resolved_at
            ? `${Math.round((new Date(errorDetails.resolved_at).getTime() - new Date(errorDetails.reported_at).getTime()) / 60000)} phút`
            : ''
          
          const subRow = subSheet.addRow([
            subIndex + 1,
            it.date || '',
            it.title || '',
            sub.title || '',
            (statusLabels[sub.status] || sub.status).replace(/&nbsp;/g, ' '),
            hasError ? 'Có' : 'Không',
            errorDetails.description || '',
            errorDetails.reported_to || '',
            errorDetails.handled_by || '',
            hasError ? (errorDetails.is_resolved ? 'Đã xử lý' : 'Chưa xử lý') : ''
          ])
          subRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
            cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
            cell.font = { name: 'Be Vietnam Pro', size: 11 }
            
            if (colNumber === 5) {
              cell.alignment = { horizontal: 'center', vertical: 'middle' }
              if (sub.status === 'pending') {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA1A1AA' } }
                cell.font = { name: 'Be Vietnam Pro', color: { argb: 'FFFFFFFF' }, bold: true, size: 11 }
              }
            }
          })
          subRow.height = 30

          if (hasError) {
            const errorRow = errorSheet.addRow([
              subIndex + 1,
              it.date || '',
              it.title || '',
              sub.title || '',
              errorDetails.description || '',
              errorDetails.reported_to || '',
              errorDetails.handled_by || '',
              reportedAt,
              resolvedAt,
              waitingTime,
              (statusLabels[sub.status] || sub.status).replace(/&nbsp;/g, ' ')
            ])
            errorRow.eachCell({ includeEmpty: true }, (cell) => {
              cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } }
              cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true }
              cell.font = { name: 'Be Vietnam Pro', size: 11 }
            })
            errorRow.height = 30
          }
        })
      })

      // Add summary row to error sheet if no errors or at end
      if (totalErrorCount === 0) {
        const noErrorRow = errorSheet.addRow(['Khong co loi nao trong ky nay'])
        errorSheet.mergeCells(noErrorRow.number, 1, noErrorRow.number, 11)
        noErrorRow.getCell(1).font = { name: 'Be Vietnam Pro', italic: true }
      }
      
      const summaryRow = errorSheet.addRow([`Tong Ton dong: ${totalErrorCount - resolvedErrorCount} Da xu ly: ${resolvedErrorCount}`])
      errorSheet.mergeCells(summaryRow.number, 1, summaryRow.number, 11)
      summaryRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } } // pink-100
      summaryRow.getCell(1).font = { name: 'Be Vietnam Pro', bold: true }
      summaryRow.height = 25

      await wb.xlsx.writeFile(filePath)
      return { success: true, filePath }
    } catch (e: any) {
      if (e.code === 'EBUSY') return { success: false, message: 'Lỗi: File đang được mở bởi ứng dụng khác. Vui lòng đóng file trước khi xuất.' }
      return { success: false, message: String(e) }
    }
  })

  ipcMain.handle('export:toPdf', async (event, { items, dateRange, title }: any) => {
    const exportId = Math.random().toString(36).substring(7)
    console.log(`[PDF ${exportId}] Starting export with ${items.length} items`)
    if (items.length > 0) {
      console.log(`[PDF ${exportId}] First item:`, JSON.stringify(items[0], null, 2))
    }
    
    if (isPdfExporting) {
      return { success: false, message: 'Hệ thống đang bận xuất PDF khác.' }
    }

    isPdfExporting = true
    let workerWin: BrowserWindow | null = null
    let tmpPath: string | null = null

    try {
      const senderWin = BrowserWindow.fromWebContents(event.sender)
      const { filePath, canceled } = await dialog.showSaveDialog(senderWin || undefined as any, {
        title: 'Lưu file PDF',
        defaultPath: `BaoCao-CheckOps-${dateRange}.pdf`,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }]
      })

      if (canceled || !filePath) {
        return { success: false, message: 'Huỷ xuất file' }
      }

      // Calculate stats
      const stats = {
        total: items.length,
        done: items.filter((it: any) => it.status === 'done').length,
        pending: items.filter((it: any) => it.status === 'pending').length,
        in_progress: items.filter((it: any) => it.status === 'in_progress').length,
      }

      // Sort items: Sort Order ASC (Primary), then Date DESC (Secondary)
      const sortedItems = [...items].sort((a, b) => {
        const sa = Number(a.sort_order || 9999)
        const sb = Number(b.sort_order || 9999)
        if (sa !== sb) return sa - sb
        
        const da = new Date(a.date).getTime()
        const db = new Date(b.date).getTime()
        return db - da
      })

      const rows = sortedItems.map((it: any, i: number) => {
        const subs = Array.isArray(it.sub_items) ? it.sub_items : []
        const subTotal = subs.length
        const subError = subs.filter((sub: any) => sub.status === 'error').length

        // Render sub-items rows if any
        let subItemsHtml = ''
        if (subs.length > 0) {
          const subRows = subs.map((sub: any, subIdx: number) => {
            const hasError = !!sub.error_details
            const ed = sub.error_details || {}
            
            const subCheckTime = (sub.start_time || sub.end_time) 
              ? `Bắt đầu: ${formatDateTime(sub.start_time)}\nKết thúc: ${formatDateTime(sub.end_time)}`
              : ''

            return `
              <tr style="background-color: #fdfdfd; font-size: 10px;">
                <td style="text-align: center; width: 30px; border-left: 3px solid #cbd5e1;">${i + 1}.${subIdx + 1}</td>
                <td colspan="2" style="padding-left: 20px;">└─ ${esc(sub.title)}</td>
                <td colspan="3" style="color: #64748b;">
                  ${sub.result ? `<span style="color: #059669; font-weight: 600;">kết quả:</span> ${esc(sub.result)}` : ''}
                  ${hasError ? `${sub.result ? '<br/>' : ''}<span style="color: #ef4444; font-weight: 600;">⚠ Lỗi:</span> ${esc(ed.description)}` : ''}
                </td>
                <td style="text-align: center;">
                  <span class="badge" style="background-color: ${statusColors[sub.status] || '#94a3b8'}; font-size: 8px; width: 70px; padding: 2px 0;">
                    ${(statusLabels[sub.status] || sub.status).replace(/&nbsp;/g, ' ')}
                  </span>
                </td>
                <td style="width: 70px;"></td>
                <td style="width: 100px; text-align: left; font-size: 8px; color: #64748b; white-space: pre-wrap;">${esc(subCheckTime)}</td>
                <td style="width: 140px; font-size: 9px; color: #64748b; white-space: pre-wrap;">${esc(sub.notes)}</td>
                <td colspan="2"></td>
              </tr>
            `
          }).join('')
          subItemsHtml = subRows
        }

        const checkTime = it.check_time || it.updated_at || it.created_at
        
        // Generate a fresh subsNotes for THIS item only
        const itemSubs = Array.isArray(it.sub_items) ? it.sub_items : []
        const displayNotes = it.notes || ''
        
        return `
        <tr>
          <td style="text-align: center; width: 30px; font-weight: bold;">${i + 1}</td>
          <td style="width: 80px;">${esc(it.date)}</td>
          <td style="width: 170px; font-weight: 600;">${esc(it.title)}</td>
          <td style="width: 160px;" class="col-desc">${it.description ? `<div style="font-size: 11px; color: #64748b;">${esc(it.description)}</div>` : ''}</td>
          <td style="width: 80px;">${esc(it.category_name)}</td>
          <td style="width: 100px;">${esc(it.assigned_user_name)}</td>
          <td class="status-cell" style="width: 100px; min-width: 100px; text-align: center; vertical-align: middle; padding: 4px;">
             <span class="badge status-badge" style="background-color: ${statusColors[it.status] || '#94a3b8'}; font-size: 9px; width: 90px; padding: 4px 0; display: inline-block; box-sizing: border-box; border-radius: 4px; color: #fff; font-weight: 700;">
               ${(statusLabels[it.status] || it.status).replace(/&nbsp;/g, ' ')}
             </span>
          </td>
          <td class="priority-cell" style="width: 70px; text-align: center; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
             <span class="priority-badge" style="color: ${priorityColors[it.priority] || '#64748b'}; font-weight: 600; font-size: 11px; display: inline-block;">
               ${priorityLabels[it.priority] || ''}
             </span>
          </td>
          <td style="width: 100px; text-align: center; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${formatDateTime(checkTime)}</td>
          <td style="width: 140px; white-space: pre-wrap; word-break: break-word;">${esc(displayNotes)}</td>
          <td style="width: 45px; text-align: center;">${subTotal}</td>
          <td style="width: 45px; text-align: center; color: ${subError > 0 ? '#ef4444' : 'inherit'}; font-weight: ${subError > 0 ? 'bold' : 'normal'};">${subError}</td>
        </tr>
        ${subItemsHtml}`}).join('')

      const errorRowsArr: string[] = []
      let errIdx = 1
      items.forEach((it: any) => {
        const subs = Array.isArray(it.sub_items) ? it.sub_items : []
        subs.forEach((sub: any) => {
          if (sub.error_details) {
            const ed = sub.error_details
            errorRowsArr.push(`
              <tr>
                <td style="text-align: center; width: 30px;">${errIdx++}</td>
                <td style="width: 80px;">${esc(it.date)}</td>
                <td style="width: 150px;">${esc(it.title)}</td>
                <td style="width: 150px;">${esc(sub.title)}</td>
                <td style="width: 150px;">${esc(ed.description)}</td>
                <td style="width: 100px;">${esc(ed.reported_to)}</td>
                <td style="width: 100px;">${esc(ed.handled_by)}</td>
                <td style="width: 100px; text-align: center;">${formatDateTime(ed.reported_at)}</td>
                <td style="width: 100px; text-align: center;">${formatDateTime(ed.resolved_at)}</td>
                <td style="width: 60px; text-align: center;">${ed.reported_at && ed.resolved_at ? `${Math.round((new Date(ed.resolved_at).getTime() - new Date(ed.reported_at).getTime()) / 60000)}m` : ''}</td>
                <td style="width: 90px; text-align: center;">
                  <span class="badge" style="background-color: ${ed.is_resolved ? '#10b981' : '#ef4444'}; font-size: 9px; width: 80px; padding: 4px 0; border-radius: 4px;">
                    ${ed.is_resolved ? 'Đã Xử Lý' : 'Chưa Xử Lý'}
                  </span>
                </td>
              </tr>
            `)
          }
        })
      })
      const errorRows = errorRowsArr.join('')

      const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
        <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&display=swap" rel="stylesheet">
        <style>
          @page { margin: 10mm; size: A4 landscape; }
          body { font-family: 'Be Vietnam Pro', sans-serif; font-size: 11px; color: #1e293b; margin: 0; padding: 0; line-height: 1.4; }
          .header { margin-bottom: 15px; border-bottom: 2px solid #1e1b4b; padding-bottom: 8px; }
          h1 { color: #1e1b4b; margin: 0 0 5px 0; font-size: 18px; }
          h2 { color: #ef4444; margin: 25px 0 10px 0; font-size: 16px; border-left: 4px solid #ef4444; padding-left: 10px; }
          .meta { color: #64748b; font-size: 11px; }
          
          .stats-grid { display: flex; gap: 8px; margin-bottom: 15px; }
          .stat-card { flex: 1; border: 1px solid #e2e8f0; padding: 6px 10px; border-radius: 6px; background: #f8fafc; }
          .stat-label { font-size: 9px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
          .stat-value { font-size: 14px; font-weight: 700; color: #1e293b; }

          table { width: 100%; border-collapse: collapse; margin-top: 5px; table-layout: fixed; page-break-inside: auto; }
          th { background: #1e1b4b; color: white; text-align: left; padding: 8px 6px; font-size: 9px; text-transform: uppercase; white-space: nowrap; }
          td { border: 1px solid #e2e8f0; padding: 8px 6px; vertical-align: top; overflow: hidden; word-break: break-word; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          tr:nth-child(even) { background-color: #f8fafc; }
          
          .col-desc { font-size: 10px; }
          .status-cell, .priority-cell { white-space: nowrap; }
          
          .badge { 
            display: inline-block; 
            border-radius: 4px; 
            color: white; 
            font-weight: 700; 
            text-transform: uppercase;
            text-align: center;
            line-height: 1.2;
            box-sizing: border-box;
          }

          .error-header th { background: #ef4444; }
        </style>
      </head><body>
        <div class="header">
          <h1>${esc(title)}</h1>
          <div class="meta">
            Khoảng thời gian: <b>${esc(dateRange)}</b> | 
            Ngày xuất: ${new Date().toLocaleString('vi-VN')}
          </div>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">Tổng số</div>
            <div class="stat-value">${stats.total}</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #10b981;">
            <div class="stat-label">Hoàn thành</div>
            <div class="stat-value" style="color: #10b981;">${stats.done}</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #3b82f6;">
            <div class="stat-label">Đang làm</div>
            <div class="stat-value" style="color: #3b82f6;">${stats.in_progress}</div>
          </div>
          <div class="stat-card" style="border-left: 4px solid #94a3b8;">
            <div class="stat-label">Chưa làm</div>
            <div class="stat-value" style="color: #64748b;">${stats.pending}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 30px; text-align: center;">#</th>
              <th style="width: 80px;">Ngày</th>
              <th style="width: 170px;">Công việc</th>
              <th style="width: 160px;">Mô tả</th>
              <th style="width: 80px;">Danh mục</th>
              <th style="width: 100px;">Người phụ trách</th>
              <th style="width: 100px; min-width: 100px; text-align: center;">Trạng thái</th>
              <th style="width: 70px; text-align: center;">Ưu tiên</th>
              <th style="width: 100px; text-align: center;">Check lúc</th>
              <th style="width: 140px; text-align: center;">Ghi chú</th>
              <th style="width: 45px; text-align: center;">MC(T)</th>
              <th style="width: 45px; text-align: center;">MC(L)</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>

        ${errorRowsArr.length > 0 ? `
          <h2>❌ Biên Bản Lỗi Mục Kiểm Tra (${errorRowsArr.length} lỗi)</h2>
          <table>
            <thead>
              <tr class="error-header">
                <th style="width: 30px; text-align: center;">#</th>
                <th style="width: 80px;">Ngày</th>
                <th style="width: 150px;">Công việc chính</th>
                <th style="width: 150px;">Mục kiểm tra</th>
                <th style="width: 150px;">Mô tả lỗi</th>
                <th style="width: 100px;">Bộ phận</th>
                <th style="width: 100px;">Người xử lý</th>
                <th style="width: 100px; text-align: center;">Phát hiện lúc</th>
                <th style="width: 100px; text-align: center;">Giải quyết lúc</th>
                <th style="width: 60px; text-align: center;">TG xử lý</th>
                <th style="width: 90px; text-align: center;">Trạng thái</th>
              </tr>
            </thead>
            <tbody>${errorRows}</tbody>
          </table>
        ` : ''}
      </body></html>`

      tmpPath = path.join(os.tmpdir(), `checkops_${exportId}.html`)
      fs.writeFileSync(tmpPath, html, 'utf8')

      workerWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } })
      
      await Promise.race([
        workerWin.loadFile(tmpPath),
        new Promise((_, r) => setTimeout(() => r(new Error('TIMEOUT: Load File (10s)')), 10000))
      ])

      const buffer = await Promise.race([
        workerWin.webContents.printToPDF({ 
          landscape: true, 
          printBackground: true, 
          pageSize: 'A4',
          margins: { marginType: 'none' }
        }),
        new Promise<Buffer>((_, r) => setTimeout(() => r(new Error('TIMEOUT: Print PDF (15s)')), 15000))
      ])

      try {
        fs.writeFileSync(filePath, Buffer.from(buffer))
      } catch (e: any) {
        if (e.code === 'EBUSY') throw new Error('File đang được mở bởi ứng dụng khác. Vui lòng đóng file trước khi xuất.')
        throw e
      }

      return { success: true, filePath }

    } catch (err: any) {
      console.error(`[PDF ${exportId}] FATAL ERROR:`, err)
      return { success: false, message: `Lỗi: ${err.message || String(err)}` }
    } finally {
      isPdfExporting = false
      if (workerWin) { workerWin.destroy(); workerWin = null; }
      if (tmpPath && fs.existsSync(tmpPath)) { try { fs.unlinkSync(tmpPath) } catch {} }
    }
  })
}
