from pydantic import BaseModel, ConfigDict, Field


class EspecieBase(BaseModel):
    nombre: str = Field(..., min_length=1, max_length=50)


class EspecieCreate(EspecieBase):
    pass


class EspecieUpdate(BaseModel):
    nombre: str | None = Field(None, min_length=1, max_length=50)


class EspecieResponse(EspecieBase):
    id: int

    model_config = ConfigDict(from_attributes=True)
