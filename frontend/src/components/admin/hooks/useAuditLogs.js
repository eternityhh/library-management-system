import { useState, useEffect, useCallback } from 'react';
import { adminApi } from '../services/adminApi';

export default function useAuditLogs(initialQuery = {}) {
    const [query, setQuery] = useState({
        page: 1,
        size: 10,
        operator: '',
        action: '',
        entity: '',
        from: '',
        to: '',
        ...initialQuery,
    });

    const [data, setData] = useState({ total: 0, page: 1, size: 10, list: [] });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await adminApi.listAuditLogs(query);
            setData(result);
        } catch (err) {
            setError(err.message || '加载操作日志失败');
        } finally {
            setLoading(false);
        }
    }, [query]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const setQueryPart = useCallback((partial) => {
        setQuery((prev) => {
            const updated = { ...prev, ...partial };
            const isFilterChange = Object.keys(partial).some((k) => k !== 'page');
            if (isFilterChange) {
                updated.page = 1;
            }
            return updated;
        });
    }, []);

    const reload = useCallback(() => {
        fetchData();
    }, [fetchData]);

    return { query, data, loading, error, setQueryPart, reload };
}
