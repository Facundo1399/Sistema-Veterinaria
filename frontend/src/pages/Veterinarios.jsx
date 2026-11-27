import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarPlus, RotateCcw, Search, Stethoscope, UserRound } from 'lucide-react'
import { apiRequest } from '../lib/api.js'

const LIMITE_VETERINARIOS = 100
const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
const labelClass = 'mb-1.5 block text-xs font-medium text-slate-300'

function nombreCompleto(veterinario) {
  return [veterinario.nombre, veterinario.apellido].filter(Boolean).join(' ')
}

async function cargarVeterinarios(signal) {
  const veterinarios = []

  for (let skip = 0; ; skip += LIMITE_VETERINARIOS) {
    const parametros = new URLSearchParams({
      skip: String(skip),
      limit: String(LIMITE_VETERINARIOS),
    })
    const pagina = await apiRequest(`/veterinarios/?${parametros}`, { signal })
    veterinarios.push(...pagina)

    if (pagina.length < LIMITE_VETERINARIOS) return veterinarios
  }
}

export default function Veterinarios() {
  const navigate = useNavigate()
  const [veterinarios, setVeterinarios] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [filtroEspecialidad, setFiltroEspecialidad] = useState('')
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [recargar, setRecargar] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    cargarVeterinarios(controller.signal)
      .then((resultado) => {
        setVeterinarios(resultado)
        setError('')
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(requestError.message)
          setVeterinarios([])
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargando(false)
      })

    return () => controller.abort()
  }, [recargar])

  const especialidades = useMemo(
    () =>
      [...new Set(veterinarios.map((veterinario) => veterinario.especialidad?.trim()).filter(Boolean))]
        .sort((a, b) => a.localeCompare(b, 'es')),
    [veterinarios]
  )

  const veterinariosFiltrados = useMemo(() => {
    const termino = busqueda.trim().toLocaleLowerCase('es')

    return veterinarios.filter((veterinario) => {
      const especialidad = veterinario.especialidad?.trim() || ''
      const coincideEspecialidad =
        !filtroEspecialidad || especialidad === filtroEspecialidad
      const texto = `${nombreCompleto(veterinario)} ${especialidad}`
        .toLocaleLowerCase('es')

      return coincideEspecialidad && texto.includes(termino)
    })
  }, [busqueda, filtroEspecialidad, veterinarios])

  const agendarConVeterinario = (veterinario) => {
    const parametros = new URLSearchParams({
      veterinario_id: String(veterinario.id),
    })
    navigate(`/citas?${parametros}`)
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-600/15 text-emerald-400">
          <Stethoscope className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-100">
            Veterinarios
          </h1>
          <p className="text-sm text-slate-400">
            Consulte profesionales activos y sus especialidades para agendar citas.
          </p>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>No se pudo cargar el listado: {error}</p>
          <button
            type="button"
            onClick={() => {
              setCargando(true)
              setError('')
              setRecargar((actual) => actual + 1)
            }}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-red-400/30 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-red-500/10"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Reintentar
          </button>
        </div>
      )}

      <section className="rounded-xl border border-slate-800 bg-slate-950 p-5 shadow-xl sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="buscar_veterinario" className={labelClass}>
              Buscar veterinarios activos
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
              <input
                id="buscar_veterinario"
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Nombre o especialidad..."
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
          <div>
            <label htmlFor="filtro_especialidad" className={labelClass}>
              Especialidad
            </label>
            <select
              id="filtro_especialidad"
              value={filtroEspecialidad}
              onChange={(event) => setFiltroEspecialidad(event.target.value)}
              className={inputClass}
            >
              <option value="">Todas las especialidades</option>
              {especialidades.map((especialidad) => (
                <option key={especialidad} value={especialidad}>
                  {especialidad}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <Stethoscope className="h-5 w-5 text-emerald-400" aria-hidden="true" />
            <h2 className="text-base font-semibold text-slate-100">
              Veterinarios activos
            </h2>
          </div>
          {!cargando && !error && (
            <span className="text-xs text-slate-500">
              {veterinariosFiltrados.length} de {veterinarios.length}
            </span>
          )}
        </div>

        {cargando ? (
          <p className="px-6 py-12 text-center text-sm text-slate-400">
            Cargando veterinarios...
          </p>
        ) : error ? (
          <p className="px-6 py-12 text-center text-sm text-slate-400">
            No se pudo mostrar el listado.
          </p>
        ) : veterinariosFiltrados.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <UserRound
              className="mx-auto h-8 w-8 text-slate-600"
              aria-hidden="true"
            />
            <p className="mt-3 text-sm font-medium text-slate-300">
              {veterinarios.length === 0
                ? 'No hay veterinarios activos registrados.'
                : 'No se encontraron veterinarios con esos filtros.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-800/80 text-xs uppercase tracking-wider text-slate-500">
                  <th scope="col" className="px-5 py-3 font-medium">
                    Profesional
                  </th>
                  <th scope="col" className="px-5 py-3 font-medium">
                    Especialidad
                  </th>
                  <th scope="col" className="px-5 py-3 text-right font-medium">
                    Acción
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {veterinariosFiltrados.map((veterinario) => {
                  const especialidad = veterinario.especialidad?.trim()
                  return (
                    <tr
                      key={veterinario.id}
                      className="transition-colors hover:bg-slate-900/50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-200">
                          {nombreCompleto(veterinario)}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        {especialidad ? (
                          <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                            {especialidad}
                          </span>
                        ) : (
                          <span className="text-slate-500">Sin especialidad</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => agendarConVeterinario(veterinario)}
                          aria-label={`Agendar cita con ${nombreCompleto(veterinario)}`}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500"
                        >
                          <CalendarPlus className="h-3.5 w-3.5" aria-hidden="true" />
                          Agendar cita
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
