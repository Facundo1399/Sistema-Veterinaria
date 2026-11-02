
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from models.mascota import SexoMascota


class MascotaBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=100)
    propietario_id: int
    especie_id: int
    raza: str | None = Field(None, max_length=100)
    sexo: SexoMascota | None = None
    fecha_nacimiento: date | None = None
    peso_actual: Decimal | None = Field(None, ge=0, max_digits=5, decimal_places=2)
    castrado: bool = False
    observaciones: str | None = None
    activo: bool = True


class MascotaCreate(MascotaBase):
    pass


class MascotaUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=100)
    propietario_id: int | None = None
    especie_id: int | None = None
    raza: str | None = Field(None, max_length=100)
    sexo: SexoMascota | None = None
    fecha_nacimiento: date | None = None
    peso_actual: Decimal | None = Field(
        None, ge=0, max_digits=5, decimal_places=2
    )
    castrado: bool | None = None
    observaciones: str | None = None
    activo: bool | None = None


class MascotaResponse(MascotaBase):
    id: int
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)