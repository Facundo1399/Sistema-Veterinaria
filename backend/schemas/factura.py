from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field

from models.factura import EstadoFactura


class FacturaBase(BaseModel):
    numero: str = Field(..., min_length=1, max_length=20)
    propietario_id: int
    mascota_id: int | None = None
    consulta_id: int | None = None
    usuario_id: int
    subtotal: Decimal = Decimal("0")
    descuento: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    estado: EstadoFactura = EstadoFactura.PENDIENTE
    metodo_pago: str | None = Field(None, max_length=50)
    observaciones: str | None = None


class FacturaCreate(FacturaBase):
    pass


class FacturaUpdate(BaseModel):
    numero: str | None = Field(None, min_length=1, max_length=20)
    propietario_id: int | None = None
    mascota_id: int | None = None
    consulta_id: int | None = None
    usuario_id: int | None = None
    fecha: datetime | None = None
    subtotal: Decimal | None = None
    descuento: Decimal | None = None
    total: Decimal | None = None
    estado: EstadoFactura | None = None
    metodo_pago: str | None = Field(None, max_length=50)
    observaciones: str | None = None


class FacturaResponse(FacturaBase):
    id: int
    fecha: datetime
    creado_en: datetime
    actualizado_en: datetime

    model_config = ConfigDict(from_attributes=True)


class DetalleFacturaBase(BaseModel):
    factura_id: int
    producto_id: int | None = None
    descripcion: str = Field(..., min_length=1, max_length=200)
    cantidad: Decimal = Decimal("1")
    precio_unitario: Decimal
    subtotal: Decimal


class DetalleFacturaCreate(DetalleFacturaBase):
    pass


class DetalleFacturaUpdate(BaseModel):
    factura_id: int | None = None
    producto_id: int | None = None
    descripcion: str | None = Field(None, min_length=1, max_length=200)
    cantidad: Decimal | None = None
    precio_unitario: Decimal | None = None
    subtotal: Decimal | None = None


class DetalleFacturaResponse(DetalleFacturaBase):
    id: int

    model_config = ConfigDict(from_attributes=True)