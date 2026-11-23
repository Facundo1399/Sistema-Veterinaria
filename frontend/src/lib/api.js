const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000')
  .replace(/\/+$/, '')

export async function apiRequest(path, { auth = true, ...options } = {}) {
  const token = auth ? localStorage.getItem('access_token') : null
  if (auth && !token) {
    throw new Error(
      'No se encontró el token de sesión. Inicie sesión para continuar.'
    )
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (response.status === 204) {
    return null
  }

  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text()

  if (!response.ok) {
    const detail = typeof body === 'object' && body !== null ? body.detail : body
    const message = Array.isArray(detail)
      ? detail.map((issue) => issue.msg).join(' ')
      : detail || `La API respondió con estado ${response.status}.`
    throw new Error(message)
  }

  return body
}
