from datetime import datetime

from pydantic import BaseModel, ConfigDict

from models.cita import EstadoCita, TipoCita


class CitaBase(BaseModel):
    mascota_id: int
    veterinario_id: int | None = None
    tipo: TipoCita = TipoCita.CONSULTA
    fecha_hora: datetime
    duracion_min: int = 30
    motivo: str | None = None
    estado: EstadoCita = EstadoCita.PENDIENTE
    creado_por: int | None = None


class CitaCreate(CitaBase):
    pass


class CitaUpdate(BaseModel):
    mascota_id: int | None = None
    veterinario_id: int | None = None
    tipo: TipoCita | None = None
    fecha_hora: datetime | None = None
    duracion_min: int | None = None
    motivo: str | None = None
    estado: EstadoCita | None = None
    creado_por: int | None = None


class CitaResponse(CitaBase):
    id: int
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)