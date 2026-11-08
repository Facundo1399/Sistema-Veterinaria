import logging

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from database import get_db
from models.factura import DetalleFactura
from models.producto import Producto, TipoProducto
from models.usuario import RolUsuario, Usuario
from schemas.producto import ProductoCreate, ProductoResponse, ProductoUpdate
from security.dependencies import get_current_user, require_roles
from security.permissions import SOLO_ADMIN, TODOS_LOS_ROLES

logger = logging.getLogger(__name__)

CAMPOS_OBLIGATORIOS = {"nombre", "tipo", "precio", "stock", "activo"}

router = APIRouter(
    prefix="/productos",
    tags=["Productos"],
    dependencies=[Depends(require_roles(*TODOS_LOS_ROLES))],
)


def obtener_o_404(db: Session, producto_id: int) -> Producto:
    producto = db.get(Producto, producto_id)
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )
    return producto


@router.get("/", response_model=list[ProductoResponse])
def listar(
    tipo: TipoProducto | None = Query(None),
    buscar: str | None = Query(None, min_length=2, max_length=150),
    incluir_inactivos: bool = Query(False),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    consulta = db.query(Producto)
    if not (incluir_inactivos and usuario_actual.rol == RolUsuario.ADMIN):
        consulta = consulta.filter(Producto.activo.is_(True))

    if tipo is not None:
        consulta = consulta.filter(Producto.tipo == tipo)
    if buscar:
        consulta = consulta.filter(
            Producto.nombre.contains(buscar, autoescape=True)
        )

    return (
        consulta.order_by(Producto.nombre, Producto.id)
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{producto_id}", response_model=ProductoResponse)
def obtener(
    producto_id: int,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    producto = obtener_o_404(db, producto_id)
    if not producto.activo and usuario_actual.rol != RolUsuario.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )
    return producto


@router.post(
    "/",
    response_model=ProductoResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_roles(*SOLO_ADMIN))],
)
def crear(datos: ProductoCreate, db: Session = Depends(get_db)):
    producto = Producto(**datos.model_dump())
    try:
        db.add(producto)
        db.commit()
        db.refresh(producto)
        return producto
    except IntegrityError:
        db.rollback()
        logger.exception("Error de integridad al registrar el producto")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar el producto",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al registrar el producto")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar el producto",
        )


@router.patch(
    "/{producto_id}",
    response_model=ProductoResponse,
    dependencies=[Depends(require_roles(*SOLO_ADMIN))],
)
def actualizar(
    producto_id: int,
    datos: ProductoUpdate,
    db: Session = Depends(get_db),
):
    producto = (
        db.query(Producto)
        .filter(Producto.id == producto_id)
        .with_for_update()
        .one_or_none()
    )
    if not producto:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Producto no encontrado",
        )
    cambios = datos.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron datos para actualizar",
        )
    if any(
        campo in cambios and cambios[campo] is None
        for campo in CAMPOS_OBLIGATORIOS
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="nombre, tipo, precio, stock y activo no pueden ser nulos",
        )

    tipo_nuevo = cambios.get("tipo", producto.tipo)
    stock_nuevo = cambios.get("stock", producto.stock)
    if (
        {"tipo", "stock"}.intersection(cambios)
        and tipo_nuevo == TipoProducto.SERVICIO
        and stock_nuevo > 0
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Los servicios no pueden tener stock",
        )

    if "tipo" in cambios and cambios["tipo"] != producto.tipo:
        tiene_facturas = (
            db.query(DetalleFactura.id)
            .filter(DetalleFactura.producto_id == producto_id)
            .first()
        )
        if tiene_facturas:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="No se puede cambiar el tipo de un producto facturado",
            )

    for campo, valor in cambios.items():
        setattr(producto, campo, valor)

    try:
        db.commit()
        db.refresh(producto)
        return producto
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo actualizar el producto",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al actualizar el producto %s", producto_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar el producto",
        )


@router.delete(
    "/{producto_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_roles(*SOLO_ADMIN))],
)
def eliminar(producto_id: int, db: Session = Depends(get_db)):
    producto = obtener_o_404(db, producto_id)
    if not producto.activo:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El producto ya está inactivo",
        )

    producto.activo = False
    try:
        db.commit()
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al dar de baja el producto %s", producto_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al dar de baja el producto",
        )