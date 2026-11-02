from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from models.producto import TipoProducto


class ProductoBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=150)
    descripcion: str | None = None
    tipo: TipoProducto = TipoProducto.SERVICIO
    precio: Decimal = Field(..., ge=0)
    stock: int = Field(0, ge=0)
    activo: bool = True


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=150)
    descripcion: str | None = None
    tipo: TipoProducto | None = None
    precio: Decimal | None = Field(None, ge=0)
    stock: int | None = Field(None, ge=0)
    activo: bool | None = None


class ProductoResponse(ProductoBase):
    id: int
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)