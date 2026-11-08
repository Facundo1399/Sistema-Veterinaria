from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, model_validator

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


class DetalleFacturaCreate(BaseModel):
    producto_id: int | None = Field(None, ge=1)
    descripcion: str | None = Field(None, min_length=1, max_length=200)
    cantidad: Decimal = Field(default=Decimal("1"), gt=0)
    precio_unitario: Decimal | None = Field(None, ge=0)

    model_config = ConfigDict(extra="forbid")

    @model_validator(mode="after")
    def validar_linea_manual(self):
        if self.producto_id is None and (
            self.descripcion is None or self.precio_unitario is None
        ):
            raise ValueError(
                "Las líneas sin producto requieren descripción y precio_unitario"
            )
        if self.producto_id is not None and (
            self.descripcion is not None or self.precio_unitario is not None
        ):
            raise ValueError(
                "Para líneas de producto, la descripción y el precio se toman del catálogo"
            )
        return self


class DetalleFacturaBase(BaseModel):
    factura_id: int
    producto_id: int | None = None
    descripcion: str = Field(..., min_length=1, max_length=200)
    cantidad: Decimal = Decimal("1")
    precio_unitario: Decimal
    subtotal: Decimal


class DetalleFacturaResponse(DetalleFacturaBase):
    id: int

    model_config = ConfigDict(from_attributes=True)


class FacturaCreate(BaseModel):
    propietario_id: int = Field(..., ge=1)
    mascota_id: int | None = Field(None, ge=1)
    consulta_id: int | None = Field(None, ge=1)
    descuento: Decimal = Field(default=Decimal("0"), ge=0)
    metodo_pago: str | None = Field(None, max_length=50)
    observaciones: str | None = None
    detalles: list[DetalleFacturaCreate] = Field(..., min_length=1)

    model_config = ConfigDict(extra="forbid")


class FacturaUpdate(BaseModel):
    estado: EstadoFactura | None = None
    metodo_pago: str | None = Field(None, max_length=50)
    observaciones: str | None = None

    model_config = ConfigDict(extra="forbid")


class FacturaResponse(FacturaBase):
    id: int
    fecha: datetime
    creado_en: datetime
    actualizado_en: datetime
    detalles: list[DetalleFacturaResponse] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)