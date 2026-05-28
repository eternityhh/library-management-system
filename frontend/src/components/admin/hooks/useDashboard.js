// frontend/src/components/admin/hooks/useDashboard.js

/**
 * @typedef {Object} OverviewStats
 * @property {number} totalUsers
 * @property {number} totalBooks
 * @property {number} availableBooks
 * @property {number} borrowedBooks
 * @property {number} activeLoans
 * @property {number} overdueLoans
 * @property {number} todayCheckouts
 * @property {number} todayReturns
 * @property {number} pendingHolds
 * @property {number} readyHolds
 * @property {number} totalFinesUnpaid
 * @property {number} monthRevenue
 * @property {Object} usersByRole
 * @property {number} usersByRole.students
 * @property {number} usersByRole.librarians
 * @property {number} usersByRole.admins
 */

/**
 * @typedef {Object} LoanTrends
 * @property {Array<{date: string, checkouts: number, returns: number}>} daily
 */

/**
 * @typedef {Object} PopularBooks
 * @property {Array<{rank: number, bookId: string, title: string, author: string, isbn: string, loanCount: number}>} list
 */

/**
 * @typedef {Object} RecentActivities
 * @property {Array<{id: string, operator: string, action: string, entity: string, entityId: string, createdAt: string}>} list
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { adminApi } from '../services/adminApi'

/**
 * 获取管理员仪表盘数据（含自动刷新）
 * @param {number} autoRefreshSeconds - 自动刷新间隔（秒），默认 30，设为 0 则禁用
 * @returns {{
 *   overview: OverviewStats | null,
 *   loanTrends: LoanTrends | null,
 *   popularBooks: PopularBooks | null,
 *   recentActivities: RecentActivities | null,
 *   loading: boolean,
 *   error: string | null,
 *   refresh: () => void
 * }}
 */
export function useDashboard(autoRefreshSeconds = 30) {
    const [overview, setOverview] = useState(null)
    const [loanTrends, setLoanTrends] = useState(null)
    const [popularBooks, setPopularBooks] = useState(null)
    const [recentActivities, setRecentActivities] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const intervalIdRef = useRef(null)

    // 获取所有数据（内部已处理错误）
    const fetchAll = useCallback(async () => {
        try {
            setError(null)
            const [overviewData, trendsData, popularData, activitiesData] = await Promise.all([
                adminApi.getDashboardOverview(),
                adminApi.getLoanTrends('30d'),
                adminApi.getPopularBooks(10),
                adminApi.getRecentActivities(20)
            ])
            setOverview(overviewData)
            setLoanTrends(trendsData)
            setPopularBooks(popularData)
            setRecentActivities(activitiesData)
        } catch (err) {
            setError(err.message || 'Failed to load dashboard data')
            console.error('Dashboard fetch error:', err)
        } finally {
            setLoading(false)
        }
    }, [])

    // 手动刷新（重新加载，不清空已有数据）
    const refresh = useCallback(() => {
        if (!loading) {
            setLoading(true)
            void fetchAll()
        }
    }, [fetchAll, loading])

    // 初始加载 + 自动刷新
    useEffect(() => {
        // 首次加载
        void fetchAll()

        // 设置自动刷新
        if (autoRefreshSeconds > 0) {
            intervalIdRef.current = setInterval(() => {
                void fetchAll()
            }, autoRefreshSeconds * 1000)
        }

        // 清理定时器
        return () => {
            if (intervalIdRef.current) {
                clearInterval(intervalIdRef.current)
                intervalIdRef.current = null
            }
        }
    }, [fetchAll, autoRefreshSeconds])

    return {
        overview,
        loanTrends,
        popularBooks,
        recentActivities,
        loading,
        error,
        refresh
    }
}