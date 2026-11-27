import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Pencil,
  Plus,
  Search,
  Shield,
  UserRound,
  UserX,
  X,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog.jsx'
import { useAuth } from '../../context/AuthContext.jsx'
import { apiRequest } from '../../lib/api.js'

const TAMANO_PAGINA = 50
const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'veterinario', label: 'Veterinario' },
  { value: 'recepcion', label: 'Recepción' },
]
const ETIQUETAS_ROL = Object.fromEntries(
  ROLES.map(({ value, label }) => [value, label])
)
const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
const labelClass = 'mb-1.5 block text-xs font-medium text-slate-300'

function mostrarFecha(fecha) {
  if (!fecha) return '—'
  const parsedDate = new Date(fecha)
  if (Number.isNaN(parsedDate.getTime())) return '—'

  return new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate)
}

function nombreCompleto(usuario) {
  return [usuario.nombre, usuario.apellido].filter(Boolean).join(' ')
}

export default function Usuarios() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const esAdmin = user?.rol === 'admin'
  const [buscar, setBuscar] = useState('')
  const [buscarAplicado, setBuscarAplicado] = useState('')
  const [pagina, setPagina] = useState(0)
  const [usuarios, setUsuarios] = useState([])
  const [hayPaginaSiguiente, setHayPaginaSiguiente] = useState(false)
  const [consultaCargada, setConsultaCargada] = useState(null)
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [usuarioActivo, setUsuarioActivo] = useState(null)
  const [formData, setFormData] = useState(null)
  const [errorEdicion, setErrorEdicion] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [usuarioEnProceso, setUsuarioEnProceso] = useState(null)
  const [recargar, setRecargar] = useState(0)
  const searchTimeout = useRef(null)
  const cargando =
    !consultaCargada ||
    consultaCargada.buscarAplicado !== buscarAplicado ||
    consultaCargada.pagina !== pagina ||
    consultaCargada.recargar !== recargar

  useEffect(() => {
    return () => clearTimeout(searchTimeout.current)
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const parametros = new URLSearchParams({
      skip: String(pagina * TAMANO_PAGINA),
      limit: String(TAMANO_PAGINA + 1),
    })
    if (buscarAplicado.length >= 2) {
      parametros.set('buscar', buscarAplicado)
    }

    apiRequest(`/usuarios/?${parametros}`, { signal: controller.signal })
      .then((resultado) => {
        setUsuarios(resultado.slice(0, TAMANO_PAGINA))
        setHayPaginaSiguiente(resultado.length > TAMANO_PAGINA)
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError.message)
          setUsuarios([])
          setHayPaginaSiguiente(false)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setConsultaCargada({ buscarAplicado, pagina, recargar })
        }
      })

    return () => controller.abort()
  }, [buscarAplicado, pagina, recargar])

  const recargarLista = () => {
    setError('')
    setRecargar((actual) => actual + 1)
  }

  const abrirEdicion = (usuario) => {
    setUsuarioActivo(usuario)
    setFormData({
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      telefono: usuario.telefono || '',
      email: usuario.email || '',
      especialidad: usuario.especialidad || '',
      rol: usuario.rol,
    })
    setErrorEdicion('')
  }

  const cambiarCampo = (event) => {
    const { name, value } = event.target
    setFormData((actual) => ({
      ...actual,
      [name]: value,
      ...(name === 'rol' && value !== 'veterinario'
        ? { especialidad: '' }
        : {}),
    }))
    setErrorEdicion('')
  }

  const guardarCambios = async (event) => {
    event.preventDefault()
    if (!esAdmin || !usuarioActivo || !formData) return

    const nombre = formData.nombre.trim()
    const email = formData.email.trim().toLowerCase()
    if (!nombre || !email) {
      setErrorEdicion('El nombre y el correo electrónico son obligatorios.')
      return
    }

    const cambiosUsuario = {
      nombre,
      apellido: formData.apellido.trim() || null,
      telefono: formData.telefono.trim() || null,
      email,
      especialidad:
        formData.rol === 'veterinario'
          ? formData.especialidad.trim() || null
          : null,
      rol: formData.rol,
    }
    const usuarioModificado = Object.entries(cambiosUsuario).some(
      ([campo, valor]) => valor !== (usuarioActivo[campo] ?? null)
    )

    if (!usuarioModificado) {
      setErrorEdicion('No se realizaron cambios.')
      return
    }

    setGuardando(true)
    setErrorEdicion('')
    try {
      await apiRequest(`/usuarios/${usuarioActivo.id}`, {
        method: 'PATCH',
        body: JSON.stringify(cambiosUsuario),
      })

      setUsuarioActivo(null)
      setFormData(null)
      setMensaje('Los datos del usuario se actualizaron correctamente.')
      recargarLista()
    } catch (requestError) {
      setErrorEdicion(requestError.message)
    } finally {
      setGuardando(false)
    }
  }

  const desactivarUsuario = async (usuario) => {
    if (!esAdmin || usuario.id === user?.id) return
    if (
      !window.confirm(
        `¿Desea desactivar la cuenta de ${nombreCompleto(usuario)}?`
      )
    ) {
      return
    }

    setUsuarioEnProceso(usuario.id)
    setError('')
    setMensaje('')
    try {
      await apiRequest(`/usuarios/${usuario.id}`, { method: 'DELETE' })
      setMensaje(`Se desactivó la cuenta de ${nombreCompleto(usuario)}.`)
      recargarLista()
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setUsuarioEnProceso(null)
    }
  }

  if (!esAdmin) {
    return (
      <section
        role="alert"
        className="mx-auto max-w-4xl rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200"
      >
        No tienes permiso para administrar usuarios.
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Usuarios
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Administre cuentas activas, roles y datos de acceso
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/usuarios/nuevo')}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-950 transition-colors hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>No se pudo completar la operación: {error}</p>
          <button
            type="button"
            onClick={recargarLista}
            className="shrink-0 rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-red-500/10"
          >
            Reintentar
          </button>
        </div>
      )}
      {mensaje && (
        <p
          role="status"
          className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-sm text-emerald-300"
        >
          {mensaje}
        </p>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-xl sm:p-6">
        <label htmlFor="buscar_usuario" className={labelClass}>
          Buscar usuarios activos
        </label>
        <div className="relative max-w-xl">
          <Search
            className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500"
            aria-hidden="true"
          />
          <input
            id="buscar_usuario"
            type="search"
            value={buscar}
            onChange={(event) => {
              const value = event.target.value
              setBuscar(value)
              setPagina(0)
              setMensaje('')
              setError('')
              clearTimeout(searchTimeout.current)
              searchTimeout.current = setTimeout(
                () => setBuscarAplicado(value.trim()),
                300
              )
            }}
            placeholder="Nombre, correo, teléfono o especialidad..."
            maxLength={50}
            className={`${inputClass} pl-10`}
          />
        </div>
        {buscar.trim().length === 1 && (
          <p className="mt-1.5 text-xs text-slate-500">
            Ingrese al menos 2 caracteres para buscar.
          </p>
        )}
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2.5">
            <Shield className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-100">
              Cuentas activas
            </h2>
          </div>
          {!cargando && (
            <span className="text-xs text-slate-500">
              Página {pagina + 1} · {usuarios.length} usuarios
            </span>
          )}
        </div>

        {cargando ? (
          <p className="px-6 py-12 text-center text-sm text-slate-400">
            Cargando usuarios...
          </p>
        ) : usuarios.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UserRound
              className="mx-auto h-8 w-8 text-slate-600"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-slate-300">
              No se encontraron usuarios activos
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-5 py-3 font-medium">Usuario</th>
                  <th scope="col" className="px-5 py-3 font-medium">Correo</th>
                  <th scope="col" className="px-5 py-3 font-medium">Teléfono</th>
                  <th scope="col" className="px-5 py-3 font-medium">Rol</th>
                  <th scope="col" className="px-5 py-3 font-medium">Especialidad</th>
                  <th scope="col" className="px-5 py-3 font-medium">Creado</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usuarios.map((usuario) => {
                  const esUsuarioActual = usuario.id === user?.id
                  return (
                    <tr
                      key={usuario.id}
                      className="transition-colors hover:bg-slate-900/50"
                    >
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-slate-200">
                          {nombreCompleto(usuario) || 'Sin nombre'}
                        </p>
                        <p className="text-xs text-slate-500">
                          Usuario #{usuario.id}
                        </p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {usuario.email}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {usuario.telefono || '—'}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-medium text-emerald-300">
                          {ETIQUETAS_ROL[usuario.rol] || usuario.rol}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {usuario.especialidad || '—'}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-400">
                        {mostrarFecha(usuario.creado_en)}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => abrirEdicion(usuario)}
                            aria-label={`Modificar usuario ${nombreCompleto(usuario)}`}
                            title="Modificar"
                            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => desactivarUsuario(usuario)}
                            disabled={
                              usuarioEnProceso === usuario.id ||
                              esUsuarioActual
                            }
                            aria-label={
                              esUsuarioActual
                                ? 'No puedes desactivar tu propia cuenta'
                                : `Desactivar usuario ${nombreCompleto(usuario)}`
                            }
                            title={
                              esUsuarioActual
                                ? 'No puedes desactivar tu propia cuenta'
                                : 'Desactivar'
                            }
                            className="rounded-md p-2 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                          >
                            <UserX className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <footer className="flex items-center justify-between border-t border-slate-800 px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => {
              setError('')
              setPagina((actual) => Math.max(0, actual - 1))
            }}
            disabled={pagina === 0 || cargando}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </button>
          <button
            type="button"
            onClick={() => {
              setError('')
              setPagina((actual) => actual + 1)
            }}
            disabled={!hayPaginaSiguiente || cargando}
            className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </button>
        </footer>
      </section>

      <Dialog
        open={Boolean(usuarioActivo)}
        onOpenChange={(open) => {
          if (!open) {
            setUsuarioActivo(null)
            setFormData(null)
            setErrorEdicion('')
          }
        }}
      >
        {usuarioActivo && formData && (
          <DialogContent
            showCloseButton={false}
            className="max-h-[90vh] max-w-2xl overflow-y-auto border border-slate-700 bg-slate-950 text-slate-100"
          >
            <DialogHeader className="border-b border-slate-800 pb-4">
              <DialogTitle className="text-lg font-semibold text-slate-100">
                Modificar usuario
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                Actualice el perfil, rol y datos de contacto.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={guardarCambios} className="space-y-5">
              {errorEdicion && (
                <p
                  role="alert"
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm text-red-300"
                >
                  {errorEdicion}
                </p>
              )}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="editar_nombre" className={labelClass}>
                    Nombre *
                  </label>
                  <input
                    id="editar_nombre"
                    name="nombre"
                    required
                    maxLength={100}
                    value={formData.nombre}
                    onChange={cambiarCampo}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="editar_apellido" className={labelClass}>
                    Apellido
                  </label>
                  <input
                    id="editar_apellido"
                    name="apellido"
                    maxLength={100}
                    value={formData.apellido}
                    onChange={cambiarCampo}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="editar_email" className={labelClass}>
                    Correo electrónico *
                  </label>
                  <input
                    id="editar_email"
                    name="email"
                    type="email"
                    required
                    maxLength={150}
                    value={formData.email}
                    onChange={cambiarCampo}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="editar_telefono" className={labelClass}>
                    Teléfono
                  </label>
                  <input
                    id="editar_telefono"
                    name="telefono"
                    type="tel"
                    maxLength={30}
                    value={formData.telefono}
                    onChange={cambiarCampo}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="editar_rol" className={labelClass}>
                    Rol *
                  </label>
                  <select
                    id="editar_rol"
                    name="rol"
                    value={formData.rol}
                    onChange={cambiarCampo}
                    disabled={usuarioActivo.id === user?.id}
                    className={inputClass}
                  >
                    {ROLES.map((rol) => (
                      <option key={rol.value} value={rol.value}>
                        {rol.label}
                      </option>
                    ))}
                  </select>
                  {usuarioActivo.id === user?.id && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      No puedes cambiar tu propio rol.
                    </p>
                  )}
                </div>
                {formData.rol === 'veterinario' && (
                  <div>
                    <label htmlFor="editar_especialidad" className={labelClass}>
                      Especialidad
                    </label>
                    <input
                      id="editar_especialidad"
                      name="especialidad"
                      maxLength={100}
                      value={formData.especialidad}
                      onChange={cambiarCampo}
                      className={inputClass}
                    />
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setUsuarioActivo(null)
                    setFormData(null)
                  }}
                  className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
                >
                  <X className="h-4 w-4" />
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardando}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {guardando ? 'Guardando...' : 'Guardar cambios'}
                </button>
              </div>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}
