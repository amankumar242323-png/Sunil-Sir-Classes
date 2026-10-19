const API = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'

export function getToken(): string | null {
  return localStorage.getItem('ssc_token')
}

export function setSession(token: string, user: any) {
  localStorage.setItem('ssc_token', token)
  localStorage.setItem('ssc_user', JSON.stringify(user))
}

export function clearSession() {
  localStorage.removeItem('ssc_token')
  localStorage.removeItem('ssc_user')
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem('ssc_user') || 'null')
  } catch {
    return null
  }
}

export async function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {})
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  const token = getToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${API}${path}`, { ...options, headers })
  const data = await response.json().catch(() => ({}))

  if (!response.ok) {
    let message = 'Request failed'
    if (typeof data.detail === 'string') {
      message = data.detail
    } else if (Array.isArray(data.detail)) {
      message = data.detail.map((err: any) => err.msg || err.message || JSON.stringify(err)).join(', ')
    } else if (data.message) {
      message = data.message
    }
    throw new Error(message)
  }
  return data
}
