import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { apiRequest } from '../lib/api.js'

const AuthContext = createContext(null)
const TOKEN_KEY = 'access_token'

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loggingIn, setLoggingIn] = useState(false)
  const fetchedToken = useRef(null)

  useEffect(() => {
    let activo = true

    setLoading(true)

    const cargarSesion = async () => {
      if (!token) {
        if (activo) {
          setUser(null)
          setLoading(false)
        }
        return
      }

      if (fetchedToken.current === token) {
        if (activo) setLoading(false)
        return
      }

      try {
        const usuario = await apiRequest('/auth/me')
        if (activo) {
          fetchedToken.current = token
          setUser(usuario)
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY)
        if (activo) {
          fetchedToken.current = null
          setToken(null)
          setUser(null)
        }
      } finally {
        if (activo) setLoading(false)
      }
    }

    cargarSesion()

    return () => {
      activo = false
    }
  }, [token])

  const login = useCallback(async (email, password) => {
    setLoggingIn(true)

    try {
      const respuesta = await apiRequest('/auth/login', {
        method: 'POST',
        auth: false,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          username: email.trim(),
          password,
        }),
      })

      if (typeof respuesta?.access_token !== 'string' || !respuesta.access_token) {
        throw new Error('La respuesta del servidor no contiene un token válido.')
      }

      localStorage.setItem(TOKEN_KEY, respuesta.access_token)
      const usuario = await apiRequest('/auth/me')
      fetchedToken.current = respuesta.access_token
      setUser(usuario)
      setToken(respuesta.access_token)
      return usuario
    } catch (error) {
      localStorage.removeItem(TOKEN_KEY)
      fetchedToken.current = null
      setToken(null)
      setUser(null)
      throw error
    } finally {
      setLoggingIn(false)
    }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    fetchedToken.current = null
    setToken(null)
    setUser(null)
  }, [])

  const value = useMemo(
    () => ({
      token,
      user,
      loading,
      loggingIn,
      isAuthenticated: Boolean(token && user),
      login,
      logout,
    }),
    [token, user, loading, loggingIn, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider.')
  }

  return context
}

export default AuthContext