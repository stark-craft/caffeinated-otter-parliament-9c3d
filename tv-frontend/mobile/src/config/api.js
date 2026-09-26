export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
    ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')}/api/qr`
    : '/api/qr'

export const API_ENDPOINTS = {
    validateSession: (sessionId) => `${API_BASE_URL}/session/${sessionId}/validate`,
    getUserProfile: `${API_BASE_URL}/user/profile`,
    beginMcpLogin: `${API_BASE_URL}/auth/begin`,
    completeMcpLogin: `${API_BASE_URL}/auth/complete`,
    getMcpLoginStatus: (merchantId) => `${API_BASE_URL}/auth/status/${merchantId}`,
    completeSession: (sessionId) => `${API_BASE_URL}/session/${sessionId}/complete`,
}
