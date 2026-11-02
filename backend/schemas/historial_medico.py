from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field

from models.historial_medico import TipoHistorialMedico


class HistorialMedicoBase(BaseModel):
    mascota_id: int
    consulta_id: int | None = None
    tipo: TipoHistorialMedico
    descripcion: str = Field(..., min_length=1)
    fecha: date
    proxima_fecha: date | None = None
    veterinario_id: int | None = None


class HistorialMedicoCreate(HistorialMedicoBase):
    pass


class HistorialMedicoUpdate(BaseModel):
    mascota_id: int | None = None
    consulta_id: int | None = None
    tipo: TipoHistorialMedico | None = None
    descripcion: str | None = Field(None, min_length=1)
    fecha: date | None = None
    proxima_fecha: date | None = None
    veterinario_id: int | None = None


class HistorialMedicoResponse(HistorialMedicoBase):
    id: int
    creado_en: datetime

    model_config = ConfigDict(from_attributes=True)