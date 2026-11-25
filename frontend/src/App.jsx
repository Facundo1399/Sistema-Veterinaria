import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import Login from './pages/Login.jsx'
import Dashboard from './pages/Dashboard.jsx'
import Sidebar from './pages/Sidebar.jsx'
import MascotasForm from './pages/MascotasForm.jsx'
import PropietariosForm from './pages/PropietariosForm.jsx'
import Usuarios from './pages/Usuarios.jsx'
import Citas from './pages/CitasForm.jsx'
import CitasListado from './pages/CitasListado.jsx'
import { SIDEBAR_ROUTE_PATHS } from './lib/routes.js'
import { useAuth } from './context/AuthContext.jsx'

const rutasPendientes = [
  ['/veterinarios', 'Veterinarios'],
  ['/consultas', 'Consultas'],
  ['/historial', 'Historial Médico'],
  ['/vacunaciones', 'Vacunaciones'],
  ['/cirugias', 'Cirugías'],
  ['/productos', 'Productos'],
  ['/facturacion', 'Facturación'],
]

function LayoutInterno() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { user, logout } = useAuth()
  const activeRoute = Object.entries(SIDEBAR_ROUTE_PATHS)
    .sort(([, pathA], [, pathB]) => pathB.length - pathA.length)
    .find(([, path]) => pathname === path || pathname.startsWith(`${path}/`))?.[0]

  const handleNavigate = (route) => {
    if (route === 'logout') {
      logout()
      navigate('/login')
      return
    }

    navigate(SIDEBAR_ROUTE_PATHS[route] || '/dashboard')
  }

  return (
    <div className="flex min-h-screen bg-slate-900">
      <Sidebar
        activeRoute={activeRoute}
        onNavigate={handleNavigate}
        rol={user?.rol || 'recepcion'}
        nombreUsuario={
          [user?.nombre, user?.apellido].filter(Boolean).join(' ') ||
          user?.email ||
          'Usuario'
        }
      />
      <main className="min-w-0 flex-1 overflow-auto p-4 sm:p-6">
        <Outlet />
      </main>
    </div>
  )
}

function RequireAuth() {
  const location = useLocation()
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-900 text-sm text-slate-300">
        Cargando sesión...
      </main>
    )
  }

  return isAuthenticated ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ from: location }} />
  )
}

function PublicRoute() {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null

  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />
}

function ProtectedRoute({ allowedRoles = [] }) {
  const { user } = useAuth()

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.rol)) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}

function RutaPendiente({ titulo }) {
  return (
    <section className="mx-auto max-w-4xl rounded-xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-xl">
      <h1 className="text-xl font-bold">{titulo}</h1>
      <p className="mt-2 text-sm text-slate-400">
        Esta pantalla todavía no está implementada.
      </p>
    </section>
  )
}

function App() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<Login />} />
      </Route>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route element={<RequireAuth />}>
        <Route element={<LayoutInterno />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route element={<ProtectedRoute allowedRoles={['admin', 'recepcion']} />}>
            <Route path="/mascotas" element={<MascotasForm />} />
            <Route path="/propietarios" element={<PropietariosForm />} />
          </Route>
          <Route
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'veterinario', 'recepcion']}
              />
            }
          >
            <Route path="/citas" element={<Citas />} />
            <Route path="/citas/listado" element={<CitasListado />} />
          </Route>
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/usuarios" element={<Usuarios />} />
            <Route
              path="/usuarios/nuevo"
              element={<RutaPendiente titulo="Nuevo Usuario" />}
            />
          </Route>
          {rutasPendientes.map(([path, titulo]) => (
            <Route
              key={path}
              path={path}
              element={<RutaPendiente titulo={titulo} />}
            />
          ))}
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

export default App
