from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field

class PropietarioBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str | None = Field(None, max_length=100)
    telefono: str | None = Field(None, max_length=30)
    email: EmailStr
    activo: bool = True

class PropietarioCreate(PropietarioBase):
    pass

class PropietarioUpdate(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    apellido: str | None = Field(None, max_length=100)
    telefono: str | None = Field(None, max_length=30)
    email: EmailStr | None = None
    activo: bool | None = None

class PropietarioResponse(PropietarioBase):
    id: int
    activo: bool
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)