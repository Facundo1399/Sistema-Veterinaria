from enum import Enum as PyEnum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    DECIMAL,
    Enum,
    ForeignKey,
    Integer,
    String,
    TEXT,
    func,
)

from database import Base


class SexoMascota(str, PyEnum):
    MACHO = "M"
    HEMBRA = "H"


class Mascota(Base):
    __tablename__ = "mascota"

    id = Column(Integer, primary_key=True, index=True)
    propietario_id = Column(Integer, ForeignKey("propietario.id"), nullable=False)
    nombre = Column(String(100), nullable=False)
    especie_id = Column(Integer, ForeignKey("especie.id"), nullable=False)
    raza = Column(String(100), nullable=True)
    sexo = Column(
        Enum(
            SexoMascota,
            name="sexo",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=True,
    )
    fecha_nacimiento = Column(Date, nullable=True)
    peso_actual = Column(DECIMAL(5, 2), nullable=True)
    castrado = Column(Boolean, nullable=False, default=False, server_default="0")
    observaciones = Column(TEXT, nullable=True)
    activo = Column(Boolean, nullable=False, default=True, server_default="1")
    creado_en = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    actualizado_en = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )