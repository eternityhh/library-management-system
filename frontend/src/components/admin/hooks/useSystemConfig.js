import { useState, useEffect, useCallback } from 'react'
import { adminApi } from '../services/adminApi'

export default function useSystemConfig() {
  const [config, setConfig] = useState({
    borrowRules: {
      maxBorrowDays: 30,
      maxBorrowBooks: 5
    },
    fineRules: {
      dailyFineRate: 1.00
    }
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const fetchConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await adminApi.getConfig()
      setConfig(result)
    } catch (err) {
      setError(err.message || 'Failed to load system configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  const saveBorrowRules = useCallback(async (payload) => {
    setSaving(true)
    setError(null)
    try {
      const result = await adminApi.updateBorrowRules(payload)
      setConfig((prev) => ({ ...prev, borrowRules: result.borrowRules }))
      return { success: true }
    } catch (err) {
      setError(err.message || 'Failed to update borrow rules')
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }, [])

  const saveFineRate = useCallback(async (payload) => {
    setSaving(true)
    setError(null)
    try {
      const result = await adminApi.updateFineRate(payload)
      setConfig((prev) => ({ ...prev, fineRules: result.fineRules }))
      return { success: true }
    } catch (err) {
      setError(err.message || 'Failed to update fine rate')
      return { success: false, error: err.message }
    } finally {
      setSaving(false)
    }
  }, [])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const reload = useCallback(() => {
    fetchConfig()
  }, [fetchConfig])

  return {
    config,
    loading,
    saving,
    error,
    reload,
    saveBorrowRules,
    saveFineRate
  }
}
