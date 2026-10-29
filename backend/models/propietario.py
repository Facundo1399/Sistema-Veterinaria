from sqlalchemy import Column, DateTime, String, Boolean, func, Integer
from sqlalchemy.orm import relationship
from database import Base

class Propietario(Base):
    __tablename__ = "propietario"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100))
    telefono = Column(String(30))
    email = Column(String(150))
    activo = Column(Boolean, nullable=False, default=True, server_default="1")
    creado_en = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
    )
    actualizado_en = Column(
        DateTime,
        nullable=False,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp(),
    )
