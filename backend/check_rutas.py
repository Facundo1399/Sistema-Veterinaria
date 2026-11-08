import re
import sys

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)

PUBLICAS = {
    "/auth/login",
    "/docs",
    "/redoc",
    "/openapi.json",
    "/docs/oauth2-redirect",
}

abiertas = []

for ruta in app.routes:
    if not hasattr(ruta, "methods") or ruta.path in PUBLICAS:
        continue

    path = re.sub(r"\{[^}]+\}", "1", ruta.path)

    for metodo in sorted(ruta.methods - {"HEAD", "OPTIONS"}):
        respuesta = client.request(metodo, path)
        ok = respuesta.status_code == 401
        print(f"{metodo:7} {path:40} {'OK' if ok else f'ABIERTA ({respuesta.status_code})'}")
        if not ok:
            abiertas.append(f"{metodo} {path}")

print()
if abiertas:
    print(f"{len(abiertas)} ruta(s) sin protección:")
    for item in abiertas:
        print(f"  - {item}")
    sys.exit(1)

print("Todas las rutas exigen autenticación.")