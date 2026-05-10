import { useState, useCallback, useEffect } from 'react'
import useSystemConfig from '../hooks/useSystemConfig'

const validateNumber = (value, min, max, decimals = 0) => {
  const num = Number(value)
  if (isNaN(num)) return { valid: false, message: 'Must be a valid number' }
  if (num < min || num > max) return { valid: false, message: `Must be between ${min} and ${max}` }
  const decimalPlaces = value.toString().split('.')[1]?.length || 0
  if (decimalPlaces > decimals) return { valid: false, message: `Maximum ${decimals} decimal places allowed` }
  return { valid: true }
}

const SectionCard = ({ title, description, icon, children, onSave, saving, hasChanges }) => (
  <div className="config-section-card">
    <div className="config-section-header">
      <div className="config-section-title">
        <span className="config-section-icon">{icon}</span>
        <div>
          <h3>{title}</h3>
          <p className="config-section-desc">{description}</p>
        </div>
      </div>
      <button
        className={`config-save-btn ${saving ? 'saving' : ''} ${!hasChanges ? 'disabled' : ''}`}
        onClick={onSave}
        disabled={saving || !hasChanges}
      >
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
    <div className="config-section-body">{children}</div>
  </div>
)

const ConfigField = ({ label, value, onChange, error, min, max, suffix = '', type = 'number' }) => (
  <div className="config-field-group">
    <label className="config-field-label">{label}</label>
    <div className="config-input-wrapper">
      <input
        type={type}
        className={`config-input ${error ? 'error' : ''}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step={type === 'number' ? '0.01' : undefined}
      />
      {suffix && <span className="config-input-suffix">{suffix}</span>}
    </div>
    <div className="config-field-info">
      <span className="config-field-range">Range: {min} - {max}</span>
      {error && <span className="config-field-error">{error}</span>}
    </div>
  </div>
)

const SuccessToast = ({ message, onClose }) => (
  <div className="config-success-toast">
    <span className="config-success-icon">✓</span>
    <span>{message}</span>
    <button className="config-toast-close" onClick={onClose}>×</button>
  </div>
)

const SystemConfig = ({ onNotify }) => {
  const { config, loading, saving, error, reload, saveBorrowRules, saveFineRate } = useSystemConfig()

  const [formData, setFormData] = useState({
    borrowRules: {
      maxBorrowDays: '',
      maxBorrowBooks: ''
    },
    fineRate: {
      dailyFineRate: ''
    }
  })

  const [borrowErrors, setBorrowErrors] = useState({})
  const [fineErrors, setFineErrors] = useState({})

  const [successMessage, setSuccessMessage] = useState(null)

  useEffect(() => {
    if (!loading && config) {
      setFormData({
        borrowRules: {
          maxBorrowDays: String(config.borrowRules.maxBorrowDays),
          maxBorrowBooks: String(config.borrowRules.maxBorrowBooks)
        },
        fineRate: {
          dailyFineRate: String(config.fineRules.dailyFineRate)
        }
      })
    }
  }, [config, loading])

  const hasBorrowChanges = useCallback(() => {
    return (
      formData.borrowRules.maxBorrowDays !== String(config.borrowRules.maxBorrowDays) ||
      formData.borrowRules.maxBorrowBooks !== String(config.borrowRules.maxBorrowBooks)
    )
  }, [formData, config])

  const hasFineChanges = useCallback(() => {
    return formData.fineRate.dailyFineRate !== String(config.fineRules.dailyFineRate)
  }, [formData, config])

  const validateBorrowRules = useCallback(() => {
    const errors = {}
    const maxDaysResult = validateNumber(formData.borrowRules.maxBorrowDays, 1, 365)
    if (!maxDaysResult.valid) errors.maxBorrowDays = maxDaysResult.message

    const maxBooksResult = validateNumber(formData.borrowRules.maxBorrowBooks, 1, 50)
    if (!maxBooksResult.valid) errors.maxBorrowBooks = maxBooksResult.message

    setBorrowErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData.borrowRules])

  const validateFineRate = useCallback(() => {
    const errors = {}
    const result = validateNumber(formData.fineRate.dailyFineRate, 0, 100, 2)
    if (!result.valid) errors.dailyFineRate = result.message

    setFineErrors(errors)
    return Object.keys(errors).length === 0
  }, [formData.fineRate])

  const handleSaveBorrowRules = useCallback(async () => {
    if (!validateBorrowRules()) return

    const result = await saveBorrowRules({
      maxBorrowDays: Number(formData.borrowRules.maxBorrowDays),
      maxBorrowBooks: Number(formData.borrowRules.maxBorrowBooks)
    })

    if (result.success) {
      setSuccessMessage('Borrow rules updated successfully')
      if (onNotify) onNotify('success', 'Borrow rules updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }, [formData.borrowRules, validateBorrowRules, saveBorrowRules, onNotify])

  const handleSaveFineRate = useCallback(async () => {
    if (!validateFineRate()) return

    const result = await saveFineRate({
      dailyFineRate: Number(formData.fineRate.dailyFineRate)
    })

    if (result.success) {
      setSuccessMessage('Fine rate updated successfully')
      if (onNotify) onNotify('success', 'Fine rate updated successfully')
      setTimeout(() => setSuccessMessage(null), 3000)
    }
  }, [formData.fineRate, validateFineRate, saveFineRate, onNotify])

  const handleBorrowFieldChange = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      borrowRules: { ...prev.borrowRules, [field]: value }
    }))
    setBorrowErrors((prev) => ({ ...prev, [field]: null }))
  }, [])

  const handleFineFieldChange = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      fineRate: { ...prev.fineRate, [field]: value }
    }))
    setFineErrors((prev) => ({ ...prev, [field]: null }))
  }, [])

  if (loading) {
    return (
      <div className="config-page-loading">
        <div className="config-loading-spinner"></div>
        <p>Loading system configuration...</p>
      </div>
    )
  }

  return (
    <div className="content system-config-page">
      <div className="page-header config-page-header">
        <h2>System Configuration</h2>
        <p className="config-subtitle">
          Manage library-wide borrowing policies and fine rates. Changes apply to new transactions only.
        </p>
      </div>

      {error && (
        <div className="config-error-banner">
          <span className="config-error-icon">⚠</span>
          <span>{error}</span>
          <button className="config-retry-btn" onClick={reload}>Retry</button>
        </div>
      )}

      {successMessage && (
        <SuccessToast message={successMessage} onClose={() => setSuccessMessage(null)} />
      )}

      <div className="config-sections-grid">
        <SectionCard
          title="Borrow Rules"
          description="Configure default borrowing limits for library members"
          icon="📚"
          onSave={handleSaveBorrowRules}
          saving={saving}
          hasChanges={hasBorrowChanges()}
        >
          <div className="config-fields-grid">
            <ConfigField
              label="Maximum Borrow Days"
              value={formData.borrowRules.maxBorrowDays}
              onChange={(value) => handleBorrowFieldChange('maxBorrowDays', value)}
              error={borrowErrors.maxBorrowDays}
              min={1}
              max={365}
              suffix="days"
            />
            <ConfigField
              label="Maximum Borrow Books"
              value={formData.borrowRules.maxBorrowBooks}
              onChange={(value) => handleBorrowFieldChange('maxBorrowBooks', value)}
              error={borrowErrors.maxBorrowBooks}
              min={1}
              max={50}
              suffix="books"
            />
          </div>
          <div className="config-info-box">
            <span className="config-info-icon">ℹ</span>
            <span>These rules apply when a new borrowing transaction is created. Existing loans are not affected.</span>
          </div>
        </SectionCard>

        <SectionCard
          title="Fine Rate"
          description="Set the daily fine rate for overdue book returns"
          icon="💰"
          onSave={handleSaveFineRate}
          saving={saving}
          hasChanges={hasFineChanges()}
        >
          <div className="config-fields-grid">
            <ConfigField
              label="Daily Fine Rate"
              value={formData.fineRate.dailyFineRate}
              onChange={(value) => handleFineFieldChange('dailyFineRate', value)}
              error={fineErrors.dailyFineRate}
              min={0}
              max={100}
              suffix="CNY/day"
            />
          </div>
          <div className="config-info-box">
            <span className="config-info-icon">ℹ</span>
            <span>
              Fine amount = overdue days × daily rate. Updates affect future overdue calculations only.
            </span>
          </div>
        </SectionCard>
      </div>

      <div className="config-last-updated">
        <span>Last loaded: {new Date().toLocaleString()}</span>
        <button className="config-refresh-btn" onClick={reload}>
          <span>↻</span> Refresh
        </button>
      </div>
    </div>
  )
}

export default SystemConfig
