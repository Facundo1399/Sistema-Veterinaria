
import { useState } from 'react'
import {
  LayoutDashboard,
  PawPrint,
  Users,
  Stethoscope,
  Calendar,
  ClipboardList,
  FileText,
  Syringe,
  Activity,
  Package,
  Settings,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  UserPlus,
  UserCog,
  LogOut,
  Receipt,
} from 'lucide-react'

export default function Sidebar({
  activeRoute = 'dashboard',
  onNavigate,
  rol = 'admin',
  nombreUsuario = 'Dr. Admin',
}) {
  const [configOpen, setConfigOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)

  const esAdmin = rol === 'admin'
  const esVeterinario = rol === 'veterinario'

  const puedeVerGestionClinica = esAdmin || esVeterinario

  // Opciones principales del menú
  const menuPrincipal = [
    {
      route: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      roles: ['admin', 'veterinario', 'recepcion'],
    },
    {
      route: 'mascotas',
      label: 'Mascotas',
      icon: PawPrint,
      roles: ['admin', 'veterinario', 'recepcion'],
    },
    {
      route: 'propietarios',
      label: 'Propietarios',
      icon: Users,
      roles: ['admin', 'veterinario', 'recepcion'],
    },
    {
      route: 'veterinarios',
      label: 'Veterinarios',
      icon: Stethoscope,
      roles: ['admin', 'veterinario', 'recepcion'],
    },
    {
      route: 'citas',
      label: 'Citas',
      icon: Calendar,
      roles: ['admin', 'veterinario', 'recepcion'],
    },
  ]

  // Opciones de gestión clínica
  const menuClinico = [
    {
      route: 'consultas',
      label: 'Consultas',
      icon: ClipboardList,
    },
    {
      route: 'historial',
      label: 'Historial Médico',
      icon: FileText,
    },
    {
      route: 'vacunaciones',
      label: 'Vacunaciones',
      icon: Syringe,
    },
    {
      route: 'cirugias',
      label: 'Cirugías',
      icon: Activity,
    },
  ]

  // Opciones de administración
  const menuAdministracion = [
    {
      route: 'productos',
      label: 'Productos',
      icon: Package,
    },
    {
      route: 'facturacion',
      label: 'Facturación',
      icon: Receipt,
    },
  ]

  // Opciones de configuración
  const menuConfiguracion = [
    {
      route: 'usuarios',
      label: 'Usuarios',
      icon: UserCog,
    },
    {
      route: 'nuevo-usuario',
      label: 'Nuevo Usuario',
      icon: UserPlus,
    },
  ]

  const opcionesPrincipales = menuPrincipal.filter(
    (item) => item.roles.includes(rol)
  )

  // Estilos de cada enlace
  const navItemClass = (route) =>
    `flex w-full items-center rounded-lg py-2 text-sm font-medium transition-colors ${
      collapsed ? 'justify-center px-2' : 'gap-3 px-3'
    } ${
      activeRoute === route
        ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/20'
        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100'
    }`

  // Renderizado reutilizable de opciones
  const renderMenuItems = (items) =>
    items.map((item) => {
      const Icon = item.icon

      return (
        <button
          key={item.route}
          type="button"
          onClick={() => onNavigate?.(item.route)}
          title={item.label}
          aria-label={item.label}
          aria-current={activeRoute === item.route ? 'page' : undefined}
          className={navItemClass(item.route)}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {!collapsed && item.label}
        </button>
      )
    })

  return (
    <aside
      className={`flex h-screen ${
        collapsed ? 'w-16' : 'w-64'
      } flex-col border-r border-slate-800 bg-slate-950 text-slate-200 select-none transition-[width] duration-200`}
    >
      {/* Cabecera / Logo */}
      <div
        className={`flex shrink-0 border-b border-slate-800 ${
          collapsed
            ? 'h-20 flex-col items-center justify-center gap-1 px-2'
            : 'h-16 items-center justify-between gap-3 px-5'
        }`}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 font-bold text-white shadow-md shadow-emerald-950">
          🐾
        </div>

        {!collapsed && (
          <div className="flex flex-1 flex-col">
            <span className="text-sm font-bold tracking-tight text-slate-100">
              VetControl
            </span>
            <span className="text-[11px] text-slate-500">
              Gestión Clínica
            </span>
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setCollapsed((isCollapsed) => !isCollapsed)
            setConfigOpen(false)
          }}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          aria-expanded={!collapsed}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Navegación */}
      <nav
        aria-label="Navegación principal"
        className={`flex-1 space-y-6 overflow-y-auto py-4 ${
          collapsed ? 'px-2' : 'px-3'
        }`}
      >
        {/* Principal */}
        <div>
          {!collapsed && (
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Principal
            </p>
          )}

          <div className="space-y-1">
            {renderMenuItems(opcionesPrincipales)}
          </div>
        </div>

        {/* Gestión clínica */}
        {puedeVerGestionClinica && (
          <div>
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Gestión Clínica
              </p>
            )}

            <div className="space-y-1">
              {renderMenuItems(menuClinico)}
            </div>
          </div>
        )}

        {/* Administración */}
        {!esVeterinario && (
          <div>
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Administración
              </p>
            )}

            <div className="space-y-1">
              {renderMenuItems(menuAdministracion)}
            </div>

            {/* Configuración: solo admin */}
            {esAdmin && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setConfigOpen(!configOpen)}
                  title="Configuración"
                  aria-label="Configuración"
                  aria-expanded={configOpen}
                  className={`flex w-full items-center rounded-lg py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-slate-900 hover:text-slate-100 ${
                    collapsed ? 'justify-center px-2' : 'justify-between px-3'
                  }`}
                >
                  <span
                    className={`flex items-center ${
                      collapsed ? '' : 'gap-3'
                    }`}
                  >
                    <Settings className="h-4 w-4 shrink-0" />
                    {!collapsed && 'Configuración'}
                  </span>

                  {!collapsed && (
                    <ChevronDown
                      className={`h-4 w-4 transition-transform duration-200 ${
                        configOpen ? 'rotate-180 text-slate-200' : ''
                      }`}
                    />
                  )}
                </button>

                {configOpen && !collapsed && (
                  <div className="mt-1 ml-5 space-y-1 border-l border-slate-800 pl-3">
                    {renderMenuItems(menuConfiguracion)}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Usuario actual y cerrar sesión */}
      <div
        className={`shrink-0 border-t border-slate-800 ${
          collapsed ? 'p-2' : 'p-3'
        }`}
      >
        <div
          className={`flex items-center rounded-lg bg-slate-900/60 p-2.5 ${
            collapsed ? 'flex-col gap-2' : 'justify-between'
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/30 bg-emerald-600/20 text-xs font-bold text-emerald-400">
              {nombreUsuario
                .split(' ')
                .map((parte) => parte[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()}
            </div>

            {!collapsed && (
              <div className="truncate">
                <p className="truncate text-xs font-semibold text-slate-200">
                  {nombreUsuario}
                </p>
                <p className="truncate text-[11px] capitalize text-slate-500">
                  {rol}
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onNavigate?.('logout')}
            title="Cerrar sesión"
            aria-label="Cerrar sesión"
            className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
