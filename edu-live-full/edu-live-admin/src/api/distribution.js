import request from './request'

export const getDistributionConfig = (params) => request.get('/distribution/config', { params })
export const saveDistributionConfig = (data) => request.post('/distribution/config', data)

export const getSalesList = (params) => request.get('/distribution/sales/list', { params })
export const createSalesUser = (data) => request.post('/distribution/sales/create', data)
export const searchDistributionStudents = (params) => request.get('/distribution/students/search', { params })
export const getDistributionTree = (params) => request.get('/distribution/tree', { params })

export const assignStudentSales = (data) => request.post('/distribution/student/assign', data)

export const getDistributionOrders = (params) => request.get('/distribution/orders', { params })
export const getDistributionSettlementStatus = (params) => request.get('/distribution/settlement/status', { params })
export const lockDistributionSettlement = (data) => request.post('/distribution/settlement/lock', data)
export const unlockDistributionSettlement = (data) => request.post('/distribution/settlement/unlock', data)

export const exportDistributionOrders = async (params = {}) => {
	const search = new URLSearchParams()
	Object.entries(params || {}).forEach(([key, value]) => {
		if (value === null || value === undefined || value === '') return
		search.set(key, String(value))
	})

	const token = localStorage.getItem('token') || ''
	const res = await fetch(`/api/distribution/orders/export?${search.toString()}`, {
		headers: { Authorization: `Bearer ${token}` }
	})

	if (!res.ok) {
		const text = await res.text()
		throw new Error(text || '导出失败')
	}

	const disposition = res.headers.get('Content-Disposition') || ''
	const match = disposition.match(/filename="?([^";]+)"?/i)
	const filename = match?.[1] || `distribution_orders_${Date.now()}.csv`
	const blob = await res.blob()
	return { blob, filename }
}
