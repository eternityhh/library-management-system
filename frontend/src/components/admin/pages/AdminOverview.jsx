// frontend/src/components/admin/pages/AdminOverview.jsx
import { useDashboard } from '../hooks/useDashboard'
import { ADMIN_PAGES } from '../constants'
import StatCard from '../components/StatCard'
import SimpleBarChart from '../components/SimpleBarChart'

/**
 * Admin Overview Dashboard
 * @param {Object} props
 * @param {Object} props.user - 当前管理员用户
 * @param {Function} props.onNavigate - 页面跳转函数
 */
const AdminOverview = ({ user, onNavigate }) => {
    const {
        overview = {},
        loanTrends = {},
        popularBooks = {},
        recentActivities = {},
        loading,
        error,
        refresh
    } = useDashboard(30) // 30秒自动刷新

    // 准备借阅趋势图表数据（安全访问 daily 数组）
    const chartData = (loanTrends?.daily || []).map(day => ({
        date: day.date?.slice(5) || '', // 显示 MM-DD
        checkouts: day.checkouts || 0,
        returns: day.returns || 0
    }))

    // 安全获取统计值
    const totalUsers = overview?.totalUsers ?? 0
    const totalBooks = overview?.totalBooks ?? 0
    const activeLoans = overview?.activeLoans ?? 0
    const overdueLoans = overview?.overdueLoans ?? 0

    return (
        <div className="content">
            {/* 欢迎横幅 */}
            <div className="welcome-banner">
                <div className="welcome-text">
                    <h2>Welcome, {user.name}!</h2>
                    <p>
                        Today is{' '}
                        {new Date().toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            weekday: 'long'
                        })}
                    </p>
                </div>
                <div className="banner-icon">🛡️</div>
            </div>

            {/* 错误提示 */}
            {error && (
                <div className="error-banner">
                    ⚠️ {error} &nbsp;
                    <button onClick={refresh} className="retry-btn">
                        Retry
                    </button>
                </div>
            )}

            {/* 统计卡片区 */}
            <div className="stats-grid">
                <StatCard
                    title="Total Users"
                    value={totalUsers}
                    icon="👥"
                    loading={loading}
                    variant="blue"
                />
                <StatCard
                    title="Total Books"
                    value={totalBooks}
                    icon="📚"
                    loading={loading}
                    variant="green"
                />
                <StatCard
                    title="Active Loans"
                    value={activeLoans}
                    icon="📖"
                    loading={loading}
                    variant="orange"
                />
                <StatCard
                    title="Overdue"
                    value={overdueLoans}
                    icon="⚠️"
                    loading={loading}
                    variant="red"
                />
            </div>

            {/* 两列布局：借阅趋势 + 热门图书 */}
            <div className="dashboard-two-columns">
                {/* 借阅趋势图 */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <h3>Loan Trends (Last 30 Days)</h3>
                        {!loading && (
                            <button onClick={refresh} className="refresh-small">
                                🔄
                            </button>
                        )}
                    </div>
                    <div className="card-content">
                        {loading ? (
                            <div className="skeleton-chart" />
                        ) : (
                            <>
                                <SimpleBarChart
                                    data={chartData}
                                    xKey="date"
                                    yKey="checkouts"
                                    height={180}
                                />
                                <div className="chart-legend">
                                    <span>📘 Checkouts</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* 热门图书排行 */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <h3>🔥 Popular Books</h3>
                    </div>
                    <div className="card-content">
                        {loading ? (
                            <div className="skeleton-list" />
                        ) : (
                            <ol className="popular-list">
                                {(popularBooks?.list || []).slice(0, 5).map((book, idx) => (
                                    <li key={book.bookId}>
                                        <span className="rank">{idx + 1}.</span>
                                        <span className="title">{book.title}</span>
                                        <span className="count">{book.loanCount} borrows</span>
                                    </li>
                                ))}
                                {(!popularBooks?.list || popularBooks.list.length === 0) && (
                                    <div className="empty-meta">No data yet</div>
                                )}
                            </ol>
                        )}
                    </div>
                </div>
            </div>

            {/* 两列布局：近期动态 + 快捷入口 */}
            <div className="dashboard-two-columns">
                {/* 近期动态 */}
                <div className="dashboard-card">
                    <div className="card-header">
                        <h3>📋 Recent Activities</h3>
                    </div>
                    <div className="card-content">
                        {loading ? (
                            <div className="skeleton-list" />
                        ) : (
                            <ul className="activity-list">
                                {(recentActivities?.list || []).slice(0, 6).map(act => (
                                    <li key={act.id}>
                    <span className="time">
                      {new Date(act.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                      })}
                    </span>
                                        <span className="action">{act.action}</span>
                                        <span className="operator">{act.operator}</span>
                                    </li>
                                ))}
                                {(!recentActivities?.list || recentActivities.list.length === 0) && (
                                    <div className="empty-meta">No recent activities</div>
                                )}
                            </ul>
                        )}
                    </div>
                </div>

                {/* 快捷入口 */}
                <div className="quick-actions-card">
                    <h3>Quick Actions</h3>
                    <div className="quick-actions-grid">
                        <button
                            className="quick-action-btn green"
                            onClick={() => onNavigate(ADMIN_PAGES.USER_MANAGE)}
                        >
                            🧩 Users Manage
                        </button>
                        <button
                            className="quick-action-btn blue"
                            onClick={() => onNavigate(ADMIN_PAGES.SYSTEM_CONFIG)}
                        >
                            ⚙️ System Config
                        </button>
                        <button
                            className="quick-action-btn orange"
                            onClick={() => onNavigate(ADMIN_PAGES.AUDIT_LOGS)}
                        >
                            📜 Audit Logs
                        </button>
                        <button
                            className="quick-action-btn gray"
                            onClick={() => onNavigate(ADMIN_PAGES.OVERVIEW)}
                        >
                            🏠 Refresh
                        </button>
                    </div>
                </div>
            </div>

            {/* 手动刷新区域 */}
            <div className="refresh-footer">
                <button onClick={refresh} className="refresh-btn" disabled={loading}>
                    {loading ? 'Loading...' : '⟳ Refresh All Data'}
                </button>
                <span className="auto-hint">Auto-refresh every 30s</span>
            </div>

            {/* 内嵌样式（保持与原风格一致） */}
            <style>{`
        .error-banner {
          background: #fee2e2;
          color: #b91c1c;
          padding: 10px 16px;
          border-radius: 12px;
          margin: 20px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .retry-btn {
          background: none;
          border: 1px solid #b91c1c;
          padding: 4px 12px;
          border-radius: 20px;
          cursor: pointer;
        }
        .dashboard-two-columns {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
          margin-top: 24px;
        }
        .dashboard-card, .quick-actions-card {
          background: white;
          border-radius: 20px;
          padding: 20px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .refresh-small {
          background: none;
          border: none;
          font-size: 18px;
          cursor: pointer;
        }
        .popular-list, .activity-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .popular-list li {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 0;
          border-bottom: 1px solid #f0f0f0;
        }
        .rank {
          font-weight: bold;
          width: 30px;
        }
        .title {
          flex: 1;
          font-weight: 500;
        }
        .count {
          color: #6b7280;
          font-size: 12px;
        }
        .activity-list li {
          display: flex;
          gap: 16px;
          padding: 8px 0;
          font-size: 13px;
          border-bottom: 1px solid #f5f5f5;
        }
        .time {
          color: #6b7280;
          width: 60px;
        }
        .action {
          flex: 1;
          font-weight: 500;
        }
        .operator {
          color: #4b5563;
        }
        .refresh-footer {
          margin-top: 32px;
          display: flex;
          justify-content: flex-end;
          align-items: center;
          gap: 16px;
          padding-top: 16px;
          border-top: 1px solid #e5e7eb;
        }
        .refresh-btn {
          background: #4f46e5;
          color: white;
          border: none;
          padding: 8px 20px;
          border-radius: 30px;
          cursor: pointer;
        }
        .refresh-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .auto-hint {
          font-size: 12px;
          color: #9ca3af;
        }
        .skeleton-chart {
          height: 180px;
          background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
          background-size: 200% 100%;
          animation: shimmer 1.5s infinite;
          border-radius: 12px;
        }
        .skeleton-list {
          height: 180px;
          background: #f7f7f7;
          border-radius: 12px;
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .empty-meta {
          text-align: center;
          color: #9ca3af;
          padding: 24px 0;
        }
        @media (max-width: 900px) {
          .dashboard-two-columns {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </div>
    )
}

export default AdminOverview