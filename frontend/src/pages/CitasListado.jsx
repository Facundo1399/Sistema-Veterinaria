import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Eye,
  ListFilter,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  X,
  XCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { apiRequest } from '../lib/api.js'

const LIMITE_PAGINA = 100
const TIPOS_CITA = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'vacunacion', label: 'Vacunación' },
  { value: 'control', label: 'Control' },
  { value: 'cirugia', label: 'Cirugía' },
]
const ESTADOS_CITA = [
  { value: 'pendiente', label: 'Pendiente' },
  { value: 'confirmada', label: 'Confirmada' },
  { value: 'completada', label: 'Completada' },
  { value: 'cancelada', label: 'Cancelada' },
]
const ETIQUETAS_ESTADO = Object.fromEntries(
  ESTADOS_CITA.map(({ value, label }) => [value, label])
)
const ETIQUETAS_TIPO = Object.fromEntries(
  TIPOS_CITA.map(({ value, label }) => [value, label])
)
const ESTILOS_ESTADO = {
  pendiente: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
  confirmada: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
  completada: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  cancelada: 'border-slate-700 bg-slate-800 text-slate-400',
}
const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
const labelClass = 'mb-1.5 block text-xs font-medium text-slate-300'

async function cargarTodos(path, filtros = {}, signal) {
  const resultados = []

  for (let skip = 0; ; skip += LIMITE_PAGINA) {
    const parametros = new URLSearchParams({
      ...filtros,
      skip: String(skip),
      limit: String(LIMITE_PAGINA),
    })
    const pagina = await apiRequest(`${path}?${parametros}`, { signal })
    resultados.push(...pagina)

    if (pagina.length < LIMITE_PAGINA) return resultados
  }
}

function diaSiguiente(fecha) {
  const dia = new Date(`${fecha}T00:00:00Z`)
  dia.setUTCDate(dia.getUTCDate() + 1)
  return dia.toISOString().slice(0, 10)
}

function mostrarFecha(fechaHora) {
  const [anio, mes, dia] = fechaHora.slice(0, 10).split('-')
  return `${dia}/${mes}/${anio}`
}

function mostrarHora(fechaHora) {
  return fechaHora.slice(11, 16)
}

function nombreCompleto(persona) {
  return [persona?.nombre, persona?.apellido].filter(Boolean).join(' ')
}

function obtenerNombreMascota(cita, mascotasPorId) {
  return mascotasPorId.get(cita.mascota_id)?.nombre || `Mascota #${cita.mascota_id}`
}

export default function CitasListado() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const esAdmin = user?.rol === 'admin'
  const esRecepcion = user?.rol === 'recepcion'
  const esVeterinario = user?.rol === 'veterinario'
  const [filtros, setFiltros] = useState({
    veterinario_id: '',
    estado: '',
    tipo: '',
    fecha: '',
  })
  const [busquedaMascota, setBusquedaMascota] = useState('')
  const [busquedaAplicada, setBusquedaAplicada] = useState('')
  const [citas, setCitas] = useState([])
  const [mascotas, setMascotas] = useState([])
  const [propietarios, setPropietarios] = useState([])
  const [veterinarios, setVeterinarios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [cargandoReferencias, setCargandoReferencias] = useState(true)
  const [error, setError] = useState('')
  const [errorReferencias, setErrorReferencias] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [citaActiva, setCitaActiva] = useState(null)
  const [modoDialogo, setModoDialogo] = useState('detalle')
  const [formEdicion, setFormEdicion] = useState(null)
  const [errorEdicion, setErrorEdicion] = useState('')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [citaEnProceso, setCitaEnProceso] = useState(null)
  const [recargarCitas, setRecargarCitas] = useState(0)
  const [recargarReferencias, setRecargarReferencias] = useState(0)

  useEffect(() => {
    const timeoutId = setTimeout(
      () => setBusquedaAplicada(busquedaMascota.trim()),
      300
    )
    return () => clearTimeout(timeoutId)
  }, [busquedaMascota])

  useEffect(() => {
    const controller = new AbortController()
    Promise.all([
      cargarTodos('/mascotas/', {}, controller.signal),
      cargarTodos('/propietarios/', {}, controller.signal),
      cargarTodos('/veterinarios/', {}, controller.signal),
    ])
      .then(([mascotasResponse, propietariosResponse, veterinariosResponse]) => {
        setMascotas(mascotasResponse)
        setPropietarios(propietariosResponse)
        setVeterinarios(veterinariosResponse)
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setErrorReferencias(requestError.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoReferencias(false)
      })

    return () => controller.abort()
  }, [recargarReferencias])

  useEffect(() => {
    const controller = new AbortController()
    const filtrosApi = {}
    if (filtros.veterinario_id) {
      filtrosApi.veterinario_id = filtros.veterinario_id
    }
    if (filtros.estado) filtrosApi.estado = filtros.estado
    if (filtros.fecha) {
      filtrosApi.desde = `${filtros.fecha}T00:00:00`
      filtrosApi.hasta = `${diaSiguiente(filtros.fecha)}T00:00:00`
    }

    const buscarCitas = async () => {
      try {
        let mascotasCoincidentes = null
        const termino = busquedaAplicada.trim()

        if (termino.length >= 2) {
          const coincidencias = await cargarTodos(
            '/mascotas/',
            { buscar: termino },
            controller.signal
          )
          const nombreBuscado = termino.toLocaleLowerCase('es-AR')
          mascotasCoincidentes = new Set(
            coincidencias
              .filter((mascota) =>
                mascota.nombre
                  .toLocaleLowerCase('es-AR')
                  .includes(nombreBuscado)
              )
              .map((mascota) => mascota.id)
          )
          if (mascotasCoincidentes.size === 0) {
            setCitas([])
            return
          }
        }

        const resultados = await cargarTodos(
          '/citas/',
          filtrosApi,
          controller.signal
        )
        setCitas(
          resultados.filter((cita) => {
            const coincideMascota =
              mascotasCoincidentes === null ||
              mascotasCoincidentes.has(cita.mascota_id)
            return coincideMascota && (!filtros.tipo || cita.tipo === filtros.tipo)
          })
        )
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setError(requestError.message)
          setCitas([])
        }
      } finally {
        if (!controller.signal.aborted) setCargando(false)
      }
    }

    buscarCitas()
    return () => controller.abort()
  }, [busquedaAplicada, filtros, recargarCitas])

  const mascotasPorId = useMemo(
    () => new Map(mascotas.map((mascota) => [mascota.id, mascota])),
    [mascotas]
  )
  const propietariosPorId = useMemo(
    () => new Map(propietarios.map((propietario) => [propietario.id, propietario])),
    [propietarios]
  )
  const veterinariosPorId = useMemo(
    () => new Map(veterinarios.map((veterinario) => [veterinario.id, veterinario])),
    [veterinarios]
  )

  const actualizarFiltros = (event) => {
    const { name, value } = event.target
    setCargando(true)
    setError('')
    setMensaje('')
    setFiltros((actuales) => ({ ...actuales, [name]: value }))
  }

  const cambiarBusqueda = (event) => {
    setCargando(true)
    setError('')
    setMensaje('')
    setBusquedaMascota(event.target.value)
  }

  const limpiarFiltros = () => {
    setCargando(true)
    setError('')
    setMensaje('')
    setBusquedaMascota('')
    setBusquedaAplicada('')
    setFiltros({
      veterinario_id: '',
      estado: '',
      tipo: '',
      fecha: '',
    })
  }

  const reintentar = () => {
    setCargando(true)
    setCargandoReferencias(true)
    setError('')
    setErrorReferencias('')
    setRecargarCitas((actual) => actual + 1)
    setRecargarReferencias((actual) => actual + 1)
  }

  const obtenerMascota = (cita) => mascotasPorId.get(cita.mascota_id)
  const obtenerPropietario = (cita) => {
    const mascota = obtenerMascota(cita)
    return mascota ? propietariosPorId.get(mascota.propietario_id) : null
  }
  const obtenerVeterinario = (cita) =>
    veterinariosPorId.get(cita.veterinario_id)

  const puedeGestionar = (cita) =>
    esAdmin ||
    esRecepcion ||
    (esVeterinario && cita.veterinario_id === user?.id)

  const puedeModificar = (cita) =>
    puedeGestionar(cita) &&
    cita.estado !== 'cancelada' &&
    cita.estado !== 'completada'

  const puedeCompletar = (cita) =>
    (esAdmin ||
      (esVeterinario && cita.veterinario_id === user?.id)) &&
    ['pendiente', 'confirmada'].includes(cita.estado)

  const iniciarEdicion = (cita) => {
    setCitaActiva(cita)
    setModoDialogo('editar')
    setErrorEdicion('')
    setFormEdicion({
      fecha: cita.fecha_hora.slice(0, 10),
      hora: mostrarHora(cita.fecha_hora),
      duracion_min: String(cita.duracion_min),
      veterinario_id: cita.veterinario_id ? String(cita.veterinario_id) : '',
      tipo: cita.tipo,
      motivo: cita.motivo || '',
    })
  }

  const guardarEdicion = async (event) => {
    event.preventDefault()
    if (!citaActiva || !formEdicion) return
    if (!puedeModificar(citaActiva)) {
      setErrorEdicion('No tienes permiso para modificar esta cita.')
      return
    }

    const duracion = Number(formEdicion.duracion_min)
    if (!Number.isSafeInteger(duracion) || duracion < 30) {
      setErrorEdicion('La duración debe ser de al menos 30 minutos.')
      return
    }

    const cambios = {}
    const fechaHora = `${formEdicion.fecha}T${formEdicion.hora}:00`
    if (fechaHora.slice(0, 16) !== citaActiva.fecha_hora.slice(0, 16)) {
      cambios.fecha_hora = fechaHora
    }
    if (duracion !== citaActiva.duracion_min) cambios.duracion_min = duracion
    const motivo = formEdicion.motivo.trim() || null
    if (motivo !== (citaActiva.motivo || null)) cambios.motivo = motivo

    if (esAdmin && formEdicion.tipo !== citaActiva.tipo) {
      cambios.tipo = formEdicion.tipo
    }
    if (
      (esAdmin || esRecepcion) &&
      formEdicion.veterinario_id !==
        (citaActiva.veterinario_id
          ? String(citaActiva.veterinario_id)
          : '')
    ) {
      cambios.veterinario_id = formEdicion.veterinario_id
        ? Number(formEdicion.veterinario_id)
        : null
    }

    if (Object.keys(cambios).length === 0) {
      setErrorEdicion('No se realizaron cambios.')
      return
    }

    setGuardandoEdicion(true)
    setErrorEdicion('')
    setError('')
    try {
      await apiRequest(`/citas/${citaActiva.id}`, {
        method: 'PATCH',
        body: JSON.stringify(cambios),
      })
      setMensaje('La cita se actualizó correctamente.')
      setCitaActiva(null)
      setFormEdicion(null)
      setCargando(true)
      setRecargarCitas((actual) => actual + 1)
    } catch (requestError) {
      setErrorEdicion(requestError.message)
    } finally {
      setGuardandoEdicion(false)
    }
  }

  const actualizarEstado = async (cita, estado) => {
    const puedeCambiarEstado =
      (estado === 'confirmada' &&
        puedeGestionar(cita) &&
        cita.estado === 'pendiente') ||
      (estado === 'cancelada' &&
        puedeGestionar(cita) &&
        ['pendiente', 'confirmada'].includes(cita.estado)) ||
      (estado === 'completada' && puedeCompletar(cita))
    if (!puedeCambiarEstado) {
      setError('No tienes permiso para realizar ese cambio de estado.')
      return
    }

    if (
      estado === 'cancelada' &&
      !window.confirm('¿Desea cancelar esta cita?')
    ) {
      return
    }

    setCitaEnProceso(cita.id)
    setError('')
    setMensaje('')
    try {
      await apiRequest(`/citas/${cita.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ estado }),
      })
      const mensajesEstado = {
        confirmada: 'La cita se confirmó correctamente.',
        completada: 'La cita se marcó como completada.',
        cancelada: 'La cita se canceló correctamente.',
      }
      setMensaje(mensajesEstado[estado])
      setCitaActiva(null)
      setCargando(true)
      setRecargarCitas((actual) => actual + 1)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setCitaEnProceso(null)
    }
  }

  const esEstadoCerrado =
    citaActiva?.estado === 'cancelada' || citaActiva?.estado === 'completada'

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Listado de citas
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Consulte y administre los turnos de la clínica
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/citas')}
          className="flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-950 transition-colors hover:bg-emerald-500"
        >
          <Plus className="h-4 w-4" />
          Crear cita
        </button>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>No se pudo cargar o actualizar el listado: {error}</p>
          <button
            type="button"
            onClick={reintentar}
            className="shrink-0 rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-red-500/10"
          >
            Reintentar
          </button>
        </div>
      )}
      {errorReferencias && (
        <p
          role="alert"
          className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-sm text-amber-200"
        >
          No se pudieron cargar los nombres de mascotas, propietarios o
          veterinarios: {errorReferencias}
        </p>
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
        <div className="mb-4 flex items-center gap-2">
          <ListFilter className="h-4 w-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-sm font-semibold text-slate-100">
            Buscar y filtrar
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
          <div className="lg:col-span-2">
            <label htmlFor="buscar_mascota" className={labelClass}>
              Nombre de la mascota
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                id="buscar_mascota"
                type="search"
                value={busquedaMascota}
                onChange={cambiarBusqueda}
                placeholder="Buscar por nombre..."
                maxLength={50}
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="filtro_veterinario" className={labelClass}>
              Veterinario
            </label>
            <select
              id="filtro_veterinario"
              name="veterinario_id"
              value={filtros.veterinario_id}
              onChange={actualizarFiltros}
              disabled={cargandoReferencias}
              className={inputClass}
            >
              <option value="">Todos</option>
              {veterinarios.map((veterinario) => (
                <option key={veterinario.id} value={veterinario.id}>
                  {nombreCompleto(veterinario)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro_estado" className={labelClass}>Estado</label>
            <select
              id="filtro_estado"
              name="estado"
              value={filtros.estado}
              onChange={actualizarFiltros}
              className={inputClass}
            >
              <option value="">Todos</option>
              {ESTADOS_CITA.map((estado) => (
                <option key={estado.value} value={estado.value}>
                  {estado.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro_tipo" className={labelClass}>Tipo</label>
            <select
              id="filtro_tipo"
              name="tipo"
              value={filtros.tipo}
              onChange={actualizarFiltros}
              className={inputClass}
            >
              <option value="">Todos</option>
              {TIPOS_CITA.map((tipo) => (
                <option key={tipo.value} value={tipo.value}>
                  {tipo.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="filtro_fecha" className={labelClass}>Fecha</label>
            <input
              id="filtro_fecha"
              name="fecha"
              type="date"
              value={filtros.fecha}
              onChange={actualizarFiltros}
              className={`${inputClass} [color-scheme:dark]`}
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={limpiarFiltros}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <RotateCcw className="h-4 w-4" />
              Limpiar
            </button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-800 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-100">
              Citas registradas
            </h2>
          </div>
          {!cargando && (
            <p className="text-xs text-slate-500">
              {citas.length} {citas.length === 1 ? 'resultado' : 'resultados'}
              {busquedaAplicada.length === 1 &&
                ' · escriba al menos 2 caracteres para buscar mascota'}
            </p>
          )}
        </div>

        {cargando ? (
          <p className="px-6 py-12 text-center text-sm text-slate-400">
            Cargando citas...
          </p>
        ) : citas.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <CalendarDays className="mx-auto h-8 w-8 text-slate-600" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-slate-300">
              No se encontraron citas con esos filtros
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-5 py-3 font-medium">Mascota</th>
                  <th scope="col" className="px-5 py-3 font-medium">Propietario</th>
                  <th scope="col" className="px-5 py-3 font-medium">Veterinario</th>
                  <th scope="col" className="px-5 py-3 font-medium">Tipo</th>
                  <th scope="col" className="px-5 py-3 font-medium">Fecha</th>
                  <th scope="col" className="px-5 py-3 font-medium">Hora</th>
                  <th scope="col" className="px-5 py-3 font-medium">Estado</th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {citas.map((cita) => {
                  const gestionar = puedeGestionar(cita)
                  const puedeModificarCita = puedeModificar(cita)
                  const puedeConfirmar =
                    gestionar && cita.estado === 'pendiente'
                  const puedeCancelar =
                    gestionar &&
                    (cita.estado === 'pendiente' ||
                      cita.estado === 'confirmada')
                  const puedeMarcarCompletada = puedeCompletar(cita)
                  const veterinario = obtenerVeterinario(cita)

                  return (
                    <tr key={cita.id} className="transition-colors hover:bg-slate-900/50">
                      <td className="px-5 py-3.5 font-medium text-slate-200">
                        {obtenerNombreMascota(cita, mascotasPorId)}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {nombreCompleto(obtenerPropietario(cita)) || 'No disponible'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {nombreCompleto(veterinario) || 'Sin asignar'}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {ETIQUETAS_TIPO[cita.tipo] || cita.tipo}
                      </td>
                      <td className="px-5 py-3.5 text-slate-300">
                        {mostrarFecha(cita.fecha_hora)}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-xs text-slate-300">
                        {mostrarHora(cita.fecha_hora)}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${
                            ESTILOS_ESTADO[cita.estado] ||
                            'border-slate-700 bg-slate-800 text-slate-300'
                          }`}
                        >
                          {ETIQUETAS_ESTADO[cita.estado] || cita.estado}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setCitaActiva(cita)
                              setModoDialogo('detalle')
                              setErrorEdicion('')
                            }}
                            aria-label={`Ver detalle de cita ${cita.id}`}
                            title="Ver detalle"
                            className="rounded-md p-2 text-slate-400 transition-colors hover:bg-slate-800 hover:text-slate-100"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {puedeModificarCita && (
                            <button
                              type="button"
                              onClick={() => iniciarEdicion(cita)}
                              aria-label={`Modificar cita ${cita.id}`}
                              title="Modificar"
                              className="rounded-md p-2 text-slate-400 transition-colors hover:bg-blue-500/10 hover:text-blue-300"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {puedeConfirmar && (
                            <button
                              type="button"
                              onClick={() => actualizarEstado(cita, 'confirmada')}
                              disabled={citaEnProceso === cita.id}
                              aria-label={`Confirmar cita ${cita.id}`}
                              title="Confirmar"
                              className="rounded-md p-2 text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                            >
                              <Check className="h-4 w-4" />
                            </button>
                          )}
                          {puedeMarcarCompletada && (
                            <button
                              type="button"
                              onClick={() =>
                                actualizarEstado(cita, 'completada')
                              }
                              disabled={citaEnProceso === cita.id}
                              aria-label={`Marcar como completada la cita ${cita.id}`}
                              title="Marcar como completada"
                              className="rounded-md p-2 text-emerald-400 transition-colors hover:bg-emerald-500/10 disabled:opacity-50"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                          )}
                          {puedeCancelar && (
                            <button
                              type="button"
                              onClick={() => actualizarEstado(cita, 'cancelada')}
                              disabled={citaEnProceso === cita.id}
                              aria-label={`Cancelar cita ${cita.id}`}
                              title="Cancelar"
                              className="rounded-md p-2 text-red-400 transition-colors hover:bg-red-500/10 disabled:opacity-50"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Dialog
        open={Boolean(citaActiva)}
        onOpenChange={(open) => {
          if (!open) {
            setCitaActiva(null)
            setFormEdicion(null)
          }
        }}
      >
        {citaActiva && (
          <DialogContent
            showCloseButton={false}
            className="max-h-[90vh] max-w-2xl overflow-y-auto border border-slate-700 bg-slate-950 text-slate-100"
          >
            <DialogHeader className="border-b border-slate-800 pb-4">
              <DialogTitle className="text-lg font-semibold text-slate-100">
                {modoDialogo === 'editar'
                  ? `Modificar cita #${citaActiva.id}`
                  : `Detalle de cita #${citaActiva.id}`}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {modoDialogo === 'editar'
                  ? 'Actualice los datos permitidos para su rol.'
                  : 'Información del turno y sus participantes.'}
              </DialogDescription>
            </DialogHeader>

            {modoDialogo === 'detalle' ? (
              <div className="space-y-4">
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Mascota</dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {obtenerNombreMascota(citaActiva, mascotasPorId)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Propietario</dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {nombreCompleto(obtenerPropietario(citaActiva)) || 'No disponible'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Veterinario</dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {nombreCompleto(obtenerVeterinario(citaActiva)) || 'Sin asignar'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Tipo</dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {ETIQUETAS_TIPO[citaActiva.tipo] || citaActiva.tipo}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Fecha y hora</dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {mostrarFecha(citaActiva.fecha_hora)} · {mostrarHora(citaActiva.fecha_hora)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Duración</dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {citaActiva.duracion_min} minutos
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-slate-500">Estado</dt>
                    <dd className="mt-1 text-sm text-slate-100">
                      {ETIQUETAS_ESTADO[citaActiva.estado] || citaActiva.estado}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-slate-500">Motivo</dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-100">
                      {citaActiva.motivo?.trim() || 'Sin motivo indicado'}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap justify-end gap-2 border-t border-slate-800 pt-4">
                  {puedeModificar(citaActiva) && (
                    <button
                      type="button"
                      onClick={() => iniciarEdicion(citaActiva)}
                      className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
                    >
                      <Pencil className="h-4 w-4" />
                      Modificar
                    </button>
                  )}
                  {puedeGestionar(citaActiva) && citaActiva.estado === 'pendiente' && (
                    <button
                      type="button"
                      onClick={() => actualizarEstado(citaActiva, 'confirmada')}
                      disabled={citaEnProceso === citaActiva.id}
                      className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50"
                    >
                      <Check className="h-4 w-4" />
                      Confirmar
                    </button>
                  )}
                  {puedeCompletar(citaActiva) && (
                    <button
                      type="button"
                      onClick={() => actualizarEstado(citaActiva, 'completada')}
                      disabled={citaEnProceso === citaActiva.id}
                      className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-sm font-medium text-emerald-300 transition-colors hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Marcar completada
                    </button>
                  )}
                  {puedeGestionar(citaActiva) &&
                    ['pendiente', 'confirmada'].includes(citaActiva.estado) && (
                      <button
                        type="button"
                        onClick={() => actualizarEstado(citaActiva, 'cancelada')}
                        disabled={citaEnProceso === citaActiva.id}
                        className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <XCircle className="h-4 w-4" />
                        Cancelar cita
                      </button>
                    )}
                  <button
                    type="button"
                    onClick={() => setCitaActiva(null)}
                    className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    <X className="h-4 w-4" />
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={guardarEdicion} className="space-y-5">
                {errorEdicion && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm text-red-300"
                  >
                    {errorEdicion}
                  </p>
                )}
                {esEstadoCerrado && (
                  <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2 text-sm text-amber-200">
                    Las citas completadas o canceladas no se pueden modificar.
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label htmlFor="editar_fecha" className={labelClass}>Fecha</label>
                    <input
                      id="editar_fecha"
                      type="date"
                      required
                      value={formEdicion?.fecha || ''}
                      onChange={(event) => setFormEdicion((actual) => ({
                        ...actual,
                        fecha: event.target.value,
                      }))}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </div>
                  <div>
                    <label htmlFor="editar_hora" className={labelClass}>Hora</label>
                    <input
                      id="editar_hora"
                      type="time"
                      required
                      value={formEdicion?.hora || ''}
                      onChange={(event) => setFormEdicion((actual) => ({
                        ...actual,
                        hora: event.target.value,
                      }))}
                      className={`${inputClass} [color-scheme:dark]`}
                    />
                  </div>
                  <div>
                    <label htmlFor="editar_duracion" className={labelClass}>
                      Duración (minutos)
                    </label>
                    <input
                      id="editar_duracion"
                      type="number"
                      min="30"
                      step="15"
                      required
                      value={formEdicion?.duracion_min || ''}
                      onChange={(event) => setFormEdicion((actual) => ({
                        ...actual,
                        duracion_min: event.target.value,
                      }))}
                      className={inputClass}
                    />
                  </div>
                  {(esAdmin || esRecepcion) && (
                    <div>
                      <label htmlFor="editar_veterinario" className={labelClass}>
                        Veterinario
                      </label>
                      <select
                        id="editar_veterinario"
                        value={formEdicion?.veterinario_id || ''}
                        onChange={(event) => setFormEdicion((actual) => ({
                          ...actual,
                          veterinario_id: event.target.value,
                        }))}
                        className={inputClass}
                      >
                        <option value="">Sin asignar</option>
                        {veterinarios.map((veterinario) => (
                          <option key={veterinario.id} value={veterinario.id}>
                            {nombreCompleto(veterinario)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  {esAdmin && (
                    <div>
                      <label htmlFor="editar_tipo" className={labelClass}>Tipo</label>
                      <select
                        id="editar_tipo"
                        value={formEdicion?.tipo || ''}
                        onChange={(event) => setFormEdicion((actual) => ({
                          ...actual,
                          tipo: event.target.value,
                        }))}
                        className={inputClass}
                      >
                        {TIPOS_CITA.map((tipo) => (
                          <option key={tipo.value} value={tipo.value}>
                            {tipo.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <label htmlFor="editar_motivo" className={labelClass}>Motivo</label>
                    <textarea
                      id="editar_motivo"
                      rows={3}
                      value={formEdicion?.motivo || ''}
                      onChange={(event) => setFormEdicion((actual) => ({
                        ...actual,
                        motivo: event.target.value,
                      }))}
                      className={`${inputClass} resize-none`}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      setCitaActiva(null)
                      setFormEdicion(null)
                    }}
                    className="rounded-lg border border-slate-700 bg-slate-900 px-3.5 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800"
                  >
                    Cerrar
                  </button>
                  <button
                    type="submit"
                    disabled={guardandoEdicion || esEstadoCerrado}
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Check className="h-4 w-4" />
                    {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
                  </button>
                </div>
              </form>
            )}
          </DialogContent>
        )}
      </Dialog>
    </div>
  )
}