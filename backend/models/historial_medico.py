from enum import Enum as PyEnum

from sqlalchemy import Column, Date, DateTime, Enum, ForeignKey, Integer, TEXT, func

from database import Base


class TipoHistorialMedico(str, PyEnum):
    VACUNA = "vacuna"
    DESPARASITACION = "desparasitacion"
    CIRUGIA = "cirugia"
    CONTROL = "control"
    OTRO = "otro"


class HistorialMedico(Base):
    __tablename__ = "historial_medico"

    id = Column(Integer, primary_key=True, index=True)
    mascota_id = Column(Integer, ForeignKey("mascota.id"), nullable=False)
    consulta_id = Column(Integer, ForeignKey("consulta.id"), nullable=True)
    tipo = Column(
        Enum(
            TipoHistorialMedico,
            name="tipo_historial_medico",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False,
    )
    descripcion = Column(TEXT, nullable=False)
    fecha = Column(Date, nullable=False)
    proxima_fecha = Column(Date, nullable=True)
    veterinario_id = Column(Integer, ForeignKey("usuario.id"), nullable=True)
    creado_en = Column(DateTime, nullable=False, server_default=func.current_timestamp())