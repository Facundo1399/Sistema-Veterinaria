from enum import Enum as PyEnum

from sqlalchemy import (
    Column,
    DateTime,
    DECIMAL,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    TEXT,
    func,
)

from database import Base


class EstadoFactura(str, PyEnum):
    PENDIENTE = "pendiente"
    PAGADA = "pagada"
    ANULADA = "anulada"


class ContadorFactura(Base):
    __tablename__ = "contador_factura"

    anio = Column(SmallInteger, primary_key=True)
    ultimo = Column(Integer, nullable=False, default=0, server_default="0")


class Factura(Base):
    __tablename__ = "factura"

    id = Column(Integer, primary_key=True, index=True)
    numero = Column(String(20), nullable=False, unique=True)
    propietario_id = Column(Integer, ForeignKey("propietario.id"), nullable=False)
    mascota_id = Column(Integer, ForeignKey("mascota.id"), nullable=True)
    consulta_id = Column(Integer, ForeignKey("consulta.id"), nullable=True)
    usuario_id = Column(Integer, ForeignKey("usuario.id"), nullable=False)
    fecha = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    subtotal = Column(DECIMAL(12, 2), nullable=False, default=0, server_default="0")
    descuento = Column(DECIMAL(12, 2), nullable=False, default=0, server_default="0")
    total = Column(DECIMAL(12, 2), nullable=False, default=0, server_default="0")
    estado = Column(
        Enum(
            EstadoFactura,
            name="estado_factura",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=EstadoFactura.PENDIENTE,
        server_default="pendiente",
    )
    metodo_pago = Column(String(50), nullable=True)
    observaciones = Column(TEXT, nullable=True)
    creado_en = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    actualizado_en = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )


class DetalleFactura(Base):
    __tablename__ = "detalle_factura"

    id = Column(Integer, primary_key=True, index=True)
    factura_id = Column(Integer, ForeignKey("factura.id", ondelete="CASCADE"), nullable=False)
    producto_id = Column(Integer, ForeignKey("producto.id"), nullable=True)
    descripcion = Column(String(200), nullable=False)
    cantidad = Column(DECIMAL(8, 2), nullable=False, default=1, server_default="1")
    precio_unitario = Column(DECIMAL(10, 2), nullable=False)
    subtotal = Column(DECIMAL(12, 2), nullable=False)