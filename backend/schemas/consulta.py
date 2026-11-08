from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field


class ConsultaBase(BaseModel):
    cita_id: int | None = None
    mascota_id: int
    anamnesis: str | None = Field(None, max_length=10000)
    examen_fisico: str | None = Field(None, max_length=10000)
    diagnostico: str | None = Field(None, max_length=10000)
    tratamiento: str | None = Field(None, max_length=10000)
    peso: Decimal | None = Field(None, ge=0, max_digits=5, decimal_places=2)
    temperatura: Decimal | None = Field(None, max_digits=4, decimal_places=1)
    observaciones: str | None = Field(None, max_length=10000)


class ConsultaCreate(ConsultaBase):
    model_config = ConfigDict(extra="forbid")


class ConsultaUpdate(BaseModel):
    anamnesis: str | None = Field(None, max_length=10000)
    examen_fisico: str | None = Field(None, max_length=10000)
    diagnostico: str | None = Field(None, max_length=10000)
    tratamiento: str | None = Field(None, max_length=10000)
    peso: Decimal | None = Field(None, ge=0, max_digits=5, decimal_places=2)
    temperatura: Decimal | None = Field(None, max_digits=4, decimal_places=1)
    observaciones: str | None = Field(None, max_length=10000)

    model_config = ConfigDict(extra="forbid")


class ConsultaResponse(ConsultaBase):
    id: int
    veterinario_id: int
    fecha: datetime

    model_config = ConfigDict(from_attributes=True)
