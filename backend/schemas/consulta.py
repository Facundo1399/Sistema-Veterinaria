from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class ConsultaBase(BaseModel):
    cita_id: int | None = None
    mascota_id: int
    veterinario_id: int
    anamnesis: str | None = None
    examen_fisico: str | None = None
    diagnostico: str | None = None
    tratamiento: str | None = None
    peso: Decimal | None = None
    temperatura: Decimal | None = None
    observaciones: str | None = None


class ConsultaCreate(ConsultaBase):
    pass


class ConsultaUpdate(BaseModel):
    cita_id: int | None = None
    mascota_id: int | None = None
    veterinario_id: int | None = None
    fecha: datetime | None = None
    anamnesis: str | None = None
    examen_fisico: str | None = None
    diagnostico: str | None = None
    tratamiento: str | None = None
    peso: Decimal | None = None
    temperatura: Decimal | None = None
    observaciones: str | None = None


class ConsultaResponse(ConsultaBase):
    id: int
    fecha: datetime

    model_config = ConfigDict(from_attributes=True)