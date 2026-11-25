import { useEffect, useState } from 'react'
import { CalendarPlus, Search, Save, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiRequest } from '../lib/api.js'

const ZONA_CLINICA = 'America/Argentina/Buenos_Aires'
const TIPOS_CITA = [
  { value: 'consulta', label: 'Consulta' },
  { value: 'vacunacion', label: 'Vacunación' },
  { value: 'control', label: 'Control' },
  { value: 'cirugia', label: 'Cirugía' },
]

function obtenerFechaClinica() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_CLINICA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const valores = Object.fromEntries(partes.map(({ type, value }) => [type, value]))

  return `${valores.year}-${valores.month}-${valores.day}`
}

function nombreCompleto(persona) {
  return [persona?.nombre, persona?.apellido].filter(Boolean).join(' ')
}

export default function CitasForm({ onCancel, onSuccess }) {
  const { user } = useAuth()
  const esAdmin = user?.rol === 'admin'
  const esVeterinario = user?.rol === 'veterinario'
  const esRecepcion = user?.rol === 'recepcion'
  const puedeCrearCita = esAdmin || esVeterinario || esRecepcion
  const [fechaHoy] = useState(obtenerFechaClinica)
  const [formData, setFormData] = useState({
    mascota_id: '',
    veterinario_id: '',
    fecha: fechaHoy,
    hora: '',
    tipo: 'consulta',
    motivo: '',
  })
  const [mascotaBusqueda, setMascotaBusqueda] = useState('')
  const [mascotaSeleccionada, setMascotaSeleccionada] = useState(null)
  const [mascotasSugeridas, setMascotasSugeridas] = useState([])
  const [buscandoMascotas, setBuscandoMascotas] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState('')
  const [mostrarSugerencias, setMostrarSugerencias] = useState(false)
  const [sugerenciaActiva, setSugerenciaActiva] = useState(-1)
  const [propietarios, setPropietarios] = useState([])
  const [especies, setEspecies] = useState([])
  const [veterinarios, setVeterinarios] = useState([])
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [referenceError, setReferenceError] = useState('')
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      apiRequest('/propietarios/?limit=100', { signal: controller.signal }),
      apiRequest('/especies/?limit=100', { signal: controller.signal }),
      apiRequest('/veterinarios/?limit=100', { signal: controller.signal }),
    ])
      .then(([propietariosResponse, especiesResponse, veterinariosResponse]) => {
        setPropietarios(propietariosResponse)
        setEspecies(especiesResponse)
        setVeterinarios(veterinariosResponse)
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setReferenceError(error.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingReferences(false)
        }
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    const consulta = mascotaBusqueda.trim()

    if (consulta.length < 3 || consulta === mascotaSeleccionada?.nombre) {
      return undefined
    }

    const controller = new AbortController()
    const parametros = new URLSearchParams({
      buscar: consulta,
      limit: '100',
    })
    const timeoutId = setTimeout(() => {
      setBuscandoMascotas(true)
      setMascotasSugeridas([])
      setErrorBusqueda('')

      apiRequest(`/mascotas/?${parametros}`, { signal: controller.signal })
        .then((mascotas) => {
          setMascotasSugeridas(mascotas)
          setSugerenciaActiva(-1)
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setErrorBusqueda(error.message)
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setBuscandoMascotas(false)
          }
        })
    }, 250)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [mascotaBusqueda, mascotaSeleccionada])

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }))
    setFormError('')
    setSuccessMessage('')
  }

  const handleMascotaBusqueda = (event) => {
    const value = event.target.value
    setMascotaBusqueda(value)
    setMascotaSeleccionada(null)
    setMascotasSugeridas([])
    setBuscandoMascotas(value.trim().length >= 3)
    setSugerenciaActiva(-1)
    setErrorBusqueda('')
    setFormData((previous) => ({ ...previous, mascota_id: '' }))
    setFormError('')
    setSuccessMessage('')
    setMostrarSugerencias(true)
  }

  const seleccionarMascota = (mascota) => {
    setMascotaSeleccionada(mascota)
    setMascotaBusqueda(mascota.nombre)
    setMascotasSugeridas([])
    setBuscandoMascotas(false)
    setSugerenciaActiva(-1)
    setMostrarSugerencias(false)
    setFormData((previous) => ({
      ...previous,
      mascota_id: String(mascota.id),
    }))
    setFormError('')
  }

  const handleMascotaKeyDown = (event) => {
    if (event.key === 'Escape') {
      setMostrarSugerencias(false)
      return
    }

    if (!mascotasSugeridas.length) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSugerenciaActiva((current) =>
        Math.min(current + 1, mascotasSugeridas.length - 1)
      )
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSugerenciaActiva((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Enter' && sugerenciaActiva >= 0) {
      event.preventDefault()
      seleccionarMascota(mascotasSugeridas[sugerenciaActiva])
    }
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (!puedeCrearCita) {
      setFormError('Tu rol no tiene permiso para agendar citas.')
      return
    }

    if (!tiposDisponibles.some((tipo) => tipo.value === formData.tipo)) {
      setFormError('Tu rol no puede agendar este tipo de cita.')
      return
    }

    const mascotaId = Number(formData.mascota_id)
    if (
      !mascotaSeleccionada ||
      !Number.isSafeInteger(mascotaId) ||
      mascotaId <= 0
    ) {
      setFormError('Busque y seleccione una mascota de la lista.')
      return
    }

    const veterinarioId = formData.veterinario_id
      ? Number(formData.veterinario_id)
      : null
    if (
      veterinarioId !== null &&
      (!Number.isSafeInteger(veterinarioId) || veterinarioId <= 0)
    ) {
      setFormError('Seleccione un veterinario válido.')
      return
    }

    const payload = {
      mascota_id: mascotaId,
      veterinario_id: veterinarioId,
      tipo: formData.tipo,
      fecha_hora: `${formData.fecha}T${formData.hora}:00`,
      duracion_min: 30,
      motivo: formData.motivo.trim() || null,
    }

    setIsSubmitting(true)
    setFormError('')
    setSuccessMessage('')
    try {
      const cita = await apiRequest('/citas/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setSuccessMessage(
        `Cita agendada correctamente. Estado inicial: ${cita.estado}.`
      )
      setFormData((previous) => ({
        ...previous,
        mascota_id: '',
        veterinario_id: '',
        hora: '',
        tipo: 'consulta',
        motivo: '',
      }))
      setMascotaBusqueda('')
      setMascotaSeleccionada(null)
      onSuccess?.(cita)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
  const labelClass = 'mb-1.5 block text-xs font-medium text-slate-300'
  const propietariosPorId = new Map(
    propietarios.map((propietario) => [propietario.id, propietario])
  )
  const especiesPorId = new Map(
    especies.map((especie) => [especie.id, especie])
  )
  const tiposDisponibles = esRecepcion
    ? TIPOS_CITA.filter((tipo) => tipo.value === 'consulta')
    : esAdmin || esVeterinario
      ? TIPOS_CITA
      : []
  const detalleMascota = mascotaSeleccionada
    ? [
        especiesPorId.get(mascotaSeleccionada.especie_id)?.nombre,
        mascotaSeleccionada.raza,
        nombreCompleto(
          propietariosPorId.get(mascotaSeleccionada.propietario_id)
        ),
      ]
        .filter(Boolean)
        .join(' · ')
    : ''

  return (
    <div className="mx-auto max-w-4xl">
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl sm:p-8">
        <div className="mb-8 flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-600/15 text-emerald-400">
            <CalendarPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Agendar nueva cita
            </h1>
            <p className="text-xs text-slate-400">
              Seleccione el paciente y complete los datos del turno
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {formError && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm text-red-300"
            >
              {formError}
            </p>
          )}
          {referenceError && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm text-red-300"
            >
              No se pudieron cargar propietarios, especies y veterinarios:{' '}
              {referenceError}
            </p>
          )}
          {successMessage && (
            <p
              role="status"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-sm text-emerald-300"
            >
              {successMessage}
            </p>
          )}

          <section>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Paciente y profesional
            </h2>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="mascota_busqueda" className={labelClass}>
                  Seleccionar mascota (paciente) *
                </label>
                <div
                  className="relative"
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setMostrarSugerencias(false)
                    }
                  }}
                >
                  <div className="relative">
                    <Search
                      className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                    <input
                      id="mascota_busqueda"
                      type="search"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-expanded={
                        mostrarSugerencias && mascotaBusqueda.trim().length >= 3
                      }
                      aria-controls="mascotas-sugeridas"
                      aria-activedescendant={
                        sugerenciaActiva >= 0
                          ? `mascota-sugerida-${mascotasSugeridas[sugerenciaActiva]?.id}`
                          : undefined
                      }
                      autoComplete="off"
                      maxLength={50}
                      value={mascotaBusqueda}
                      onChange={handleMascotaBusqueda}
                      onFocus={() => {
                        if (!mascotaSeleccionada) {
                          setMostrarSugerencias(true)
                        }
                      }}
                      onKeyDown={handleMascotaKeyDown}
                      placeholder="Escriba al menos 3 letras del nombre..."
                      className={`${inputClass} pl-10`}
                    />
                  </div>

                  {mostrarSugerencias && mascotaBusqueda.trim().length >= 3 && (
                    <ul
                      id="mascotas-sugeridas"
                      role="listbox"
                      className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 p-1 shadow-xl"
                    >
                      {buscandoMascotas ? (
                        <li className="px-3 py-2 text-sm text-slate-400" role="status">
                          Buscando mascotas...
                        </li>
                      ) : errorBusqueda ? (
                        <li className="px-3 py-2 text-sm text-red-300" role="alert">
                          No se pudieron buscar mascotas: {errorBusqueda}
                        </li>
                      ) : mascotasSugeridas.length > 0 ? (
                        mascotasSugeridas.map((mascota, index) => {
                          const especie = especiesPorId.get(mascota.especie_id)
                          const propietario = propietariosPorId.get(
                            mascota.propietario_id
                          )
                          const detalle = [
                            especie?.nombre,
                            mascota.raza,
                            nombreCompleto(propietario),
                          ]
                            .filter(Boolean)
                            .join(' · ')

                          return (
                            <li key={mascota.id} role="presentation">
                              <button
                                id={`mascota-sugerida-${mascota.id}`}
                                type="button"
                                role="option"
                                aria-selected={sugerenciaActiva === index}
                                onClick={() => seleccionarMascota(mascota)}
                                className={`w-full rounded-md px-3 py-2 text-left transition-colors ${
                                  sugerenciaActiva === index
                                    ? 'bg-emerald-600/20'
                                    : 'hover:bg-slate-800'
                                }`}
                              >
                                <span className="block text-sm font-medium text-slate-100">
                                  {mascota.nombre}
                                </span>
                                {detalle && (
                                  <span className="mt-0.5 block text-xs text-slate-400">
                                    {detalle}
                                  </span>
                                )}
                              </button>
                            </li>
                          )
                        })
                      ) : (
                        <li className="px-3 py-2 text-sm text-slate-400" role="status">
                          No se encontraron mascotas activas con ese nombre.
                        </li>
                      )}
                    </ul>
                  )}
                </div>
                {mascotaBusqueda.trim().length > 0 &&
                  mascotaBusqueda.trim().length < 3 && (
                    <p className="mt-1.5 text-xs text-slate-500">
                      Ingrese {3 - mascotaBusqueda.trim().length} letra
                      {3 - mascotaBusqueda.trim().length === 1 ? '' : 's'} más
                      para buscar.
                    </p>
                  )}
                {mascotaSeleccionada && (
                  <p className="mt-1.5 text-xs text-emerald-300">
                    Paciente seleccionado
                    {detalleMascota ? ` · ${detalleMascota}` : ''}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="veterinario_id" className={labelClass}>
                  Veterinario asignado
                </label>
                <select
                  id="veterinario_id"
                  name="veterinario_id"
                  value={formData.veterinario_id}
                  onChange={handleChange}
                  disabled={loadingReferences || Boolean(referenceError)}
                  className={inputClass}
                >
                  <option value="">
                    {loadingReferences
                      ? 'Cargando veterinarios...'
                      : 'Sin asignar'}
                  </option>
                  {veterinarios.map((veterinario) => (
                    <option key={veterinario.id} value={veterinario.id}>
                      {nombreCompleto(veterinario)}
                      {veterinario.especialidad
                        ? ` · ${veterinario.especialidad}`
                        : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Fecha y programación
            </h2>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="fecha" className={labelClass}>
                  Fecha de la cita *
                </label>
                <input
                  id="fecha"
                  name="fecha"
                  type="date"
                  required
                  min={fechaHoy}
                  value={formData.fecha}
                  onChange={handleChange}
                  className={`${inputClass} [color-scheme:dark]`}
                />
              </div>

              <div>
                <label htmlFor="hora" className={labelClass}>
                  Hora del turno *
                </label>
                <input
                  id="hora"
                  name="hora"
                  type="time"
                  required
                  value={formData.hora}
                  onChange={handleChange}
                  className={`${inputClass} [color-scheme:dark]`}
                />
              </div>

              <div>
                <label htmlFor="tipo" className={labelClass}>
                  Tipo de atención *
                </label>
                <select
                  id="tipo"
                  name="tipo"
                  required
                  value={formData.tipo}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {tiposDisponibles.map((tipo) => (
                    <option key={tipo.value} value={tipo.value}>
                      {tipo.label}
                    </option>
                  ))}
                </select>
                {esRecepcion && (
                  <p className="mt-1.5 text-xs text-slate-500">
                    Recepción puede agendar citas de consulta.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="motivo" className={labelClass}>
                  Motivo de la cita
                </label>
                <textarea
                  id="motivo"
                  name="motivo"
                  rows={3}
                  value={formData.motivo}
                  onChange={handleChange}
                  placeholder="Ej. Control anual, vacunación..."
                  className={`${inputClass} resize-none`}
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              La duración inicial es de 30 minutos y el estado se asigna según
              el rol del usuario.
            </p>
          </section>

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-5">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" />
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={
                !puedeCrearCita ||
                isSubmitting ||
                loadingReferences ||
                Boolean(referenceError) ||
                !mascotaSeleccionada
              }
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-950 transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Agendando...' : 'Agendar cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
