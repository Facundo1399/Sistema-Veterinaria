from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    DECIMAL,
    Enum,
    Integer,
    String,
    TEXT,
    func,
)

from database import Base


class TipoProducto(str, PyEnum):
    MEDICAMENTO = "medicamento"
    SERVICIO = "servicio"
    INSUMO = "insumo"
    OTRO = "otro"


class Producto(Base):
    __tablename__ = "producto"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(150), nullable=False)
    descripcion = Column(TEXT, nullable=True)
    tipo = Column(
        Enum(
            TipoProducto,
            name="tipo_producto",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=TipoProducto.SERVICIO,
        server_default="servicio",
    )
    precio = Column(DECIMAL(10, 2), nullable=False)
    stock = Column(Integer, nullable=False, default=0, server_default="0")
    activo = Column(Boolean, nullable=False, default=True, server_default="1")
    creado_en = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    actualizado_en = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )