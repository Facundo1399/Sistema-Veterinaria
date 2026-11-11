from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models.usuario import RolUsuario, Usuario
from schemas.veterinario import VeterinarioListado
from security.dependencies import require_roles
from security.permissions import TODOS_LOS_ROLES

router = APIRouter(
    prefix="/veterinarios",
    tags=["Veterinarios"],
    dependencies=[Depends(require_roles(*TODOS_LOS_ROLES))],
)


@router.get("/", response_model=list[VeterinarioListado])
def listar(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return (
        db.query(Usuario)
        .filter(
            Usuario.rol == RolUsuario.VETERINARIO,
            Usuario.activo.is_(True),
        )
        .order_by(Usuario.apellido, Usuario.nombre, Usuario.id)
        .offset(skip)
        .limit(limit)
        .all()
    )