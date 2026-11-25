import { useEffect, useState } from 'react'
import { PawPrint, Save, X } from 'lucide-react'
import { apiRequest } from '../lib/api.js'

export default function MascotasForm({ onCancel, onSuccess }) {
  const [formData, setFormData] = useState({
    nombre: '',
    especie_id: '',
    raza: '',
    sexo: '',
    fecha_nacimiento: '',
    peso_actual: '',
    castrado: '',
    propietario_id: '',
    observaciones: '',
  })
  const [propietarios, setPropietarios] = useState([])
  const [especies, setEspecies] = useState([])
  const [loadingReferences, setLoadingReferences] = useState(true)
  const [referenceError, setReferenceError] = useState('')
  const [validationError, setValidationError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      apiRequest('/propietarios/?limit=100', { signal: controller.signal }),
      apiRequest('/especies/?limit=100', { signal: controller.signal }),
    ])
      .then(([propietariosResponse, especiesResponse]) => {
        setPropietarios(propietariosResponse)
        setEspecies(especiesResponse)
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

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    setValidationError('')
    setSuccessMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.nombre.trim()) {
      setValidationError('Ingrese el nombre de la mascota.')
      return
    }

    const propietarioId = Number(formData.propietario_id)
    if (!Number.isSafeInteger(propietarioId) || propietarioId <= 0) {
      setValidationError('Seleccione un propietario válido.')
      return
    }

    const especieId = Number(formData.especie_id)
    if (!Number.isSafeInteger(especieId) || especieId <= 0) {
      setValidationError('Seleccione una especie válida.')
      return
    }

    let pesoActual = null
    if (formData.peso_actual !== '') {
      pesoActual = Number(formData.peso_actual)
      if (
        !Number.isFinite(pesoActual) ||
        pesoActual < 0 ||
        pesoActual > 999.99
      ) {
        setValidationError(
          'El peso actual debe ser un número entre 0 y 999,99 kg.'
        )
        return
      }
    }

    const payload = {
      nombre: formData.nombre.trim(),
      propietario_id: propietarioId,
      especie_id: especieId,
      raza: formData.raza.trim() || null,
      sexo: formData.sexo || null,
      fecha_nacimiento: formData.fecha_nacimiento || null,
      peso_actual: pesoActual,
      castrado: formData.castrado === 'true',
      observaciones: formData.observaciones.trim() || null
    }

    setIsSubmitting(true)
    setValidationError('')
    setSuccessMessage('')
    try {
      const mascota = await apiRequest('/mascotas/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setSuccessMessage('Mascota registrada correctamente.')
      setFormData({
        nombre: '',
        especie_id: '',
        raza: '',
        sexo: '',
        fecha_nacimiento: '',
        peso_actual: '',
        castrado: 'false',
        propietario_id: '',
        observaciones: '',
      })
      onSuccess?.(mascota)
    } catch (error) {
      setValidationError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Clases reutilizables para mantener consistencia en inputs y selects
  const inputClass =
    'w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'

  const labelClass =
    'mb-1.5 block text-xs font-medium text-slate-300'

  return (
    <div className="mx-auto max-w-4xl">
      {/* Tarjeta principal del formulario */}
      <div className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl sm:p-8">
        
        {/* Título principal */}
        <div className="mb-8 flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-600/15 text-emerald-400 border border-emerald-500/20">
            <PawPrint className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Registrar nueva mascota
            </h1>
            <p className="text-xs text-slate-400">
              Complete la ficha clínica inicial del paciente
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {validationError && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm text-red-300"
            >
              {validationError}
            </p>
          )}
          {referenceError && (
            <p
              role="alert"
              className="rounded-lg border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-sm text-red-300"
            >
              No se pudieron cargar propietarios y especies: {referenceError}
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
          
          {/* SECCIÓN 1: DATOS DE LA MASCOTA */}
          <div>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Datos de la mascota
            </h2>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Nombre */}
              <div>
                <label htmlFor="nombre" className={labelClass}>
                  Nombre *
                </label>
                <input
                  id="nombre"
                  name="nombre"
                  type="text"
                  required
                  maxLength={100}
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Ej. Toby"
                  className={inputClass}
                />
              </div>

              {/* Especie */}
              <div>
                <label htmlFor="especie" className={labelClass}>
                  Especie *
                </label>
                <select
                  id="especie"
                  name="especie_id"
                  required
                  value={formData.especie_id}
                  onChange={handleChange}
                  disabled={loadingReferences || especies.length === 0}
                  className={inputClass}
                >
                  <option value="" disabled>
                    {loadingReferences
                      ? 'Cargando especies...'
                      : 'Seleccionar especie...'}
                  </option>
                  {especies.map((especie) => (
                    <option key={especie.id} value={especie.id}>
                      {especie.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {/* Raza */}
              <div>
                <label htmlFor="raza" className={labelClass}>
                  Raza
                </label>
                <input
                  id="raza"
                  name="raza"
                  type="text"
                  maxLength={100}
                  value={formData.raza}
                  onChange={handleChange}
                  placeholder="Ej. Mestizo, Labrador, Siamés..."
                  className={inputClass}
                />
              </div>

              {/* Sexo */}
              <div>
                <label htmlFor="sexo" className={labelClass}>
                  Sexo *
                </label>
                <select
                  id="sexo"
                  name="sexo"
                  required
                  value={formData.sexo}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="" disabled>
                    Seleccionar sexo...
                  </option>
                  <option value="M">Macho</option>
                  <option value="H">Hembra</option>
                </select>
              </div>

              {/* Fecha de nacimiento */}
              <div>
                <label htmlFor="fecha_nacimiento" className={labelClass}>
                  Fecha de nacimiento
                </label>
                <input
                  id="fecha_nacimiento"
                  name="fecha_nacimiento"
                  type="date"
                  value={formData.fecha_nacimiento}
                  onChange={handleChange}
                  className={`${inputClass} [scheme-dark]`}
                />
              </div>

              {/* Peso actual */}
              <div>
                <label htmlFor="peso_actual" className={labelClass}>
                  Peso actual (kg)
                </label>
                <input
                  id="peso_actual"
                  name="peso_actual"
                  type="number"
                  step="0.01"
                  min="0"
                  max="999.99"
                  value={formData.peso_actual}
                  onChange={handleChange}
                  placeholder="Ej. 12.50"
                  className={inputClass}
                />
              </div>

              {/* Castrado */}
              <div>
                <label htmlFor="castrado" className={labelClass}>
                  Castrado
                </label>
                <select
                  id="castrado"
                  name="castrado"
                  value={formData.castrado}
                  onChange={handleChange}
                  className={inputClass}
                >
                  <option value="true">Sí</option>
                  <option value="false">No</option>
                </select>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: PROPIETARIO */}
          <div>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Propietario
            </h2>

            <div>
              <label htmlFor="propietario_id" className={labelClass}>
                Seleccionar propietario *
              </label>
              <select
                id="propietario_id"
                name="propietario_id"
                required
                value={formData.propietario_id}
                onChange={(e) => {
                  e.currentTarget.setCustomValidity('')
                  handleChange(e)
                }}
                onInvalid={(e) =>
                  e.currentTarget.setCustomValidity(
                    'Seleccione un propietario para continuar.'
                  )
                }
                disabled={loadingReferences || propietarios.length === 0}
                className={inputClass}
              >
                <option value="" disabled>
                  {loadingReferences
                    ? 'Cargando propietarios...'
                    : 'Seleccionar propietario registrado...'}
                </option>
                {propietarios.map((prop) => (
                  <option key={prop.id} value={prop.id}>
                    {[prop.nombre, prop.apellido].filter(Boolean).join(' ')}
                    {prop.email ? ` (${prop.email})` : ''}
                  </option>
                ))}
              </select>
              {!loadingReferences && propietarios.length === 0 && (
                <p className="mt-1.5 text-xs text-slate-400">
                  No hay propietarios activos. Registre uno antes de continuar.
                </p>
              )}
              {!loadingReferences && especies.length === 0 && (
                <p className="mt-1.5 text-xs text-slate-400">
                  No hay especies registradas disponibles.
                </p>
              )}
            </div>
          </div>

          {/* SECCIÓN 3: INFORMACIÓN ADICIONAL */}
          <div>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Información adicional
            </h2>

            <div>
              <label htmlFor="observaciones" className={labelClass}>
                Observaciones
              </label>
              <textarea
                id="observaciones"
                name="observaciones"
                rows={4}
                value={formData.observaciones}
                onChange={handleChange}
                placeholder="Alergias conocidas, comportamiento, señas particulares, alimentación..."
                className={`${inputClass} resize-none`}
              />
            </div>
          </div>

          {/* Botones de acción */}
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
                isSubmitting ||
                loadingReferences ||
                Boolean(referenceError) ||
                propietarios.length === 0 ||
                especies.length === 0
              }
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-950 transition-all hover:bg-emerald-500 active:scale-[0.98]"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar Mascota'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}