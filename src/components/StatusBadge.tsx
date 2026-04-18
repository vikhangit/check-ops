interface Props {
  status: 'pending' | 'in_progress' | 'done' | 'error'
  showLabel?: boolean
}

const STATUS_CONFIG = {
  pending: { label: 'Chưa làm', icon: '⭕', class: 'badge-pending' },
  in_progress: { label: 'Đang làm', icon: '🔄', class: 'badge-in_progress' },
  done: { label: 'Hoàn thành', icon: '✅', class: 'badge-done' },
  error: { label: 'Lỗi', icon: '❌', class: 'badge-error' },
}

export function StatusBadge({ status, showLabel = true }: Props) {
  const config = STATUS_CONFIG[status]

  return (
    <span className={`badge ${config.class}`}>
      {config.icon}
      {showLabel && <span>{config.label}</span>}
    </span>
  )
}
