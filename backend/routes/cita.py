import logging
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.cita import Cita, EstadoCita
from models.mascota import Mascota
from models.usuario import RolUsuario, Usuario
from schemas.cita import CitaCreate, CitaResponse, CitaUpdate
from security.dependencies import get_current_user, require_roles
from security.permissions import TODOS_LOS_ROLES, puede_crear_cita

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/citas",
    tags=["Citas"],
    dependencies=[Depends(require_roles(*TODOS_LOS_ROLES))],
)

ZONA_CLINICA = ZoneInfo("America/Argentina/Buenos_Aires")
LIMITE_DURACION_MIN = 1440

CAMPOS_OBLIGATORIOS = {
    "mascota_id",
    "tipo",
    "fecha_hora",
    "duracion_min",
    "estado",
}
CAMPOS_RECEPCION = {
    "mascota_id",
    "veterinario_id",
    "tipo",
    "fecha_hora",
    "duracion_min",
    "motivo",
    "estado",
}
CAMPOS_VETERINARIO = {"motivo", "estado", "fecha_hora", "duracion_min"}
ESTADOS_CERRADOS = {EstadoCita.CANCELADA, EstadoCita.COMPLETADA}
TRANSICIONES_ESTADO = {
    EstadoCita.PENDIENTE: {
        EstadoCita.CONFIRMADA,
        EstadoCita.COMPLETADA,
        EstadoCita.CANCELADA,
    },
    EstadoCita.CONFIRMADA: {EstadoCita.COMPLETADA, EstadoCita.CANCELADA},
    EstadoCita.CANCELADA: set(),
    EstadoCita.COMPLETADA: set(),
}


def ahora_clinica() -> datetime:
    return datetime.now(ZONA_CLINICA).replace(tzinfo=None)


def validar_fecha_sin_zona(fecha: datetime) -> None:
    if fecha.tzinfo is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enviá la fecha sin zona horaria (hora local de la clínica)",
        )


def validar_fecha_futura(fecha: datetime) -> None:
    validar_fecha_sin_zona(fecha)
    if fecha < ahora_clinica():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se pueden registrar citas en una fecha pasada",
        )


def validar_referencias(
    db: Session,
    mascota_id: int | None,
    veterinario_id: int | None,
) -> None:
    if mascota_id is not None:
        mascota = db.get(Mascota, mascota_id)
        if not mascota or not mascota.activo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La mascota no existe o está inactiva",
            )

    if veterinario_id is not None:
        veterinario = db.get(Usuario, veterinario_id)
        if (
            not veterinario
            or not veterinario.activo
            or veterinario.rol != RolUsuario.VETERINARIO
        ):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El veterinario no existe, está inactivo o no tiene ese rol",
            )


def obtener_o_404(db: Session, cita_id: int) -> Cita:
    cita = db.get(Cita, cita_id)

    if not cita:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cita no encontrada",
        )

    return cita


def validar_permisos_actualizacion(
    cita: Cita,
    cambios: dict,
    usuario_actual: Usuario,
) -> None:
    if usuario_actual.rol == RolUsuario.ADMIN:
        return

    if usuario_actual.rol == RolUsuario.RECEPCION:
        campos_permitidos = CAMPOS_RECEPCION
        estados_permitidos = {EstadoCita.CONFIRMADA, EstadoCita.CANCELADA}
    elif usuario_actual.rol == RolUsuario.VETERINARIO:
        if cita.veterinario_id != usuario_actual.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Solo podés modificar tus propias citas asignadas",
            )
        campos_permitidos = CAMPOS_VETERINARIO
        estados_permitidos = {
            EstadoCita.CONFIRMADA,
            EstadoCita.COMPLETADA,
            EstadoCita.CANCELADA,
        }
    else:
        campos_permitidos = set()
        estados_permitidos = set()

    if not set(cambios) <= campos_permitidos:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu rol no puede modificar esos campos de la cita",
        )

    if "estado" in cambios and cambios["estado"] not in estados_permitidos:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu rol no puede establecer ese estado para la cita",
        )


def validar_transicion_estado(
    estado_actual: EstadoCita,
    estado_nuevo: EstadoCita,
) -> None:
    if (
        estado_nuevo != estado_actual
        and estado_nuevo not in TRANSICIONES_ESTADO[estado_actual]
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"No se puede cambiar una cita de {estado_actual.value} a {estado_nuevo.value}",
        )


def validar_sin_solapamiento(
    db: Session,
    veterinario_id: int | None,
    fecha_hora: datetime,
    duracion_min: int,
    excluir_cita_id: int | None = None,
) -> None:
    if veterinario_id is None:
        return

    fin_nuevo = fecha_hora + timedelta(minutes=duracion_min)
    candidatas = db.query(Cita).filter(
        Cita.veterinario_id == veterinario_id,
        Cita.estado != EstadoCita.CANCELADA,
        Cita.fecha_hora < fin_nuevo,
        Cita.fecha_hora > fecha_hora - timedelta(minutes=LIMITE_DURACION_MIN),
    )
    if excluir_cita_id is not None:
        candidatas = candidatas.filter(Cita.id != excluir_cita_id)

    for existente in candidatas:
        fin_existente = existente.fecha_hora + timedelta(minutes=existente.duracion_min)
        if fin_existente > fecha_hora:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="El veterinario ya tiene una cita en ese horario",
            )


@router.get("/", response_model=list[CitaResponse])
def listar(
    mascota_id: int | None = Query(None, ge=1),
    veterinario_id: int | None = Query(None, ge=1),
    estado: EstadoCita | None = Query(None),
    desde: datetime | None = Query(None),
    hasta: datetime | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    consulta = db.query(Cita)

    if desde is not None:
        validar_fecha_sin_zona(desde)
        consulta = consulta.filter(Cita.fecha_hora >= desde)

    if hasta is not None:
        validar_fecha_sin_zona(hasta)
        consulta = consulta.filter(Cita.fecha_hora < hasta)

    if desde is not None and hasta is not None and desde >= hasta:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'desde' debe ser anterior a 'hasta'",
        )

    if mascota_id is not None:
        consulta = consulta.filter(Cita.mascota_id == mascota_id)

    if veterinario_id is not None:
        consulta = consulta.filter(Cita.veterinario_id == veterinario_id)

    if estado is not None:
        consulta = consulta.filter(Cita.estado == estado)

    return (
        consulta.order_by(Cita.fecha_hora, Cita.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{cita_id}", response_model=CitaResponse)
def obtener(cita_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, cita_id)


@router.post(
    "/",
    response_model=CitaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear(
    datos: CitaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    if not puede_crear_cita(usuario_actual.rol, datos.tipo):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu rol no puede registrar este tipo de cita",
        )

    validar_fecha_futura(datos.fecha_hora)

    veterinario_id = datos.veterinario_id
    if usuario_actual.rol == RolUsuario.VETERINARIO and veterinario_id is None:
        veterinario_id = usuario_actual.id

    estado_inicial = (
        EstadoCita.CONFIRMADA
        if usuario_actual.rol in {RolUsuario.ADMIN, RolUsuario.VETERINARIO}
        else EstadoCita.PENDIENTE
    )

    validar_referencias(db, datos.mascota_id, veterinario_id)
    validar_sin_solapamiento(
        db,
        veterinario_id,
        datos.fecha_hora,
        datos.duracion_min,
    )

    cita = Cita(
        **datos.model_dump(exclude={"estado", "creado_por", "veterinario_id"}),
        veterinario_id=veterinario_id,
        creado_por=usuario_actual.id,
        estado=estado_inicial,
    )

    try:
        db.add(cita)
        db.commit()
        db.refresh(cita)
        return cita
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La mascota o el veterinario indicados no existen",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al registrar la cita")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar la cita",
        )


@router.patch("/{cita_id}", response_model=CitaResponse)
def actualizar(
    cita_id: int,
    datos: CitaUpdate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    cita = obtener_o_404(db, cita_id)
    cambios = datos.model_dump(exclude_unset=True)

    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron datos para actualizar",
        )

    if "creado_por" in cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="creado_por no se puede modificar",
        )

    validar_permisos_actualizacion(cita, cambios, usuario_actual)

    if cita.estado in ESTADOS_CERRADOS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede modificar una cita cancelada o completada",
        )

    if "tipo" in cambios and cambios["tipo"] is not None and not puede_crear_cita(
        usuario_actual.rol, cambios["tipo"]
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu rol no puede asignar este tipo de cita",
        )

    if any(
        campo in cambios and cambios[campo] is None
        for campo in CAMPOS_OBLIGATORIOS
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="mascota_id, tipo, fecha_hora, duracion_min y estado no pueden ser nulos",
        )

    if "fecha_hora" in cambios:
        validar_fecha_futura(cambios["fecha_hora"])

    if "estado" in cambios:
        validar_transicion_estado(cita.estado, cambios["estado"])

    validar_referencias(
        db,
        cambios.get("mascota_id"),
        cambios.get("veterinario_id"),
    )

    nuevo_estado = cambios.get("estado", cita.estado)

    if nuevo_estado != EstadoCita.CANCELADA and {
        "veterinario_id",
        "fecha_hora",
        "duracion_min",
    }.intersection(cambios):
        validar_sin_solapamiento(
            db,
            cambios.get("veterinario_id", cita.veterinario_id),
            cambios.get("fecha_hora", cita.fecha_hora),
            cambios.get("duracion_min", cita.duracion_min),
            excluir_cita_id=cita.id,
        )

    for campo, valor in cambios.items():
        setattr(cita, campo, valor)

    try:
        db.commit()
        db.refresh(cita)
        return cita
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La mascota o el veterinario indicados no existen",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al actualizar la cita %s", cita_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la cita",
        )


@router.delete(
    "/{cita_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def cancelar(
    cita_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    cita = obtener_o_404(db, cita_id)

    validar_permisos_actualizacion(
        cita,
        {"estado": EstadoCita.CANCELADA},
        usuario_actual,
    )

    if cita.estado == EstadoCita.CANCELADA:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La cita ya está cancelada",
        )

    validar_transicion_estado(cita.estado, EstadoCita.CANCELADA)

    try:
        cita.estado = EstadoCita.CANCELADA
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al cancelar la cita %s", cita_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cancelar la cita",
        )