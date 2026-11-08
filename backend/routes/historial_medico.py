import logging
from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.consulta import Consulta
from models.historial_medico import HistorialMedico
from models.mascota import Mascota
from models.usuario import RolUsuario, Usuario
from schemas.historial_medico import (
    HistorialMedicoCreate,
    HistorialMedicoResponse,
    HistorialMedicoUpdate,
)
from security.dependencies import get_current_user, require_roles
from security.permissions import CLINICOS, TODOS_LOS_ROLES

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/historial-medico",
    tags=["Historial médico"],
    dependencies=[Depends(require_roles(*TODOS_LOS_ROLES))],
)

CAMPOS_OBLIGATORIOS = {"tipo", "descripcion", "fecha"}


def obtener_o_404(db: Session, historial_id: int) -> HistorialMedico:
    historial = db.get(HistorialMedico, historial_id)
    if not historial:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro de historial no encontrado",
        )
    return historial


def validar_referencias(
    db: Session,
    mascota_id: int | None,
    consulta_id: int | None,
    validar_mascota_activa: bool = True,
) -> None:
    if mascota_id is not None and validar_mascota_activa:
        mascota = db.get(Mascota, mascota_id)
        if not mascota or not mascota.activo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La mascota no existe o está inactiva",
            )

    if consulta_id is not None:
        consulta = db.get(Consulta, consulta_id)
        if not consulta:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La consulta indicada no existe",
            )
        if mascota_id is not None and consulta.mascota_id != mascota_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La consulta no corresponde a la mascota indicada",
            )


def validar_rango_fechas(fecha: date, proxima_fecha: date | None) -> None:
    if proxima_fecha is not None and proxima_fecha < fecha:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="proxima_fecha no puede ser anterior a fecha",
        )


@router.get("/", response_model=list[HistorialMedicoResponse])
def listar(
    mascota_id: int | None = Query(None, ge=1),
    proxima_desde: date | None = Query(None),
    proxima_hasta: date | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    if (
        proxima_desde is not None
        and proxima_hasta is not None
        and proxima_desde > proxima_hasta
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="proxima_desde no puede ser posterior a proxima_hasta",
        )

    consulta = db.query(HistorialMedico)
    if mascota_id is not None:
        consulta = consulta.filter(HistorialMedico.mascota_id == mascota_id)
    if proxima_desde is not None:
        consulta = consulta.filter(
            HistorialMedico.proxima_fecha >= proxima_desde
        )
    if proxima_hasta is not None:
        consulta = consulta.filter(
            HistorialMedico.proxima_fecha <= proxima_hasta
        )

    if proxima_desde is not None or proxima_hasta is not None:
        orden = (HistorialMedico.proxima_fecha, HistorialMedico.id)
    else:
        orden = (HistorialMedico.fecha.desc(), HistorialMedico.id.desc())

    return consulta.order_by(*orden).offset(skip).limit(limit).all()


@router.get("/{historial_id}", response_model=HistorialMedicoResponse)
def obtener(historial_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, historial_id)


@router.post(
    "/",
    response_model=HistorialMedicoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*CLINICOS))],
)
def crear(
    datos: HistorialMedicoCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    validar_referencias(db, datos.mascota_id, datos.consulta_id)
    historial = HistorialMedico(
        **datos.model_dump(),
        veterinario_id=usuario_actual.id,
    )

    try:
        db.add(historial)
        db.commit()
        db.refresh(historial)
        return historial
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La mascota o la consulta indicadas no existen",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al registrar el historial médico")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar el historial médico",
        )


@router.patch(
    "/{historial_id}",
    response_model=HistorialMedicoResponse,
    dependencies=[Depends(require_roles(*CLINICOS))],
)
def actualizar(
    historial_id: int,
    datos: HistorialMedicoUpdate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    historial = obtener_o_404(db, historial_id)
    if (
        usuario_actual.rol != RolUsuario.ADMIN
        and historial.veterinario_id != usuario_actual.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el veterinario que registró el historial o un administrador puede editarlo",
        )

    cambios = datos.model_dump(exclude_unset=True)

    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron datos para actualizar",
        )

    if any(
        campo in cambios and cambios[campo] is None
        for campo in CAMPOS_OBLIGATORIOS
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="tipo, descripcion y fecha no pueden ser nulos",
        )

    nuevo_consulta_id = cambios.get("consulta_id", historial.consulta_id)
    nueva_fecha = cambios.get("fecha", historial.fecha)
    nueva_proxima_fecha = cambios.get("proxima_fecha", historial.proxima_fecha)

    if "consulta_id" in cambios:
        validar_referencias(
            db,
            historial.mascota_id,
            nuevo_consulta_id,
            validar_mascota_activa=False,
        )

    validar_rango_fechas(nueva_fecha, nueva_proxima_fecha)

    for campo, valor in cambios.items():
        setattr(historial, campo, valor)

    try:
        db.commit()
        db.refresh(historial)
        return historial
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="La mascota o la consulta indicadas no existen",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al actualizar el historial %s", historial_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el historial médico",
        )
