import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.especie import Especie
from schemas.especie import EspecieCreate, EspecieResponse, EspecieUpdate
from security.dependencies import get_current_user, require_roles
from security.permissions import SOLO_ADMIN

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/especies",
    tags=["Especies"],
    dependencies=[Depends(get_current_user)],
)


def obtener_o_404(db: Session, especie_id: int) -> Especie:
    especie = db.get(Especie, especie_id)

    if not especie:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Especie no encontrada",
        )

    return especie


@router.get("/", response_model=list[EspecieResponse])
def listar(
    buscar: str | None = Query(None, min_length=2, max_length=50),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    consulta = db.query(Especie)

    if buscar:
        consulta = consulta.filter(Especie.nombre.contains(buscar, autoescape=True))

    return consulta.order_by(Especie.nombre, Especie.id).offset(skip).limit(limit).all()


@router.get("/{especie_id}", response_model=EspecieResponse)
def obtener(especie_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, especie_id)


@router.post(
    "/",
    response_model=EspecieResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear(datos: EspecieCreate, db: Session = Depends(get_db)):
    especie = Especie(**datos.model_dump())

    try:
        db.add(especie)
        db.commit()
        db.refresh(especie)
        return especie
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una especie con ese nombre",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al registrar la especie")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar la especie",
        )


@router.patch(
    "/{especie_id}",
    response_model=EspecieResponse,
    dependencies=[Depends(require_roles(*SOLO_ADMIN))],
)
def actualizar(
    especie_id: int,
    datos: EspecieUpdate,
    db: Session = Depends(get_db),
):
    especie = obtener_o_404(db, especie_id)
    cambios = datos.model_dump(exclude_unset=True)

    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron datos para actualizar",
        )

    if cambios.get("nombre") is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="nombre no puede ser nulo",
        )

    for campo, valor in cambios.items():
        setattr(especie, campo, valor)

    try:
        db.commit()
        db.refresh(especie)
        return especie
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una especie con ese nombre",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al actualizar la especie %s", especie_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la especie",
        )


@router.delete(
    "/{especie_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*SOLO_ADMIN))],
)
def eliminar(especie_id: int, db: Session = Depends(get_db)):
    especie = obtener_o_404(db, especie_id)

    try:
        db.delete(especie)
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede eliminar una especie asociada a mascotas",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al eliminar la especie %s", especie_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al eliminar la especie",
        )