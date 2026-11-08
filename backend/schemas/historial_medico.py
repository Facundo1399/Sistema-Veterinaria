from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator

from models.historial_medico import TipoHistorialMedico


class HistorialMedicoBase(BaseModel):
    mascota_id: int
    consulta_id: int | None = None
    tipo: TipoHistorialMedico
    descripcion: str = Field(..., min_length=1, max_length=10000)
    fecha: date
    proxima_fecha: date | None = None


class HistorialMedicoCreate(HistorialMedicoBase):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validar_proxima_fecha(self):
        if self.proxima_fecha is not None and self.proxima_fecha < self.fecha:
            raise ValueError("proxima_fecha no puede ser anterior a fecha")
        return self


class HistorialMedicoUpdate(BaseModel):
    consulta_id: int | None = None
    tipo: TipoHistorialMedico | None = None
    descripcion: str | None = Field(None, min_length=1, max_length=10000)
    fecha: date | None = None
    proxima_fecha: date | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validar_proxima_fecha(self):
        if (
            self.fecha is not None
            and self.proxima_fecha is not None
            and self.proxima_fecha < self.fecha
        ):
            raise ValueError("proxima_fecha no puede ser anterior a fecha")
        return self


class HistorialMedicoResponse(HistorialMedicoBase):
    id: int
    veterinario_id: int | None
    creado_en: datetime

    model_config = ConfigDict(from_attributes=True)
