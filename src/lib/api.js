// lib/api.js
const API_BASE_URL = 'http://localhost:3005'

/**
 * Make authenticated API request
 */
export async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token')
  
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  }
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  })
  
  // Handle unauthorized
  if (response.status === 401) {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('user')
    document.cookie = 'client_auth_token=; path=/; max-age=0'
    window.location.href = '/login'
    throw new Error('Unauthorized')
  }
  
  return response
}

/**
 * Example usage functions
 */
export async function getClients() {
  const response = await apiRequest('/api/get_all_clients')
  return response.json()
}

export async function getLocationData() {
  const response = await apiRequest('/api/location-data')
  return response.json()
}