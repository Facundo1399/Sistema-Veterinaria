from pydantic import BaseModel, ConfigDict


class VeterinarioListado(BaseModel):
    id: int
    nombre: str
    apellido: str
    especialidad: str | None = None

    model_config = ConfigDict(from_attributes=True)