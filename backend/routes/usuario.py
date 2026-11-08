import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.usuario import Usuario
from schemas.usuario import (
    UsuarioCambioRol,
    UsuarioCreate,
    UsuarioResponse,
    UsuarioUpdate,
)
from security.auth import hash_password
from security.dependencies import get_current_user, require_roles
from security.permissions import SOLO_ADMIN

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/usuarios", tags=["Usuarios"], dependencies=[Depends(require_roles(*SOLO_ADMIN))])


CAMPOS_OBLIGATORIOS = {"nombre", "email", "activo"}


def obtener_activo_o_404(db: Session, usuario_id: int) -> Usuario:
    usuario = db.get(Usuario, usuario_id)

    if not usuario or not usuario.activo:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    return usuario


@router.get("/", response_model=list[UsuarioResponse])
def listar(
    buscar: str | None = Query(None, min_length=2, max_length=50),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    consulta = db.query(Usuario).filter(Usuario.activo.is_(True))

    if buscar:
        consulta = consulta.filter(
            or_(
                Usuario.apellido.contains(buscar, autoescape=True),
                Usuario.nombre.contains(buscar, autoescape=True),
                Usuario.telefono.contains(buscar, autoescape=True),
                Usuario.email.contains(buscar, autoescape=True),
                Usuario.especialidad.contains(buscar, autoescape=True),
            )
        )

    return (
        consulta.order_by(Usuario.apellido, Usuario.nombre, Usuario.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{usuario_id}", response_model=UsuarioResponse)
def obtener(usuario_id: int, db: Session = Depends(get_db)):
    return obtener_activo_o_404(db, usuario_id)


@router.post(
    "/",
    response_model=UsuarioResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear(datos: UsuarioCreate, db: Session = Depends(get_db)):
    usuario = Usuario(
        **datos.model_dump(exclude={"password"}),
        password_hash=hash_password(datos.password),
    )

    try:
        db.add(usuario)
        db.commit()
        db.refresh(usuario)
        return usuario
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo electrónico",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al registrar el usuario")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar el usuario",
        )


@router.patch("/{usuario_id}", response_model=UsuarioResponse)
def actualizar(
    usuario_id: int,
    datos: UsuarioUpdate,
    db: Session = Depends(get_db),
):
    usuario = obtener_activo_o_404(db, usuario_id)
    cambios = datos.model_dump(exclude_unset=True)

    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron datos para actualizar",
        )

    if any(campo in cambios and cambios[campo] is None for campo in CAMPOS_OBLIGATORIOS):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="nombre, email y activo no pueden ser nulos",
        )

    if "password" in cambios:
        if cambios["password"] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="password no puede ser nulo",
            )
        cambios["password_hash"] = hash_password(cambios.pop("password"))

    for campo, valor in cambios.items():
        setattr(usuario, campo, valor)

    try:
        db.commit()
        db.refresh(usuario)
        return usuario
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo electrónico",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al actualizar el usuario %s", usuario_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el usuario",
        )


@router.patch("/{usuario_id}/rol", response_model=UsuarioResponse)
def cambiar_rol(
    usuario_id: int,
    datos: UsuarioCambioRol,
    db: Session = Depends(get_db),
):
    usuario = obtener_activo_o_404(db, usuario_id)
    usuario.rol = datos.rol

    try:
        db.commit()
        db.refresh(usuario)
        return usuario
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al cambiar el rol del usuario %s", usuario_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al cambiar el rol del usuario",
        )


@router.delete(
    "/{usuario_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def desactivar(usuario_id: int, db: Session = Depends(get_db)):
    usuario = obtener_activo_o_404(db, usuario_id)

    try:
        usuario.activo = False
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al desactivar el usuario %s", usuario_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al desactivar el usuario",
        )
