from enum import Enum as PyEnum

from sqlalchemy import (
    TEXT,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    SmallInteger,
    func,
)

from database import Base


class TipoCita(str, PyEnum):
    CONSULTA = "consulta"
    VACUNACION = "vacunacion"
    CIRUGIA = "cirugia"
    CONTROL = "control"


class EstadoCita(str, PyEnum):
    PENDIENTE = "pendiente"
    CONFIRMADA = "confirmada"
    CANCELADA = "cancelada"
    COMPLETADA = "completada"


class Cita(Base):
    __tablename__ = "cita"

    id = Column(Integer, primary_key=True, index=True)
    mascota_id = Column(Integer, ForeignKey("mascota.id"), nullable=False)
    veterinario_id = Column(Integer, ForeignKey("usuario.id"), nullable=True)
    tipo = Column(
        Enum(
            TipoCita,
            name="tipo",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=TipoCita.CONSULTA,
        server_default="consulta",
    )
    fecha_hora = Column(DateTime, nullable=False)
    duracion_min = Column(SmallInteger, nullable=False, default=30, server_default="30")
    motivo = Column(TEXT, nullable=True)
    estado = Column(
        Enum(
            EstadoCita,
            name="estado",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
        default=EstadoCita.PENDIENTE,
        server_default="pendiente",
    )
    creado_por = Column(Integer, ForeignKey("usuario.id"), nullable=True)
    creado_en = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    actualizado_en = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )