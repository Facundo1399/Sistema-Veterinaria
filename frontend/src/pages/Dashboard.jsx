import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  PawPrint,
  Stethoscope,
  UserRound,
  UserRoundPlus,
  UserCog,
} from 'lucide-react'
import { apiRequest } from '../lib/api.js'
import { useAuth } from '../context/AuthContext.jsx'

const ZONA_CLINICA = 'America/Argentina/Buenos_Aires'
const LIMITE_LISTADO = 100

function obtenerFechaClinica() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_CLINICA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]))
  const hoy = `${valores.year}-${valores.month}-${valores.day}`
  const manana = new Date(Date.UTC(
    Number(valores.year),
    Number(valores.month) - 1,
    Number(valores.day) + 1
  )).toISOString().slice(0, 10)

  return { hoy, manana }
}

function formatearCantidad(cantidad) {
  return cantidad === LIMITE_LISTADO ? `${LIMITE_LISTADO}+` : cantidad
}

function formatearHora(fechaHora) {
  return fechaHora.slice(11, 16)
}

function estadoCita(estado) {
  const estilos = {
    pendiente: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    confirmada: 'border-blue-500/20 bg-blue-500/10 text-blue-300',
    completada: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    cancelada: 'border-slate-700 bg-slate-800 text-slate-400',
  }

  return estilos[estado] || 'border-slate-700 bg-slate-800 text-slate-300'
}

function nombreCompleto(persona) {
  return [persona?.nombre, persona?.apellido].filter(Boolean).join(' ')
}

function TarjetaMetrica({ etiqueta, valor, detalle, Icono, color }) {
  return (
    <article className="rounded-xl border border-slate-800 bg-slate-950 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xs font-medium text-slate-400">{etiqueta}</h2>
        <Icono className={`h-4 w-4 shrink-0 ${color}`} aria-hidden="true" />
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-100">{valor}</p>
      <p className="mt-1 text-xs text-slate-500">{detalle}</p>
    </article>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const rol = user?.rol
  const puedeRegistrar = rol === 'admin' || rol === 'recepcion'
  const esAdmin = rol === 'admin'
  const puedeVerInfoClinica = esAdmin || rol === 'veterinario'
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(true)
  const [recarga, setRecarga] = useState(0)
  const [fechaHoy] = useState(() =>
    new Intl.DateTimeFormat('es-AR', {
      dateStyle: 'full',
      timeZone: ZONA_CLINICA,
    }).format(new Date())
  )

  useEffect(() => {
    const controller = new AbortController()
    const { hoy, manana } = obtenerFechaClinica()
    const parametrosCitas = new URLSearchParams({
      desde: `${hoy}T00:00:00`,
      hasta: `${manana}T00:00:00`,
      limit: String(LIMITE_LISTADO),
    })

    Promise.all([
      apiRequest(`/mascotas/?limit=${LIMITE_LISTADO}`, {
        signal: controller.signal,
      }),
      apiRequest(`/propietarios/?limit=${LIMITE_LISTADO}`, {
        signal: controller.signal,
      }),
      apiRequest(`/veterinarios/?limit=${LIMITE_LISTADO}`, {
        signal: controller.signal,
      }),
      apiRequest(`/citas/?${parametrosCitas}`, {
        signal: controller.signal,
      }),
    ])
      .then(([mascotas, propietarios, veterinarios, citas]) => {
        setDatos({ mascotas, propietarios, veterinarios, citas })
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError.message)
          setDatos(null)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setCargando(false)
        }
      })

    return () => controller.abort()
  }, [recarga])

  const irA = (ruta) => navigate(ruta)
  const mascotasPorId = new Map((datos?.mascotas || []).map((mascota) => [mascota.id, mascota]))
  const propietariosPorId = new Map((datos?.propietarios || []).map((propietario) => [propietario.id, propietario]))
  const veterinariosPorId = new Map((datos?.veterinarios || []).map((veterinario) => [veterinario.id, veterinario]))
  const citas = datos?.citas || []
  const citasPendientes = citas.filter((cita) => cita.estado === 'pendiente').length
  const citasConfirmadas = citas.filter((cita) => cita.estado === 'confirmada').length
  const citasDelDia = citas.length === LIMITE_LISTADO ? `${LIMITE_LISTADO}+` : citas.length
  const detalleCitas = `${citasConfirmadas} confirmadas · ${citasPendientes} pendientes${
    citas.length === LIMITE_LISTADO ? ' · primeras 100' : ''
  }`

  const reintentarCarga = () => {
    setCargando(true)
    setError('')
    setRecarga((actual) => actual + 1)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Resumen general
          </h1>
          <p className="mt-1 text-sm capitalize text-slate-400">{fechaHoy}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {puedeRegistrar && (
            <button
              type="button"
              onClick={() => irA('/propietarios')}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-900"
            >
              <UserRoundPlus className="h-4 w-4 text-emerald-400" />
              Nuevo propietario
            </button>
          )}
          {puedeRegistrar && (
            <button
              type="button"
              onClick={() => irA('/mascotas')}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-xs font-medium text-slate-200 transition-colors hover:bg-slate-900"
            >
              <PawPrint className="h-4 w-4 text-emerald-400" />
              Registrar mascota
            </button>
          )}
          <button
            type="button"
            onClick={() => irA('/citas')}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-950 transition-colors hover:bg-emerald-500"
          >
            <CalendarDays className="h-4 w-4" />
            Agendar cita
          </button>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>No se pudo cargar el resumen: {error}</p>
          <button
            type="button"
            onClick={reintentarCarga}
            className="shrink-0 rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-red-500/10"
          >
            Reintentar
          </button>
        </div>
      )}

      <section
        aria-label="Indicadores de la clínica"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <TarjetaMetrica
          etiqueta="Mascotas activas"
          valor={cargando ? '—' : formatearCantidad(datos?.mascotas.length || 0)}
          detalle="Pacientes registrados"
          Icono={PawPrint}
          color="text-emerald-400"
        />
        <TarjetaMetrica
          etiqueta="Propietarios"
          valor={cargando ? '—' : formatearCantidad(datos?.propietarios.length || 0)}
          detalle="Titulares registrados"
          Icono={UserRound}
          color="text-blue-400"
        />
        <TarjetaMetrica
          etiqueta="Citas de hoy"
          valor={cargando ? '—' : citasDelDia}
          detalle={detalleCitas}
          Icono={CalendarDays}
          color="text-amber-400"
        />
        <TarjetaMetrica
          etiqueta="Citas pendientes"
          valor={cargando ? '—' : citasPendientes}
          detalle="Requieren seguimiento"
          Icono={CheckCircle2}
          color="text-violet-400"
        />
      </section>

      <section
        className={`grid grid-cols-1 gap-6 ${
          puedeVerInfoClinica || esAdmin ? 'lg:grid-cols-3' : ''
        }`}
      >
        <article
          className={`rounded-xl border border-slate-800 bg-slate-950 p-5 sm:p-6 ${
            puedeVerInfoClinica || esAdmin ? 'lg:col-span-2' : ''
          }`}
        >
          <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div className="flex items-center gap-2.5">
              <CalendarDays className="h-5 w-5 text-emerald-400" aria-hidden="true" />
              <div>
                <h2 className="text-base font-semibold text-slate-100">
                  Citas de hoy
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Agenda del día en horario de Buenos Aires
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => irA('/citas')}
              className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-400 transition-colors hover:text-emerald-300"
            >
              Ver agenda <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {cargando ? (
            <p className="py-8 text-center text-sm text-slate-400">
              Cargando agenda...
            </p>
          ) : !error && citas.length === 0 ? (
            <div className="py-8 text-center">
              <CalendarDays className="mx-auto h-8 w-8 text-slate-600" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-slate-300">
                No hay citas programadas para hoy
              </p>
              <button
                type="button"
                onClick={() => irA('/citas')}
                className="mt-2 text-xs font-medium text-emerald-400 hover:text-emerald-300"
              >
                Ir a citas
              </button>
            </div>
          ) : !error ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800/80 text-xs uppercase tracking-wider text-slate-500">
                    <th scope="col" className="pb-3 pr-4 font-medium">Hora</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Mascota / propietario</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Tipo</th>
                    <th scope="col" className="pb-3 pr-4 font-medium">Veterinario</th>
                    <th scope="col" className="pb-3 text-right font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {citas.slice(0, 8).map((cita) => {
                    const mascota = mascotasPorId.get(cita.mascota_id)
                    const propietario = propietariosPorId.get(mascota?.propietario_id)
                    const veterinario = veterinariosPorId.get(cita.veterinario_id)

                    return (
                      <tr key={cita.id} className="transition-colors hover:bg-slate-900/50">
                        <td className="py-3.5 pr-4 font-mono text-xs font-semibold text-slate-300">
                          <span className="inline-flex items-center gap-1.5">
                            <Clock3 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                            {formatearHora(cita.fecha_hora)}
                          </span>
                        </td>
                        <td className="py-3.5 pr-4">
                          <p className="font-medium text-slate-200">
                            {mascota?.nombre || `Mascota #${cita.mascota_id}`}
                          </p>
                          <p className="text-xs text-slate-500">
                            {propietario
                              ? nombreCompleto(propietario)
                              : 'Propietario no disponible'}
                          </p>
                        </td>
                        <td className="py-3.5 pr-4 text-xs capitalize text-slate-300">
                          {cita.tipo}
                        </td>
                        <td className="py-3.5 pr-4 text-xs text-slate-400">
                          {veterinario
                            ? nombreCompleto(veterinario)
                            : 'Sin asignar'}
                        </td>
                        <td className="py-3.5 text-right">
                          <span
                            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${estadoCita(cita.estado)}`}
                          >
                            {cita.estado}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : null}
        </article>

        {(puedeVerInfoClinica || esAdmin) && (
          <aside className="space-y-6">
            {puedeVerInfoClinica && (
              <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
                <div className="mb-4 flex items-center gap-2.5 border-b border-slate-800 pb-3">
                  <Stethoscope className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-slate-100">
                    Información clínica
                  </h2>
                </div>
                {cargando ? (
                  <p className="text-sm text-slate-400">Cargando información...</p>
                ) : error ? (
                  <p className="text-sm text-slate-400">No disponible</p>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
                      <span className="text-sm text-slate-300">Veterinarios activos</span>
                      <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
                        {formatearCantidad(datos?.veterinarios.length || 0)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/40 p-3">
                      <span className="text-sm text-slate-300">Citas confirmadas</span>
                      <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-300">
                        {citasConfirmadas}
                      </span>
                    </div>
                  </div>
                )}
              </section>
            )}

            {esAdmin && (
              <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 sm:p-6">
                <div className="mb-3 flex items-center gap-2.5">
                  <UserCog className="h-5 w-5 text-emerald-400" aria-hidden="true" />
                  <h2 className="text-base font-semibold text-slate-100">
                    Administración
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => irA('/usuarios')}
                  className="flex w-full items-center justify-between rounded-lg border border-slate-800/80 bg-slate-900/40 p-3 text-left transition-colors hover:bg-slate-900"
                >
                  <span className="text-sm text-slate-300">Gestión de usuarios</span>
                  <ArrowRight className="h-4 w-4 text-slate-500" aria-hidden="true" />
                </button>
              </section>
            )}
          </aside>
        )}
      </section>
    </div>
  )
}
