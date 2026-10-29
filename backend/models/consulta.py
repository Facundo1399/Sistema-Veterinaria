from sqlalchemy import Column, DateTime, DECIMAL, ForeignKey, Integer, TEXT, func

from database import Base


class Consulta(Base):
    __tablename__ = "consulta"

    id = Column(Integer, primary_key=True, index=True)
    cita_id = Column(Integer, ForeignKey("cita.id"), nullable=True)
    mascota_id = Column(Integer, ForeignKey("mascota.id"), nullable=False)
    veterinario_id = Column(Integer, ForeignKey("usuario.id"), nullable=False)
    fecha = Column(DateTime, nullable=False, server_default=func.current_timestamp())
    anamnesis = Column(TEXT, nullable=True)
    examen_fisico = Column(TEXT, nullable=True)
    diagnostico = Column(TEXT, nullable=True)
    tratamiento = Column(TEXT, nullable=True)
    peso = Column(DECIMAL(5, 2), nullable=True)
    temperatura = Column(DECIMAL(4, 1), nullable=True)
    observaciones = Column(TEXT, nullable=True)