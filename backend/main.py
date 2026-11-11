from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.auth import router as auth_router
from routes.usuario import router as usuario_router
from routes.mascota import router as mascota_router
from routes.propietario import router as propietario_router
from routes.cita import router as cita_router
from routes.especie import router as especie_router
from routes.consulta import router as consulta_router
from routes.historial_medico import router as historial_router
from routes.veterinario import router as veterinario_router
from routes.factura import router as factura_router
from routes.producto import router as producto_router
from routes.veterinario import router as veterinario_router

app = FastAPI(title="VetControl")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(auth_router)
app.include_router(usuario_router)
app.include_router(mascota_router)
app.include_router(propietario_router)
app.include_router(cita_router)
app.include_router(especie_router)
app.include_router(consulta_router)
app.include_router(historial_router)
app.include_router(veterinario_router)
app.include_router(producto_router)
app.include_router(factura_router)
app.include_router(veterinario_router)