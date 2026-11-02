from models.cita import TipoCita
from models.usuario import RolUsuario

TODOS_LOS_ROLES = (RolUsuario.ADMIN, RolUsuario.VETERINARIO, RolUsuario.RECEPCION)
CLINICOS = (RolUsuario.ADMIN, RolUsuario.VETERINARIO)
SOLO_ADMIN = (RolUsuario.ADMIN,)

TIPOS_CITA_PERMITIDOS = {
    RolUsuario.ADMIN: set(TipoCita),
    RolUsuario.VETERINARIO: set(TipoCita),
    RolUsuario.RECEPCION: {TipoCita.CONSULTA},
}


def puede_crear_cita(rol: RolUsuario, tipo: TipoCita) -> bool:
    return tipo in TIPOS_CITA_PERMITIDOS.get(rol, set())