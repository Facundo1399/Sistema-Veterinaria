import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.especie import Especie
from models.mascota import Mascota
from models.propietario import Propietario
from models.usuario import RolUsuario, Usuario
from schemas.mascota import MascotaCreate, MascotaResponse, MascotaUpdate
from security.dependencies import get_current_user, require_roles
from security.permissions import SOLO_ADMIN, TODOS_LOS_ROLES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/mascotas",
    tags=["Mascotas"],
    dependencies=[Depends(require_roles(*TODOS_LOS_ROLES))],
)

CAMPOS_OBLIGATORIOS = {"nombre", "propietario_id", "especie_id", "activo"}
CAMPOS_VETERINARIO = {"peso_actual", "castrado", "observaciones"}


def validar_referencias(
    db: Session,
    propietario_id: int | None,
    especie_id: int | None,
) -> None:
    if propietario_id is not None:
        propietario = db.get(Propietario, propietario_id)
        if not propietario or not propietario.activo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El propietario no existe o está inactivo",
            )

    if especie_id is not None and not db.get(Especie, especie_id):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La especie indicada no existe",
        )


def obtener_o_404(db: Session, mascota_id: int, incluir_inactiva: bool = False) -> Mascota:
    mascota = db.get(Mascota, mascota_id)

    if not mascota or (not mascota.activo and not incluir_inactiva):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Mascota no encontrada",
        )

    return mascota


@router.get("/", response_model=list[MascotaResponse])
def listar(
    buscar: str | None = Query(None, min_length=2, max_length=50),
    propietario_id: int | None = Query(None, ge=1),
    incluir_inactivas: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    consulta = db.query(Mascota)

    if not (incluir_inactivas and usuario_actual.rol == RolUsuario.ADMIN):
        consulta = consulta.filter(Mascota.activo.is_(True))

    if propietario_id:
        consulta = consulta.filter(Mascota.propietario_id == propietario_id)

    if buscar:
        consulta = consulta.filter(
            or_(
                Mascota.nombre.contains(buscar, autoescape=True),
                Mascota.raza.contains(buscar, autoescape=True),
                Mascota.observaciones.contains(buscar, autoescape=True),
            )
        )

    return (
        consulta.order_by(Mascota.nombre, Mascota.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{mascota_id}", response_model=MascotaResponse)
def obtener(mascota_id: int, db: Session = Depends(get_db), usuario_actual: Usuario = Depends(get_current_user)):
    return obtener_o_404(db, mascota_id, incluir_inactiva=usuario_actual.rol == RolUsuario.ADMIN)


@router.post(
    "/",
    response_model=MascotaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear(
    datos: MascotaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    if not datos.activo and usuario_actual.rol != RolUsuario.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador puede registrar una mascota inactiva",
        )

    validar_referencias(db, datos.propietario_id, datos.especie_id)
    mascota = Mascota(**datos.model_dump())

    try:
        db.add(mascota)
        db.commit()
        db.refresh(mascota)
        return mascota
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El propietario o la especie indicados no existen",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al registrar la mascota")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar la mascota",
        )


@router.patch("/{mascota_id}", response_model=MascotaResponse)
def actualizar(
    mascota_id: int,
    datos: MascotaUpdate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    mascota = obtener_o_404(
        db,
        mascota_id,
        incluir_inactiva=usuario_actual.rol == RolUsuario.ADMIN,
    )
    cambios = datos.model_dump(exclude_unset=True)

    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron datos para actualizar",
        )

    if (
        usuario_actual.rol == RolUsuario.VETERINARIO
        and not set(cambios) <= CAMPOS_VETERINARIO
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu rol solo puede modificar peso, castrado y observaciones",
        )

    if any(
        campo in cambios and cambios[campo] is None
        for campo in CAMPOS_OBLIGATORIOS
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="nombre, propietario_id, especie_id y activo no pueden ser nulos",
        )

    if (
        "activo" in cambios
        and cambios["activo"] != mascota.activo
        and usuario_actual.rol != RolUsuario.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador puede activar o desactivar una mascota",
        )

    validar_referencias(
        db,
        cambios.get("propietario_id"),
        cambios.get("especie_id"),
    )

    for campo, valor in cambios.items():
        setattr(mascota, campo, valor)

    try:
        db.commit()
        db.refresh(mascota)
        return mascota
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El propietario o la especie indicados no existen",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al actualizar la mascota %s", mascota_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la mascota",
        )


@router.delete(
    "/{mascota_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*SOLO_ADMIN))],
)
def desactivar(mascota_id: int, db: Session = Depends(get_db)):
    mascota = obtener_o_404(db, mascota_id)

    if not mascota.activo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La mascota ya está desactivada",
        )

    try:
        mascota.activo = False
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al desactivar la mascota %s", mascota_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al desactivar la mascota",
        )
