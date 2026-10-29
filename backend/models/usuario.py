from enum import Enum as PyEnum

from sqlalchemy import Column, DateTime, Enum, String, Boolean, func, Integer
from database import Base

class RolUsuario(str, PyEnum):
    ADMIN = "admin"
    VETERINARIO = "veterinario"
    RECEPCION = "recepcion"


class Usuario(Base):
    __tablename__ = "usuario"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(100), nullable=False)
    apellido = Column(String(100))
    telefono = Column(String(30))
    email = Column(String(150), nullable=False, unique=True)
    password_hash = Column(String(255), nullable = False)
    rol = Column(
        Enum(
            RolUsuario,
            name="rol",
            values_callable=lambda enum_cls: [member.value for member in enum_cls],
        ),
        nullable=False
    )
    especialidad = Column(String(100), nullable=True)
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