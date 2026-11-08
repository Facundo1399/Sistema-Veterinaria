import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.propietario import Propietario
from schemas.propietario import (
    PropietarioCreate,
    PropietarioResponse,
    PropietarioUpdate,
)
from security.dependencies import require_roles
from security.permissions import SOLO_ADMIN, TODOS_LOS_ROLES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/propietarios",
    tags=["Propietarios"],
    dependencies=[Depends(require_roles(*TODOS_LOS_ROLES))],
)

CAMPOS_OBLIGATORIOS = {"nombre", "activo"}


def obtener_activo_o_404(db: Session, propietario_id: int) -> Propietario:
    propietario = db.get(Propietario, propietario_id)

    if not propietario or not propietario.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Propietario no encontrado",
        )

    return propietario


@router.get("/", response_model=list[PropietarioResponse])
def listar(
    buscar: str | None = Query(None, min_length=2, max_length=50),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    consulta = db.query(Propietario).filter(Propietario.activo.is_(True))

    if buscar:
        patron = f"%{buscar}%"
        consulta = consulta.filter(
            or_(
                Propietario.apellido.contains(buscar, autoescape=True),
                Propietario.nombre.contains(buscar, autoescape=True),
                Propietario.telefono.contains(buscar, autoescape=True)
            )
        )

    return (
        consulta.order_by(Propietario.apellido, Propietario.nombre, Propietario.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{propietario_id}", response_model=PropietarioResponse)
def obtener(propietario_id: int, db: Session = Depends(get_db)):
    return obtener_activo_o_404(db, propietario_id)


@router.post(
    "/",
    response_model=PropietarioResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear(datos: PropietarioCreate, db: Session = Depends(get_db)):
    propietario = Propietario(**datos.model_dump())

    try:
        db.add(propietario)
        db.commit()
        db.refresh(propietario)
        return propietario
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al registrar el propietario")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar el propietario",
        )


@router.patch("/{propietario_id}", response_model=PropietarioResponse)
def actualizar(
    propietario_id: int,
    datos: PropietarioUpdate,
    db: Session = Depends(get_db),
):
    propietario = obtener_activo_o_404(db, propietario_id)

    cambios = datos.model_dump(exclude_unset=True)

    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron datos para actualizar",
        )

    if any(campo in cambios and cambios[campo] is None for campo in CAMPOS_OBLIGATORIOS):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="nombre y activo no pueden ser nulos",
        )

    for campo, valor in cambios.items():
        setattr(propietario, campo, valor)

    try:
        db.commit()
        db.refresh(propietario)
        return propietario
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al actualizar el propietario %s", propietario_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el propietario",
        )


@router.delete(
    "/{propietario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*SOLO_ADMIN))],
)
def desactivar(propietario_id: int, db: Session = Depends(get_db)):
    propietario = obtener_activo_o_404(db, propietario_id)

    try:
        propietario.activo = False
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al desactivar el propietario %s", propietario_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al desactivar el propietario",
        )