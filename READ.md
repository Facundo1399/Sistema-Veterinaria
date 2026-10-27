# 🐾 VetControl - Sistema de Gestión Veterinaria

Sistema de gestión integral para optimizar la atención de mascotas y la programación de citas clínicas.

---

## 🚀 Características principales

- 🐶 **Gestión de pacientes:** registro completo de mascotas (raza, edad, historial médico, vacunas) y de sus dueños.
- 📅 **Control de citas:** agenda interactiva para consultas, cirugías y vacunaciones.
- 📋 **Historial clínico:** registro de motivos de visita, diagnósticos y tratamientos.
- 👤 **Roles de usuario:** permisos diferenciados para administradores, veterinarios y recepcionistas.

---

## 👥 Roles y permisos

| Rol | Permisos |
| --- | --- |
| **Administrador** | Acceso total al sistema. Puede crear nuevos usuarios (recepción o veterinario). |
| **Veterinario** | Consulta la información de la mascota y de su dueño, así como los motivos de visita. Registra el diagnóstico, consulta el calendario y crea fechas para vacunaciones y cirugías (castraciones, intervenciones, etc.). |
| **Recepción** | Carga los datos del animal y de su dueño, junto con el motivo de la consulta. Crea citas para consultas. |

---

## 🛠️ Tecnologías utilizadas

- **Frontend:** React.js + Tailwind CSS
- **Backend:** Python (FastAPI)
- **Base de datos:** MySQL
- **Autenticación:** JWT (JSON Web Tokens)

---

## 📁 Estructura del proyecto

```text
.
├── backend/     # API REST con FastAPI
├── frontend/    # Interfaz de usuario con React
├── database/    # Scripts y esquema de la base de datos MySQL
└── README.md
```

---

## ⚙️ Configuración

Antes de iniciar el backend, es necesario crear un archivo `.env` con las variables de entorno del proyecto (conexión a MySQL, clave secreta de JWT, etc.).

> ⚠️ El archivo `.env` contiene datos sensibles: agregalo al `.gitignore` y no lo subas al repositorio.

---

## 📖 Documentación de la API

Con el backend en ejecución, la documentación interactiva generada por FastAPI está disponible en `/docs`.