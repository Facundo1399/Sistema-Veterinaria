from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from models.cita import EstadoCita, TipoCita


class CitaBase(BaseModel):
    mascota_id: int
    veterinario_id: int | None = None
    tipo: TipoCita = TipoCita.CONSULTA
    fecha_hora: datetime
    duracion_min: int = Field(default=30, ge=30)
    motivo: str | None = None

    @field_validator("fecha_hora")
    @classmethod
    def validar_fecha_sin_zona_horaria(cls, valor: datetime) -> datetime:
        if valor.tzinfo is not None and valor.utcoffset() is not None:
            raise ValueError("fecha_hora debe estar en hora local sin zona horaria")
        return valor


class CitaCreate(CitaBase):
    model_config = ConfigDict(extra="forbid")


class CitaUpdate(BaseModel):
    mascota_id: int | None = None
    veterinario_id: int | None = None
    tipo: TipoCita | None = None
    fecha_hora: datetime | None = None
    duracion_min: int | None = Field(default=None, ge=30)
    motivo: str | None = None
    estado: EstadoCita | None = None
    creado_por: int | None = None

    @field_validator("fecha_hora")
    @classmethod
    def validar_fecha_sin_zona_horaria(
        cls,
        valor: datetime | None,
    ) -> datetime | None:
        if (
            valor is not None
            and valor.tzinfo is not None
            and valor.utcoffset() is not None
        ):
            raise ValueError("fecha_hora debe estar en hora local sin zona horaria")
        return valor


class CitaResponse(CitaBase):
    id: int
    estado: EstadoCita
    creado_por: int | None
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)