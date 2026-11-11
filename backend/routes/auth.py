import logging

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session
from config import settings

from database import get_db
from models.usuario import Usuario
from schemas.auth import Token
from schemas.usuario import UsuarioResponse
from security.auth import create_access_token, hash_password, verify_password
from security.dependencies import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Autenticación"])

HASH_FALSO = settings.DUMMY_PASSWORD_HASH


@router.post("/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    try:
        usuario = (
            db.query(Usuario)
            .filter(Usuario.email == form_data.username)
            .first()
        )
    except SQLAlchemyError:
        logger.exception("Error al buscar el usuario durante el inicio de sesión")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al iniciar sesión",
        )

    hash_a_verificar = usuario.password_hash if usuario else HASH_FALSO
    password_correcta = verify_password(form_data.password, hash_a_verificar)

    if not usuario or not usuario.activo or not password_correcta:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token({"sub": str(usuario.id)})
    return Token(access_token=access_token)


@router.get("/me", response_model=UsuarioResponse)
def perfil(usuario_actual: Usuario = Depends(get_current_user)):
    return usuario_actual