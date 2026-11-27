import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Eye,
  EyeOff,
  Save,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react'
import { apiRequest } from '../../lib/api.js'

const ROLES = [
  { value: 'admin', label: 'Administrador' },
  { value: 'veterinario', label: 'Veterinario' },
  { value: 'recepcion', label: 'Recepción' },
]

export default function NuevosUsuarios({ onCancel }) {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    telefono: '',
    email: '',
    especialidad: '',
    rol: 'veterinario',
    password: '',
    confirmPassword: '',
    activo: true,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target
    setFormData((previous) => ({
      ...previous,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'rol' && value !== 'veterinario'
        ? { especialidad: '' }
        : {}),
    }))
    setError('')
    setSuccessMessage('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    if (formData.password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }

    if (new TextEncoder().encode(formData.password).length > 72) {
      setError('La contraseña no puede superar los 72 bytes en UTF-8.')
      return
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Las contraseñas no coinciden.')
      return
    }

    const payload = {
      nombre: formData.nombre.trim(),
      apellido: formData.apellido.trim() || null,
      telefono: formData.telefono.trim() || null,
      email: formData.email.trim().toLowerCase(),
      especialidad:
        formData.rol === 'veterinario'
          ? formData.especialidad.trim() || null
          : null,
      rol: formData.rol,
      password: formData.password,
      activo: formData.activo,
    }

    setIsSubmitting(true)
    setError('')
    setSuccessMessage('')
    try {
      const usuario = await apiRequest('/usuarios/', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setSuccessMessage(
        `Se creó la cuenta de ${[usuario.nombre, usuario.apellido]
          .filter(Boolean)
          .join(' ')} correctamente.`
      )
      setFormData({
        nombre: '',
        apellido: '',
        telefono: '',
        email: '',
        especialidad: '',
        rol: 'veterinario',
        password: '',
        confirmPassword: '',
        activo: true,
      })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-lg border border-slate-800 bg-slate-900 px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500'
  const labelClass = 'mb-1.5 block text-xs font-medium text-slate-300'

  return (
    <div className="mx-auto max-w-4xl">
      <section className="rounded-xl border border-slate-800 bg-slate-950 p-6 shadow-xl sm:p-8">
        <header className="mb-8 flex items-center gap-3 border-b border-slate-800 pb-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-600/15 text-emerald-400">
            <UserPlus className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              Registrar nuevo usuario
            </h1>
            <p className="text-xs text-slate-400">
              Cree una cuenta y asigne su rol en el sistema
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
              Datos del usuario
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
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
                  autoComplete="given-name"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Ej. Sofía"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="apellido" className={labelClass}>
                  Apellido
                </label>
                <input
                  id="apellido"
                  name="apellido"
                  type="text"
                  maxLength={100}
                  autoComplete="family-name"
                  value={formData.apellido}
                  onChange={handleChange}
                  placeholder="Ej. Méndez"
                  className={inputClass}
                />
              </div>
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
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="usuario@veterinaria.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="telefono" className={labelClass}>
                  Teléfono
                </label>
                <input
                  id="telefono"
                  name="telefono"
                  type="tel"
                  maxLength={30}
                  autoComplete="tel"
                  value={formData.telefono}
                  onChange={handleChange}
                  placeholder="Ej. 381 555-1234"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="rol" className={labelClass}>
                  Rol en el sistema *
                </label>
                <select
                  id="rol"
                  name="rol"
                  required
                  value={formData.rol}
                  onChange={handleChange}
                  className={inputClass}
                >
                  {ROLES.map((rol) => (
                    <option key={rol.value} value={rol.value}>
                      {rol.label}
                    </option>
                  ))}
                </select>
              </div>
              {formData.rol === 'veterinario' && (
                <div>
                  <label htmlFor="especialidad" className={labelClass}>
                    Especialidad
                  </label>
                  <input
                    id="especialidad"
                    name="especialidad"
                    type="text"
                    maxLength={100}
                    value={formData.especialidad}
                    onChange={handleChange}
                    placeholder="Ej. Clínica general"
                    className={inputClass}
                  />
                </div>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-slate-800/80 pb-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Credenciales de acceso
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="password" className={labelClass}>
                  Contraseña *
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    maxLength={72}
                    autoComplete="new-password"
                    value={formData.password}
                    onChange={handleChange}
                    placeholder="Entre 8 y 72 bytes UTF-8"
                    className={`${inputClass} pr-10`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={
                      showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
                    }
                    className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-500 transition-colors hover:text-slate-300"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>
              <div>
                <label htmlFor="confirmPassword" className={labelClass}>
                  Confirmar contraseña *
                </label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={8}
                  maxLength={72}
                  autoComplete="new-password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Repita la contraseña"
                  className={inputClass}
                />
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-lg border border-slate-800/80 bg-slate-900/40 p-3.5">
              <input
                id="activo"
                name="activo"
                type="checkbox"
                checked={formData.activo}
                onChange={handleChange}
                className="mt-0.5 h-4 w-4 rounded border-slate-700 bg-slate-950 text-emerald-600 focus:ring-emerald-500 focus:ring-offset-slate-950"
              />
              <span className="flex items-start gap-2 text-xs text-slate-300">
                <ShieldCheck
                  className="h-4 w-4 shrink-0 text-emerald-400"
                  aria-hidden="true"
                />
                <span>
                  <strong className="font-semibold text-slate-100">
                    Cuenta activa
                  </strong>{' '}
                  — el usuario podrá iniciar sesión inmediatamente.
                </span>
              </span>
            </label>
          </section>

          <footer className="flex items-center justify-end gap-3 border-t border-slate-800 pt-5">
            <button
              type="button"
              onClick={onCancel || (() => navigate('/usuarios'))}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-950 transition-all hover:bg-emerald-500 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {isSubmitting ? 'Creando...' : 'Crear usuario'}
            </button>
          </footer>
        </form>
      </section>
    </div>
  )
}
