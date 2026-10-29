from sqlalchemy import Column, String, Integer
from database import Base

class Especie(Base):
    __tablename__ = "especie"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(50), nullable=False, unique=True)

    