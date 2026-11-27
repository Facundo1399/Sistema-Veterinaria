import { useEffect, useState } from 'react'
import { ClipboardList, Save, Scale, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { apiRequest } from '../lib/api.js'

const LIMITE_PAGINA = 100
const inputClass =
  'w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
const labelClass = 'mb-1.5 block text-xs font-medium text-slate-300'

async function cargarTodos(path, signal) {
  const resultados = []

  for (let skip = 0; ; skip += LIMITE_PAGINA) {
    const parametros = new URLSearchParams({
      skip: String(skip),
      limit: String(LIMITE_PAGINA),
    })
    const pagina = await apiRequest(`${path}?${parametros}`, { signal })
    resultados.push(...pagina)

    if (pagina.length < LIMITE_PAGINA) return resultados
  }
}

export default function ConsultasForm({ onCancel, onSuccess }) {
  const { user } = useAuth()
  const esAdmin = user?.rol === 'admin'
  const esVeterinario = user?.rol === 'veterinario'
  const puedeRegistrarConsulta = esAdmin || esVeterinario
  const [mascotas, setMascotas] = useState([])
  const [propietarios, setPropietarios] = useState([])
  const [cargandoMascotas, setCargandoMascotas] = useState(true)
  const [errorMascotas, setErrorMascotas] = useState('')
  const [formData, setFormData] = useState({
    mascota_id: '',
    peso: '',
    motivo: '',
    examen_fisico: '',
    diagnostico: '',
    tratamiento: '',
    observaciones: '',
  })
  const [error, setError] = useState('')
  const [mensaje, setMensaje] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [recargarMascotas, setRecargarMascotas] = useState(0)

  useEffect(() => {
    if (!puedeRegistrarConsulta) return undefined

    const controller = new AbortController()

    Promise.all([
      cargarTodos('/mascotas/', controller.signal),
      cargarTodos('/propietarios/', controller.signal),
    ])
      .then(([mascotasResponse, propietariosResponse]) => {
        setMascotas(mascotasResponse)
        setPropietarios(propietariosResponse)
      })
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setErrorMascotas(requestError.message)
          setMascotas([])
          setPropietarios([])
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setCargandoMascotas(false)
      })

    return () => controller.abort()
  }, [puedeRegistrarConsulta, recargarMascotas])

  const mascotaSeleccionada = mascotas.find(
    (mascota) => String(mascota.id) === formData.mascota_id
  )
  const propietariosPorId = new Map(
    propietarios.map((propietario) => [propietario.id, propietario])
  )

  const handleChange = (event) => {
    const { name, value } = event.target
    setFormData((actual) => ({ ...actual, [name]: value }))
    setError('')
    setMensaje('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!puedeRegistrarConsulta || guardando) return

    const mascotaId = Number(formData.mascota_id)
    if (!Number.isSafeInteger(mascotaId) || mascotaId <= 0) {
      setError('Seleccione una mascota activa.')
      return
    }

    const motivo = formData.motivo.trim()
    const examenFisico = formData.examen_fisico.trim()
    const diagnostico = formData.diagnostico.trim()
    const tratamiento = formData.tratamiento.trim()
    if (!motivo || !examenFisico || !diagnostico || !tratamiento) {
      setError('Complete el motivo, examen físico, diagnóstico y tratamiento.')
      return
    }

    const peso = Number(formData.peso)
    if (
      formData.peso === '' ||
      !Number.isFinite(peso) ||
      peso < 0 ||
      peso > 999.99 ||
      Math.abs(peso * 100 - Math.round(peso * 100)) > 1e-8
    ) {
      setError('Ingrese el peso en kg, con hasta dos decimales (0 a 999,99).')
      return
    }

    const payload = {
      mascota_id: mascotaId,
      anamnesis: motivo,
      examen_fisico: examenFisico,
      diagnostico,
      tratamiento,
      peso,
      observaciones: formData.observaciones.trim() || null,
    }

    setGuardando(true)
    setError('')
    setMensaje('')
    try {
      const consulta = await apiRequest('/consultas/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setMensaje('La consulta se registró correctamente.')
      setFormData({
        mascota_id: '',
        peso: '',
        motivo: '',
        examen_fisico: '',
        diagnostico: '',
        tratamiento: '',
        observaciones: '',
      })
      onSuccess?.(consulta)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setGuardando(false)
    }
  }

  if (!puedeRegistrarConsulta) {
    return (
      <section
        role="alert"
        className="mx-auto max-w-4xl rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-200"
      >
        No tienes permiso para registrar consultas clínicas.
      </section>
    )
  }

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl sm:p-8">
        <header className="mb-8 flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-600/15 text-emerald-400">
            <ClipboardList className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Registrar consulta médica
            </h1>
            <p className="text-xs text-slate-400">
              Registre la evaluación clínica, el peso, el diagnóstico y el tratamiento.
            </p>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          )}
          {errorMascotas && (
            <div
              role="alert"
              className="flex flex-col gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm text-red-300 sm:flex-row sm:items-center sm:justify-between"
            >
              <p>
                No se pudieron cargar mascotas y propietarios: {errorMascotas}
              </p>
              <button
                type="button"
                onClick={() => {
                  setCargandoMascotas(true)
                  setErrorMascotas('')
                  setRecargarMascotas((actual) => actual + 1)
                }}
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

          <section>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Paciente y parámetros
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="consulta_mascota_id" className={labelClass}>
                  Mascota (paciente) *
                </label>
                <select
                  id="consulta_mascota_id"
                  name="mascota_id"
                  required
                  value={formData.mascota_id}
                  onChange={handleChange}
                  disabled={cargandoMascotas || Boolean(errorMascotas)}
                  className={inputClass}
                >
                  <option value="">
                    {cargandoMascotas
                      ? 'Cargando mascotas...'
                      : 'Seleccionar mascota...'}
                  </option>
                  {mascotas.map((mascota) => (
                    <option key={mascota.id} value={mascota.id}>
                      {[
                        mascota.nombre,
                        [
                          propietariosPorId.get(mascota.propietario_id)?.nombre,
                          propietariosPorId.get(mascota.propietario_id)?.apellido,
                        ]
                          .filter(Boolean)
                          .join(' ') ||
                          `Propietario #${mascota.propietario_id}`,
                        mascota.raza,
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </option>
                  ))}
                </select>
                {mascotaSeleccionada && (
                  <p className="mt-1.5 text-xs text-slate-400">
                    Último peso conocido:{' '}
                    {mascotaSeleccionada.peso_actual != null
                      ? `${mascotaSeleccionada.peso_actual} kg`
                      : 'No registrado'}
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="consulta_peso" className={labelClass}>
                  <span className="inline-flex items-center gap-1.5">
                    <Scale className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                    Peso de la consulta (kg) *
                  </span>
                </label>
                <input
                  id="consulta_peso"
                  name="peso"
                  type="number"
                  step="0.01"
                  min="0"
                  max="999.99"
                  required
                  value={formData.peso}
                  onChange={handleChange}
                  placeholder="Ej. 14.25"
                  className={inputClass}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Anamnesis y examen clínico
            </h2>
            <div className="space-y-5">
              <div>
                <label htmlFor="consulta_motivo" className={labelClass}>
                  Motivo de la consulta *
                </label>
                <textarea
                  id="consulta_motivo"
                  name="motivo"
                  rows={3}
                  required
                  maxLength={10000}
                  value={formData.motivo}
                  onChange={handleChange}
                  placeholder="Describa el motivo de atención y antecedentes relevantes."
                  className={`${inputClass} resize-y`}
                />
              </div>
              <div>
                <label htmlFor="consulta_examen" className={labelClass}>
                  Síntomas y examen físico *
                </label>
                <textarea
                  id="consulta_examen"
                  name="examen_fisico"
                  rows={4}
                  required
                  maxLength={10000}
                  value={formData.examen_fisico}
                  onChange={handleChange}
                  placeholder="Registre síntomas, hallazgos físicos y signos observados."
                  className={`${inputClass} resize-y`}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Diagnóstico y tratamiento
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="consulta_diagnostico" className={labelClass}>
                  Diagnóstico *
                </label>
                <textarea
                  id="consulta_diagnostico"
                  name="diagnostico"
                  rows={4}
                  required
                  maxLength={10000}
                  value={formData.diagnostico}
                  onChange={handleChange}
                  placeholder="Diagnóstico presuntivo o definitivo."
                  className={`${inputClass} resize-y`}
                />
              </div>
              <div>
                <label htmlFor="consulta_tratamiento" className={labelClass}>
                  Tratamiento e indicaciones *
                </label>
                <textarea
                  id="consulta_tratamiento"
                  name="tratamiento"
                  rows={4}
                  required
                  maxLength={10000}
                  value={formData.tratamiento}
                  onChange={handleChange}
                  placeholder="Medicación, dosis, frecuencia e indicaciones."
                  className={`${inputClass} resize-y`}
                />
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Observaciones
            </h2>
            <div>
              <label htmlFor="consulta_observaciones" className={labelClass}>
                Notas adicionales y próximo control
              </label>
              <textarea
                id="consulta_observaciones"
                name="observaciones"
                rows={3}
                maxLength={10000}
                value={formData.observaciones}
                onChange={handleChange}
                placeholder="Estudios complementarios, cuidados o fecha estimada de revisión."
                className={`${inputClass} resize-y`}
              />
            </div>
          </section>

          <footer className="flex items-center justify-end gap-3 border-t border-slate-800 pt-5">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <X className="h-4 w-4" aria-hidden="true" />
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={
                guardando ||
                cargandoMascotas ||
                Boolean(errorMascotas) ||
                mascotas.length === 0
              }
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-950 transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              {guardando ? 'Guardando...' : 'Guardar consulta'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
