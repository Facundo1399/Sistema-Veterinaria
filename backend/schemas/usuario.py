from datetime import datetime
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, EmailStr, Field

from models.usuario import RolUsuario


def _validar_password_bytes(password: str) -> str:
    if len(password.encode("utf-8")) > 72:
        raise ValueError("La contraseña no puede superar los 72 bytes en UTF-8")
    return password


Password = Annotated[
    str,
    Field(min_length=8, max_length=72),
    AfterValidator(_validar_password_bytes),
]


class UsuarioBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str | None = Field(None, max_length=100)
    telefono: str | None = Field(None, max_length=30)
    email: EmailStr
    especialidad: str | None = Field(None, max_length=100)
    activo: bool = True


class UsuarioCreate(UsuarioBase):
    password: Password
    rol: RolUsuario


class UsuarioUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=100)
    apellido: str | None = Field(None, max_length=100)
    telefono: str | None = Field(None, max_length=30)
    email: EmailStr | None = None
    especialidad: str | None = Field(None, max_length=100)
    activo: bool | None = None
    password: Password | None = None


class UsuarioResponse(UsuarioBase):
    id: int
    rol: RolUsuario
    activo: bool
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)


class UsuarioCambioRol(BaseModel):
    rol: RolUsuario