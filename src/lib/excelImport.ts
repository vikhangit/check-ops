import ExcelJS from 'exceljs'
import { saveAs } from 'file-saver'

/**
 * Create and download a sample Excel template for template import
 */
export async function downloadTemplateSample() {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('Templates')

  // Set column headers
  worksheet.columns = [
    { header: 'Tên Template', key: 'title', width: 30 },
    { header: 'Mô Tả', key: 'description', width: 40 },
    { header: 'Danh Mục', key: 'category_name', width: 20 },
    { header: 'Người Phụ Trách', key: 'assigned_user_name', width: 20 },
    { header: 'Ưu Tiên', key: 'priority', width: 15 },
    { header: 'Trạng Thái', key: 'status', width: 15 },
    { header: 'Template Con 1', key: 'subitem1', width: 25 },
    { header: 'Template Con 2', key: 'subitem2', width: 25 },
    { header: 'Template Con 3', key: 'subitem3', width: 25 },
    { header: 'Template Con 4', key: 'subitem4', width: 25 },
    { header: 'Template Con 5', key: 'subitem5', width: 25 },
  ]

  // Style the header row
  worksheet.getRow(1).font = { bold: true }
  worksheet.getRow(1).fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFE6F3FF' }
  }

  // Add sample data
  worksheet.addRow({
    title: 'Kiểm tra an toàn buổi sáng',
    description: 'Kiểm tra các thiết bị an toàn và bảo vệ trước khi bắt đầu làm việc',
    category_name: 'An toàn',
    assigned_user_name: 'Nguyễn Văn A',
    priority: 'high',
    status: 'active',
    subitem1: 'Kiểm tra hệ thống chữa cháy',
    subitem2: 'Kiểm tra thiết bị bảo hộ',
    subitem3: 'Kiểm tra đường thoát hiểm',
    subitem4: '',
    subitem5: ''
  })

  worksheet.addRow({
    title: 'Bảo trì máy móc',
    description: 'Bảo trì định kỳ các máy móc và thiết bị sản xuất',
    category_name: 'Bảo trì',
    assigned_user_name: 'Trần Thị B',
    priority: 'normal',
    status: 'active',
    subitem1: 'Kiểm tra dầu máy',
    subitem2: 'Vệ sinh bộ lọc',
    subitem3: 'Kiểm tra dây đai',
    subitem4: 'Lubri các khớp nối',
    subitem5: ''
  })

  worksheet.addRow({
    title: 'Đóng gói sản phẩm',
    description: 'Quy trình đóng gói và kiểm tra chất lượng sản phẩm cuối cùng',
    category_name: 'Sản xuất',
    assigned_user_name: '',
    priority: 'low',
    status: 'active',
    subitem1: 'Kiểm tra bao bì',
    subitem2: 'Đóng gói theo tiêu chuẩn',
    subitem3: 'Dán nhãn sản phẩm',
    subitem4: 'Kiểm tra trọng lượng',
    subitem5: 'Bảo quản đúng cách'
  })

  // Add instructions
  worksheet.addRow({}) // Empty row
  const instructionRow = worksheet.addRow({
    title: 'HƯỚNG DẪN SỬ DỤNG:'
  })
  instructionRow.font = { bold: true, color: { argb: 'FF0000FF' } }

  worksheet.addRow({
    title: '1. Tên Template: Bắt buộc nhập'
  })
  worksheet.addRow({
    title: '2. Mô Tả: Có thể để trống'
  })
  worksheet.addRow({
    title: '3. Danh Mục: Tên danh mục (phải khớp với danh mục có sẵn)'
  })
  worksheet.addRow({
    title: '4. Người Phụ Trách: Tên người dùng (có thể để trống)'
  })
  worksheet.addRow({
    title: '5. Ưu Tiên: high/normal/low'
  })
  worksheet.addRow({
    title: '6. Trạng Thái: active/inactive'
  })
  worksheet.addRow({
    title: '7. Template Con: Có thể có tối đa 5 mục con (có thể để trống)'
  })

  // Create buffer and download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  saveAs(blob, 'Mau_Import_Template.xlsx')
}

/**
 * Parse Excel file and return template data
 */
export async function parseTemplateExcel(file: File): Promise<Array<{
  title: string
  description?: string
  category_name?: string
  assigned_user_name?: string
  priority: 'low' | 'normal' | 'high'
  is_active: number
  sub_items: Array<{ id: string; title: string; status: string; notes: string }>
}>> {
  const workbook = new ExcelJS.Workbook()
  await workbook.xlsx.load(await file.arrayBuffer())

  const worksheet = workbook.getWorksheet(1)
  if (!worksheet) {
    throw new Error('Không tìm thấy worksheet trong file Excel')
  }

  const templates: Array<{
    title: string
    description?: string
    category_name?: string
    assigned_user_name?: string
    priority: 'low' | 'normal' | 'high'
    is_active: number
    sub_items: Array<{ id: string; title: string; status: string; notes: string }>
  }> = []

  // Skip header row, start from row 2
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex++) {
    const row = worksheet.getRow(rowIndex)

    // Skip empty rows or instruction rows
    const title = row.getCell(1).value?.toString()?.trim()
    if (!title || title.includes('HƯỚNG DẪN') || title.includes(':')) continue

    const description = row.getCell(2).value?.toString()?.trim() || ''
    const category_name = row.getCell(3).value?.toString()?.trim() || ''
    const assigned_user_name = row.getCell(4).value?.toString()?.trim() || ''
    const priorityStr = row.getCell(5).value?.toString()?.trim()?.toLowerCase() || 'normal'
    const statusStr = row.getCell(6).value?.toString()?.trim()?.toLowerCase() || 'active'

    // Validate priority
    const priority = ['low', 'normal', 'high'].includes(priorityStr) ? priorityStr as 'low' | 'normal' | 'high' : 'normal'

    // Validate status
    const is_active = statusStr === 'active' ? 1 : 0

    // Collect sub-items
    const sub_items: Array<{ id: string; title: string; status: string; notes: string }> = []
    for (let col = 7; col <= 11; col++) { // Columns G to K (subitem1 to subitem5)
      const subItemTitle = row.getCell(col).value?.toString()?.trim()
      if (subItemTitle) {
        sub_items.push({
          id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: subItemTitle,
          status: 'pending',
          notes: ''
        })
      }
    }

    templates.push({
      title,
      description: description || undefined,
      category_name: category_name || undefined,
      assigned_user_name: assigned_user_name || undefined,
      priority,
      is_active,
      sub_items
    })
  }

  if (templates.length === 0) {
    throw new Error('Không tìm thấy template nào trong file Excel')
  }

  return templates
}