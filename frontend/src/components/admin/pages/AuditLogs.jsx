import { useState, useCallback } from 'react'
import useAuditLogs from '../hooks/useAuditLogs'

const ACTION_LABELS = {
  ADMIN_UPDATE_BORROW_RULES: 'Update Borrow Rules',
  ADMIN_UPDATE_FINE_RATE: 'Update Fine Rate',
  ADMIN_CREATE_LIBRARIAN: 'Create Librarian',
  ADMIN_UPDATE_LIBRARIAN: 'Update Librarian',
  ADMIN_DELETE_LIBRARIAN: 'Delete Librarian',
  ADMIN_UPDATE_USER_ROLE: 'Update User Role',
  ADMIN_RESET_PASSWORD: 'Reset Password'
}

const ENTITY_LABELS = {
  Config: 'System Config',
  User: 'User',
  Loan: 'Loan',
  Book: 'Book'
}

const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))
const ENTITY_OPTIONS = Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }))

const getActionLabel = (action) => ACTION_LABELS[action] || action || 'Unknown Action'
const getEntityLabel = (entity) => ENTITY_LABELS[entity] || entity || '—'

const formatDateTime = (dateStr) => {
  if (!dateStr) return '—'
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) return dateStr
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    const pad = (n) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  } catch {
    return dateStr
  }
}

const truncateText = (text, max = 56) => {
  if (!text) return ''
  return text.length > max ? `${text.slice(0, max)}…` : text
}

const parseDetail = (detail) => {
  if (!detail) return null
  if (typeof detail !== 'string') return detail
  try {
    return JSON.parse(detail)
  } catch {
    return detail
  }
}

const toReadableKey = (key) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (ch) => ch.toUpperCase())

const normalizeValue = (value) => {
  if (value === null || value === undefined || value === '') return '—'
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value === 'number') return String(value)
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    if (!value.length) return '[]'
    return value
      .map((item) => (typeof item === 'object' ? JSON.stringify(item) : String(item)))
      .join(', ')
  }
  return JSON.stringify(value)
}

const flattenDetail = (value, prefix = '') => {
  if (value === null || value === undefined) {
    return prefix ? [{ key: prefix, value: '—' }] : []
  }

  if (Array.isArray(value) || typeof value !== 'object') {
    return prefix ? [{ key: prefix, value: normalizeValue(value) }] : [{ key: 'Detail', value: normalizeValue(value) }]
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (nested && typeof nested === 'object' && !Array.isArray(nested)) {
      return flattenDetail(nested, nextKey)
    }
    return [{ key: nextKey, value: normalizeValue(nested) }]
  })
}

const buildPreviewItems = (detail) => {
  const parsed = parseDetail(detail)
  if (!parsed) return []
  if (typeof parsed === 'string') return [truncateText(parsed, 90)]

  const entries = flattenDetail(parsed).slice(0, 3)
  return entries.map((entry) => `${toReadableKey(entry.key)}: ${truncateText(entry.value, 28)}`)
}

const DetailModal = ({ log, onClose }) => {
  if (!log) return null

  const detailParsed = parseDetail(log.detail)
  const detailRows = typeof detailParsed === 'string'
    ? [{ key: 'Detail', value: detailParsed }]
    : flattenDetail(detailParsed)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content audit-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header audit-modal-header">
          <h3>Audit Log Details</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body audit-modal-body">
          <div className="audit-meta-grid">
            <div className="audit-meta-card">
              <span className="audit-meta-label">Operator</span>
              <span className="audit-meta-value">
                {log.operator ? `${log.operator.name} (${log.operator.email})` : 'System / Deleted User'}
              </span>
            </div>
            <div className="audit-meta-card">
              <span className="audit-meta-label">Action</span>
              <span className="audit-meta-value">
                {getActionLabel(log.action)}
                <code>{log.action}</code>
              </span>
            </div>
            <div className="audit-meta-card">
              <span className="audit-meta-label">Entity</span>
              <span className="audit-meta-value">{getEntityLabel(log.entity)}</span>
            </div>
            <div className="audit-meta-card">
              <span className="audit-meta-label">Timestamp</span>
              <span className="audit-meta-value">{formatDateTime(log.createdAt)}</span>
            </div>
            <div className="audit-meta-card audit-meta-card-wide">
              <span className="audit-meta-label">Log ID</span>
              <span className="audit-meta-value"><code>{log.id || '—'}</code></span>
            </div>
            <div className="audit-meta-card audit-meta-card-wide">
              <span className="audit-meta-label">Entity ID</span>
              <span className="audit-meta-value"><code>{log.entityId || '—'}</code></span>
            </div>
          </div>

          <div className="audit-detail-section">
            <h4>Detail Breakdown</h4>
            {detailRows.length ? (
              <div className="audit-detail-list">
                {detailRows.map((item, index) => (
                  <div key={`${item.key}-${index}`} className="audit-detail-row">
                    <span className="audit-detail-key">{toReadableKey(item.key)}</span>
                    <span className="audit-detail-value">{item.value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="audit-empty-detail">No detail payload provided.</div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

const AuditLogs = () => {
  const { query, data, loading, error, setQueryPart, reload } = useAuditLogs()
  const [selectedLog, setSelectedLog] = useState(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const totalPages = Math.max(1, Math.ceil(data.total / data.size))

  const handleOpenDetail = useCallback((log) => {
    setSelectedLog(log)
    setDetailOpen(true)
  }, [])

  const handleCloseDetail = useCallback(() => {
    setDetailOpen(false)
    setTimeout(() => setSelectedLog(null), 200)
  }, [])

  const handleFilterChange = useCallback((field, value) => {
    setQueryPart({ [field]: value })
  }, [setQueryPart])

  const handleReset = useCallback(() => {
    setQueryPart({ operator: '', action: '', entity: '', from: '', to: '', page: 1 })
  }, [setQueryPart])

  return (
    <div className="content audit-logs-page">
      <div className="page-header audit-page-header">
        <h2>Audit Logs</h2>
        <p className="audit-subtitle">
          Review admin operations with readable summaries and rich detail breakdown.
        </p>
      </div>

      <div className="search-section audit-filter-panel">
        <div className="audit-filter-title-row">
          <h3>Filter Controls</h3>
          <span>Use keyword + category filters to narrow the timeline</span>
        </div>
        <div className="search-form audit-search-form">
          <div className="search-field audit-field audit-field-operator">
            <label className="search-label">Operator Search</label>
            <input
              className="search-input"
              placeholder="Search by operator name, email, or id"
              value={query.operator}
              onChange={(e) => handleFilterChange('operator', e.target.value)}
            />
          </div>

          <div className="search-field audit-field">
            <label className="search-label">Action</label>
            <select
              className="search-select"
              value={query.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            >
              <option value="">All actions</option>
              {ACTION_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="search-field audit-field">
            <label className="search-label">Entity</label>
            <select
              className="search-select"
              value={query.entity}
              onChange={(e) => handleFilterChange('entity', e.target.value)}
            >
              <option value="">All entities</option>
              {ENTITY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>

          <div className="search-field audit-field">
            <label className="search-label">From</label>
            <input
              type="date"
              className="search-input"
              value={query.from ? query.from.slice(0, 10) : ''}
              onChange={(e) => handleFilterChange('from', e.target.value ? `${e.target.value} 00:00:00` : '')}
            />
          </div>

          <div className="search-field audit-field">
            <label className="search-label">To</label>
            <input
              type="date"
              className="search-input"
              value={query.to ? query.to.slice(0, 10) : ''}
              onChange={(e) => handleFilterChange('to', e.target.value ? `${e.target.value} 23:59:59` : '')}
            />
          </div>

          <div className="search-actions audit-search-actions">
            <button className="search-btn" onClick={reload}>Apply Filters</button>
            <button className="btn-secondary" onClick={handleReset}>Reset</button>
          </div>
        </div>
      </div>

      {error && (
        <div className="audit-error-banner">
          <span>{error || 'Failed to load audit logs.'}</span>
          <button onClick={reload} className="btn-sm audit-retry-btn">Retry</button>
        </div>
      )}

      <div className="table-section audit-table-panel">
        <h3>Operation Timeline</h3>
        {loading ? (
          <div className="loading">Loading audit logs...</div>
        ) : (
          <>
            <table className="data-table audit-data-table">
              <thead>
                <tr>
                  <th>Operator</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Entity ID</th>
                  <th>Detail Preview</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {data.list.map((log) => {
                  const previewItems = buildPreviewItems(log.detail)
                  return (
                    <tr key={log.id} onClick={() => handleOpenDetail(log)} className="audit-row">
                      <td>
                        {log.operator ? (
                          <div className="audit-operator">
                            <div>{log.operator.name}</div>
                            <div className="audit-operator-email">{log.operator.email}</div>
                          </div>
                        ) : (
                          <span className="audit-muted">System / Deleted user</span>
                        )}
                      </td>
                      <td>
                        <span className="audit-action-badge">{getActionLabel(log.action)}</span>
                      </td>
                      <td>{getEntityLabel(log.entity)}</td>
                      <td>{log.entityId ? <code>{truncateText(log.entityId, 18)}</code> : '—'}</td>
                      <td>
                        {previewItems.length ? (
                          <div className="audit-preview-list">
                            {previewItems.map((item) => (
                              <span key={item} className="audit-preview-pill">{item}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="audit-muted">No detail</span>
                        )}
                      </td>
                      <td>{formatDateTime(log.createdAt)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {data.list.length === 0 && <div className="no-data">No audit logs found.</div>}

            <div className="form-actions audit-pagination">
              <span className="audit-pagination-summary">
                Total {data.total} records · Page {data.page}/{totalPages}
                <select
                  value={data.size}
                  onChange={(e) => setQueryPart({ size: Number(e.target.value), page: 1 })}
                  className="search-select"
                >
                  {[5, 10, 20, 50].map((size) => <option key={size} value={size}>{size} rows / page</option>)}
                </select>
              </span>
              <div className="audit-pagination-actions">
                <button
                  className="btn-secondary"
                  onClick={() => setQueryPart({ page: query.page - 1 })}
                  disabled={query.page <= 1}
                >
                  Previous
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => setQueryPart({ page: query.page + 1 })}
                  disabled={query.page >= totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {detailOpen && selectedLog && (
        <DetailModal log={selectedLog} onClose={handleCloseDetail} />
      )}
    </div>
  )
}

export default AuditLogs
