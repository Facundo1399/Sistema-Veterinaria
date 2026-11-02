from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models.usuario import RolUsuario, Usuario
from security.auth import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> Usuario:
    credenciales_invalidas = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token inválido o expirado",
        headers={"WWW-Authenticate": "Bearer"},
    )

    payload = decode_access_token(token)
    if not payload or "sub" not in payload:
        raise credenciales_invalidas

    try:
        usuario_id = int(payload["sub"])
    except (TypeError, ValueError):
        raise credenciales_invalidas

    usuario = db.get(Usuario, usuario_id)
    if not usuario or not usuario.activo:
        raise credenciales_invalidas

    return usuario


def require_roles(*roles: RolUsuario):
    def verificar(usuario: Usuario = Depends(get_current_user)) -> Usuario:
        if usuario.rol not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tenés permiso para esta acción",
            )
        return usuario

    return verificar