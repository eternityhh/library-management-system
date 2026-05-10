import { useState, useCallback } from 'react';
import useAuditLogs from '../hooks/useAuditLogs';

// ======================== 常量（中文映射） ========================

const ACTION_LABELS = {
    'ADMIN_UPDATE_BORROW_RULES': '更新借阅规则',
    'ADMIN_UPDATE_FINE_RATE': '更新罚金费率',
    'ADMIN_CREATE_LIBRARIAN': '创建馆员',
    'ADMIN_UPDATE_LIBRARIAN': '编辑馆员',
    'ADMIN_DELETE_LIBRARIAN': '删除馆员',
    'ADMIN_UPDATE_USER_ROLE': '修改用户角色',
    'ADMIN_RESET_PASSWORD': '重置密码',
};

const ENTITY_LABELS = {
    'Config': '系统配置',
    'User': '用户',
    'Loan': '借阅',
};

const ACTION_OPTIONS = Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }));
const ENTITY_OPTIONS = Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label }));

const getActionLabel = (action) => ACTION_LABELS[action] || action || '未知操作';
const getEntityLabel = (entity) => ENTITY_LABELS[entity] || entity || '—';

const formatDateTime = (dateStr) => {
    if (!dateStr) return '—';
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(dateStr)) return dateStr;
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
            `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    } catch { return dateStr; }
};

const truncateText = (text, max = 50) => {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
};

const formatJsonForDisplay = (str) => {
    if (!str) return '(无详情)';
    try { return JSON.stringify(JSON.parse(str), null, 2); } catch { return str; }
};

// ======================== 详情弹窗（使用项目统一 Modal 类名） ========================

const DetailModal = ({ log, onClose }) => {
    if (!log) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>📄 操作日志详情</h3>
                    <button className="modal-close" onClick={onClose}>×</button>
                </div>
                <div className="modal-body">
                    <table className="detail-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <tbody>
                        <tr>
                            <td style={{ fontWeight: 600, color: '#666', padding: '6px 12px', textAlign: 'right', width: 80 }}>日志ID</td>
                            <td style={{ padding: '6px 12px' }}><code>{log.id || '—'}</code></td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 600, color: '#666', padding: '6px 12px', textAlign: 'right' }}>操作者</td>
                            <td style={{ padding: '6px 12px' }}>
                                {log.operator ? (
                                    <>{log.operator.name} <span style={{ color: '#999', marginLeft: 8, fontSize: 13 }}>{log.operator.email}</span></>
                                ) : (
                                    <span style={{ color: '#999', fontStyle: 'italic' }}>系统 / 已删除</span>
                                )}
                            </td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 600, color: '#666', padding: '6px 12px', textAlign: 'right' }}>操作类型</td>
                            <td style={{ padding: '6px 12px' }}>
                                {getActionLabel(log.action)}
                                <code style={{ fontSize: 12, color: '#aaa', marginLeft: 8 }}>{log.action}</code>
                            </td>
                        </tr>
                        <tr>
                            <td style={{ fontWeight: 600, color: '#666', padding: '6px 12px', textAlign: 'right' }}>操作实体</td>
                            <td style={{ padding: '6px 12px' }}>{getEntityLabel(log.entity)}</td>
                        </tr>
                        {log.entityId && (
                            <tr>
                                <td style={{ fontWeight: 600, color: '#666', padding: '6px 12px', textAlign: 'right' }}>实体ID</td>
                                <td style={{ padding: '6px 12px' }}><code>{log.entityId}</code></td>
                            </tr>
                        )}
                        <tr>
                            <td style={{ fontWeight: 600, color: '#666', padding: '6px 12px', textAlign: 'right' }}>操作时间</td>
                            <td style={{ padding: '6px 12px' }}>{formatDateTime(log.createdAt)}</td>
                        </tr>
                        </tbody>
                    </table>

                    <div style={{ marginTop: 20 }}>
                        <h4 style={{ fontSize: 14, color: '#555', marginBottom: 8 }}>📝 详情数据</h4>
                        <pre style={{
                            background: '#1e293b', color: '#e2e8f0', borderRadius: 8, padding: 16,
                            fontSize: 13, overflowX: 'auto', whiteSpace: 'pre-wrap',
                            maxHeight: 300, overflowY: 'auto', lineHeight: 1.5
                        }}>
              {formatJsonForDisplay(log.detail)}
            </pre>
                    </div>
                </div>
                <div className="modal-footer">
                    <button className="btn-secondary" onClick={onClose}>关闭</button>
                </div>
            </div>
        </div>
    );
};

// ======================== 主组件 ========================

const AuditLogs = ({ currentUserId, onNotify }) => {
    const { query, data, loading, error, setQueryPart, reload } = useAuditLogs();
    const [selectedLog, setSelectedLog] = useState(null);
    const [detailOpen, setDetailOpen] = useState(false);

    const totalPages = Math.max(1, Math.ceil(data.total / data.size));

    const handleOpenDetail = useCallback((log) => {
        setSelectedLog(log);
        setDetailOpen(true);
    }, []);

    const handleCloseDetail = useCallback(() => {
        setDetailOpen(false);
        setTimeout(() => setSelectedLog(null), 200);
    }, []);

    const handleFilterChange = useCallback((field, value) => {
        setQueryPart({ [field]: value });
    }, [setQueryPart]);

    const handleReset = useCallback(() => {
        setQueryPart({ operatorId: '', action: '', entity: '', from: '', to: '', page: 1 });
    }, [setQueryPart]);

    return (
        <div className="content">
            <div className="page-header">
                <h2>📋 操作日志</h2>
            </div>

            {/* 筛选区域（与 UserManagement 结构一致） */}
            <div className="search-section">
                <div className="search-form" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 10 }}>
                    <div className="search-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="search-label">操作者ID</label>
                        <input
                            className="search-input"
                            placeholder="输入ID"
                            value={query.operatorId}
                            onChange={(e) => handleFilterChange('operatorId', e.target.value)}
                        />
                    </div>
                    <div className="search-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="search-label">操作类型</label>
                        <select
                            className="search-select"
                            value={query.action}
                            onChange={(e) => handleFilterChange('action', e.target.value)}
                        >
                            <option value="">全部操作</option>
                            {ACTION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div className="search-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="search-label">实体</label>
                        <select
                            className="search-select"
                            value={query.entity}
                            onChange={(e) => handleFilterChange('entity', e.target.value)}
                        >
                            <option value="">全部实体</option>
                            {ENTITY_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                    </div>
                    <div className="search-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="search-label">开始时间</label>
                        <input
                            type="date"
                            className="search-input"
                            value={query.from ? query.from.slice(0, 10) : ''}
                            onChange={(e) => handleFilterChange('from', e.target.value ? `${e.target.value} 00:00:00` : '')}
                        />
                    </div>
                    <div className="search-field" style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <label className="search-label">结束时间</label>
                        <input
                            type="date"
                            className="search-input"
                            value={query.to ? query.to.slice(0, 10) : ''}
                            onChange={(e) => handleFilterChange('to', e.target.value ? `${e.target.value} 23:59:59` : '')}
                        />
                    </div>
                    <div className="search-actions" style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                        <button className="search-btn" onClick={reload}>Search</button>
                        <button className="btn-secondary" onClick={handleReset}>Reset</button>
                    </div>
                </div>
            </div>

            {/* 错误提示 */}
            {error && (
                <div style={{ margin: '16px 0', padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>⚠️ {error}</span>
                    <button onClick={reload} className="btn-sm" style={{ background: '#fff' }}>重试</button>
                </div>
            )}

            {/* 表格区域 */}
            <div className="table-section">
                <h3>操作日志列表</h3>
                {loading ? (
                    <div className="loading">Loading...</div>
                ) : (
                    <>
                        <table className="data-table">
                            <thead>
                            <tr>
                                <th>操作者</th>
                                <th>操作类型</th>
                                <th>实体</th>
                                <th>实体ID</th>
                                <th>详情预览</th>
                                <th>操作时间</th>
                            </tr>
                            </thead>
                            <tbody>
                            {data.list.map((log) => (
                                <tr key={log.id} onClick={() => handleOpenDetail(log)} style={{ cursor: 'pointer' }}>
                                    <td>
                                        {log.operator ? (
                                            <div>
                                                <div style={{ fontWeight: 600 }}>{log.operator.name}</div>
                                                <div style={{ fontSize: 12, color: '#888' }}>{log.operator.email}</div>
                                            </div>
                                        ) : (
                                            <span style={{ color: '#999', fontStyle: 'italic' }}>系统 / 已删除</span>
                                        )}
                                    </td>
                                    <td>{getActionLabel(log.action)}</td>
                                    <td>{getEntityLabel(log.entity)}</td>
                                    <td>{log.entityId ? <code>{truncateText(log.entityId, 18)}</code> : '—'}</td>
                                    <td style={{ maxWidth: 180, fontSize: 12, color: '#888' }}>
                                        {log.detail ? truncateText(log.detail, 40) : '—'}
                                    </td>
                                    <td>{formatDateTime(log.createdAt)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                        {data.list.length === 0 && <div className="no-data">暂无操作日志</div>}

                        <div className="form-actions" style={{ justifyContent: 'space-between', marginTop: 18 }}>
              <span style={{ color: '#718096', fontSize: 13 }}>
                Total {data.total} records · Page {data.page}/{totalPages}
                  <select
                      value={data.size}
                      onChange={(e) => setQueryPart({ size: Number(e.target.value), page: 1 })}
                      className="search-select"
                      style={{ marginLeft: 12, width: 'auto' }}
                  >
                  {[5, 10, 20, 50].map(s => <option key={s} value={s}>{s} 条/页</option>)}
                </select>
              </span>
                            <div style={{ display: 'flex', gap: 10 }}>
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
    );
};

export default AuditLogs;
