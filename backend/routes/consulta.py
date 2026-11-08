import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.cita import Cita, EstadoCita
from models.consulta import Consulta
from models.mascota import Mascota
from models.usuario import RolUsuario, Usuario
from schemas.consulta import ConsultaCreate, ConsultaResponse, ConsultaUpdate
from security.dependencies import get_current_user, require_roles
from security.permissions import CLINICOS

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/consultas",
    tags=["Consultas"],
    dependencies=[Depends(require_roles(*CLINICOS))],
)


def obtener_o_404(db: Session, consulta_id: int) -> Consulta:
    consulta = db.get(Consulta, consulta_id)
    if not consulta:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Consulta no encontrada",
        )
    return consulta


def validar_mascota(db: Session, mascota_id: int) -> Mascota:
    mascota = db.get(Mascota, mascota_id)
    if not mascota or not mascota.activo:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La mascota no existe o está inactiva",
        )
    return mascota


def validar_cita(
    db: Session,
    cita_id: int | None,
    mascota_id: int,
) -> Cita | None:
    if cita_id is None:
        return None

    cita = db.get(Cita, cita_id)
    if not cita:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La cita indicada no existe",
        )
    if cita.mascota_id != mascota_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La cita no corresponde a la mascota indicada",
        )
    if cita.estado == EstadoCita.CANCELADA:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se puede asociar una consulta a una cita cancelada",
        )
    if cita.estado == EstadoCita.COMPLETADA:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La cita ya está completada",
        )
    return cita


@router.get("/", response_model=list[ConsultaResponse])
def listar(
    mascota_id: int | None = Query(None, ge=1),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    consulta = db.query(Consulta)
    if mascota_id is not None:
        consulta = consulta.filter(Consulta.mascota_id == mascota_id)

    return (
        consulta.order_by(Consulta.fecha.desc(), Consulta.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{consulta_id}", response_model=ConsultaResponse)
def obtener(consulta_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, consulta_id)


@router.post(
    "/",
    response_model=ConsultaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear(
    datos: ConsultaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    mascota = validar_mascota(db, datos.mascota_id)
    cita = validar_cita(db, datos.cita_id, datos.mascota_id)
    if (
        cita
        and cita.veterinario_id not in (None, usuario_actual.id)
        and usuario_actual.rol != RolUsuario.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esa cita está asignada a otro veterinario",
        )

    consulta = Consulta(
        **datos.model_dump(),
        veterinario_id=usuario_actual.id,
    )

    try:
        db.add(consulta)
        if cita:
            cita.estado = EstadoCita.COMPLETADA
        if datos.peso is not None:
            mascota.peso_actual = datos.peso
        db.commit()
        db.refresh(consulta)
        return consulta
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La mascota o la cita indicadas ya no son válidas",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al registrar la consulta")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar la consulta",
        )


@router.patch("/{consulta_id}", response_model=ConsultaResponse)
def actualizar(
    consulta_id: int,
    datos: ConsultaUpdate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    consulta = obtener_o_404(db, consulta_id)
    if (
        usuario_actual.rol != RolUsuario.ADMIN
        and consulta.veterinario_id != usuario_actual.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el veterinario que registró la consulta o un administrador puede editarla",
        )

    cambios = datos.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron datos para actualizar",
        )

    for campo, valor in cambios.items():
        setattr(consulta, campo, valor)

    try:
        db.commit()
        db.refresh(consulta)
        return consulta
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo actualizar la consulta por una referencia inválida",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al actualizar la consulta %s", consulta_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la consulta",
        )
