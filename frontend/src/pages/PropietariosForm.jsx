import { useState } from 'react'
import { UserPlus, Save, X } from 'lucide-react'
import { apiRequest } from '../lib/api.js'

export default function PropietariosForm({ onCancel, onSuccess }) {
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
  })
  const [formError, setFormError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
    setFormError('')
    setSuccessMessage('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.nombre.trim() || !formData.email.trim()) {
      setFormError('Complete nombre y correo electrónico.')
      return
    }

    const payload = {
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim() || null,
      telefono: formData.telefono.trim() || null,
      email: formData.email.trim(),
      activo: true,
    }

    setIsSubmitting(true)
    setFormError('')
    setSuccessMessage('')
    try {
      const propietario = await apiRequest('/propietarios/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setSuccessMessage('Propietario registrado correctamente.')
      setFormData({
        nombre: '',
        apellido: '',
        telefono: '',
        email: '',
      })
      onSuccess?.(propietario)
    } catch (error) {
      setFormError(error.message)
    } finally {
      setIsSubmitting(false)
    }
  }

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
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-600/15 text-emerald-400">
            <UserPlus className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Registrar nuevo propietario
            </h1>
            <p className="text-xs text-slate-400">
              Complete los datos de contacto del titular de la mascota
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
          {successMessage && (
            <p
              role="status"
              className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-sm text-emerald-300"
            >
              {successMessage}
            </p>
          )}
          
          {/* SECCIÓN: DATOS PERSONALES Y CONTACTO */}
          <div>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Datos del propietario
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
                  placeholder="Ej. Carlos"
                  className={inputClass}
                />
              </div>

              {/* Apellido */}
              <div>
                <label htmlFor="apellido" className={labelClass}>
                  Apellido
                </label>
                <input
                  id="apellido"
                  name="apellido"
                  type="text"
                  maxLength={100}
                  value={formData.apellido}
                  onChange={handleChange}
                  placeholder="Ej. Gómez"
                  className={inputClass}
                />
              </div>

              {/* Teléfono */}
              <div>
                <label htmlFor="telefono" className={labelClass}>
                  Teléfono
                </label>
                <input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  maxLength={30}
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="Ej. 381 555-1234"
                  className={inputClass}
                />
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className={labelClass}>
                  Correo electrónico *
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  maxLength={150}
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="ejemplo@correo.com"
                  className={inputClass}
                />
                <p className="mt-1.5 text-xs text-slate-400">
                  El backend requiere una dirección de correo electrónico.
                </p>
              </div>
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
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-950 transition-all hover:bg-emerald-500 active:scale-[0.98]"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Guardando...' : 'Guardar Propietario'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}