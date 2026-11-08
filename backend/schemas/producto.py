from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

from models.producto import TipoProducto


class ProductoBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=150)
    descripcion: str | None = Field(None, max_length=10000)
    tipo: TipoProducto = TipoProducto.SERVICIO
    precio: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2)
    stock: int = Field(0, ge=0)
    activo: bool = True


class ProductoCreate(ProductoBase):
    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validar_stock_servicio(self):
        if self.tipo == TipoProducto.SERVICIO and self.stock > 0:
            raise ValueError("Los servicios no pueden tener stock")
        return self


class ProductoUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=150)
    descripcion: str | None = Field(None, max_length=10000)
    tipo: TipoProducto | None = None
    precio: Decimal | None = Field(
        None, ge=0, max_digits=10, decimal_places=2
    )
    stock: int | None = Field(None, ge=0)
    activo: bool | None = None

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validar_stock_servicio(self):
        if (
            self.tipo == TipoProducto.SERVICIO
            and self.stock is not None
            and self.stock > 0
        ):
            raise ValueError("Los servicios no pueden tener stock")
        return self


class ProductoResponse(ProductoBase):
    id: int
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)