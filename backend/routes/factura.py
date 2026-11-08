import logging
from datetime import datetime
from decimal import Decimal, ROUND_HALF_UP
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.dialects.mysql import insert as mysql_insert
from sqlalchemy.orm import Session

from database import get_db
from models.consulta import Consulta
from models.factura import (
    ContadorFactura,
    DetalleFactura,
    EstadoFactura,
    Factura,
)
from models.mascota import Mascota
from models.producto import Producto, TipoProducto
from models.propietario import Propietario
from models.usuario import RolUsuario, Usuario
from schemas.factura import FacturaCreate, FacturaResponse, FacturaUpdate
from security.dependencies import get_current_user, require_roles
from security.permissions import FACTURACION

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/facturas",
    tags=["Facturas"],
    dependencies=[Depends(require_roles(*FACTURACION))],
)

ZONA_CLINICA = ZoneInfo("America/Argentina/Buenos_Aires")
CENTAVO = Decimal("0.01")


def obtener_o_404(db: Session, factura_id: int) -> Factura:
    factura = db.get(Factura, factura_id)
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada",
        )
    return factura


def validar_referencias(
    db: Session,
    propietario_id: int,
    mascota_id: int | None,
    consulta_id: int | None,
) -> int | None:
    propietario = db.get(Propietario, propietario_id)
    if not propietario or not propietario.activo:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El propietario no existe o está inactivo",
        )

    if consulta_id is not None:
        consulta = db.get(Consulta, consulta_id)
        if not consulta:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La consulta indicada no existe",
            )
        if mascota_id is not None and consulta.mascota_id != mascota_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La consulta no corresponde a la mascota indicada",
            )
        if mascota_id is None:
            mascota_id = consulta.mascota_id

    if mascota_id is not None:
        mascota = db.get(Mascota, mascota_id)
        if not mascota or not mascota.activo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La mascota no existe o está inactiva",
            )
        if mascota.propietario_id != propietario_id:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="La mascota no pertenece al propietario indicado",
            )

    return mascota_id


def generar_numero_factura(db: Session, anio: int | None = None) -> str:
    if anio is None:
        anio = datetime.now(ZONA_CLINICA).year
    consulta = db.query(ContadorFactura).filter(ContadorFactura.anio == anio)
    db.execute(
        mysql_insert(ContadorFactura)
        .values(anio=anio, ultimo=0)
        .on_duplicate_key_update(ultimo=ContadorFactura.ultimo)
    )

    contador = consulta.with_for_update().one()

    contador.ultimo += 1
    db.flush()
    return f"{anio}-{contador.ultimo:06d}"


def cargar_productos(
    db: Session,
    datos: FacturaCreate,
) -> dict[int, Producto]:
    ids = sorted(
        {
            detalle.producto_id
            for detalle in datos.detalles
            if detalle.producto_id is not None
        }
    )
    productos: dict[int, Producto] = {}
    for producto_id in ids:
        producto = (
            db.query(Producto)
            .filter(Producto.id == producto_id)
            .with_for_update()
            .one_or_none()
        )
        if not producto or not producto.activo:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"El producto {producto_id} no existe o está inactivo",
            )
        productos[producto_id] = producto

    cantidades: dict[int, Decimal] = {}
    for detalle in datos.detalles:
        if detalle.producto_id is None:
            continue
        producto = productos[detalle.producto_id]
        if producto.tipo != TipoProducto.SERVICIO:
            if detalle.cantidad != detalle.cantidad.to_integral_value():
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="La cantidad de productos con stock debe ser entera",
                )
            cantidades[detalle.producto_id] = (
                cantidades.get(detalle.producto_id, Decimal("0"))
                + detalle.cantidad
            )

    for producto_id, cantidad in cantidades.items():
        producto = productos[producto_id]
        if cantidad > producto.stock:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Stock insuficiente para el producto {producto_id}",
            )

    return productos


def actualizar_stock(
    detalles: list[DetalleFactura],
    db: Session,
    reponer: bool,
) -> None:
    cantidades: dict[int, Decimal] = {}
    for detalle in detalles:
        if detalle.producto_id is not None:
            cantidades[detalle.producto_id] = (
                cantidades.get(detalle.producto_id, Decimal("0"))
                + detalle.cantidad
            )

    for producto_id in sorted(cantidades):
        producto = (
            db.query(Producto)
            .filter(Producto.id == producto_id)
            .with_for_update()
            .one_or_none()
        )
        if producto and producto.tipo != TipoProducto.SERVICIO:
            delta = int(cantidades[producto_id])
            producto.stock += delta if reponer else -delta


def validar_fecha_sin_zona(fecha: datetime) -> None:
    if fecha.tzinfo is not None and fecha.utcoffset() is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Enviá la fecha sin zona horaria (hora local de la clínica)",
        )


@router.get("/", response_model=list[FacturaResponse])
def listar(
    propietario_id: int | None = Query(None, ge=1),
    estado: EstadoFactura | None = Query(None),
    desde: datetime | None = Query(None),
    hasta: datetime | None = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
):
    consulta = db.query(Factura)
    if propietario_id is not None:
        consulta = consulta.filter(Factura.propietario_id == propietario_id)
    if estado is not None:
        consulta = consulta.filter(Factura.estado == estado)
    if desde is not None:
        validar_fecha_sin_zona(desde)
        consulta = consulta.filter(Factura.fecha >= desde)
    if hasta is not None:
        validar_fecha_sin_zona(hasta)
        consulta = consulta.filter(Factura.fecha < hasta)
    if desde is not None and hasta is not None and desde >= hasta:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="'desde' debe ser anterior a 'hasta'",
        )

    return (
        consulta.order_by(Factura.fecha.desc(), Factura.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/{factura_id}", response_model=FacturaResponse)
def obtener(factura_id: int, db: Session = Depends(get_db)):
    return obtener_o_404(db, factura_id)


@router.post(
    "/",
    response_model=FacturaResponse,
    status_code=status.HTTP_201_CREATED,
)
def crear(
    datos: FacturaCreate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    try:
        mascota_id = validar_referencias(
            db,
            datos.propietario_id,
            datos.mascota_id,
            datos.consulta_id,
        )
        productos = cargar_productos(db, datos)
        detalles: list[DetalleFactura] = []
        subtotal = Decimal("0")

        for item in datos.detalles:
            if item.producto_id is not None:
                producto = productos[item.producto_id]
                descripcion = producto.nombre
                precio_unitario = Decimal(producto.precio)
            else:
                if item.descripcion is None or item.precio_unitario is None:
                    raise HTTPException(
                        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                        detail="La línea manual requiere descripción y precio",
                    )
                descripcion = item.descripcion
                precio_unitario = item.precio_unitario

            precio_unitario = precio_unitario.quantize(
                CENTAVO,
                rounding=ROUND_HALF_UP,
            )
            linea_subtotal = (precio_unitario * item.cantidad).quantize(
                CENTAVO,
                rounding=ROUND_HALF_UP,
            )
            subtotal += linea_subtotal
            detalles.append(
                DetalleFactura(
                    producto_id=item.producto_id,
                    descripcion=descripcion,
                    cantidad=item.cantidad,
                    precio_unitario=precio_unitario,
                    subtotal=linea_subtotal,
                )
            )

        subtotal = subtotal.quantize(CENTAVO, rounding=ROUND_HALF_UP)
        descuento = datos.descuento.quantize(CENTAVO, rounding=ROUND_HALF_UP)
        if descuento > subtotal:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="El descuento no puede superar el subtotal",
            )

        for detalle in detalles:
            if detalle.producto_id is not None:
                producto = productos[detalle.producto_id]
                if producto.tipo != TipoProducto.SERVICIO:
                    producto.stock -= int(detalle.cantidad)

        fecha = datetime.now(ZONA_CLINICA).replace(tzinfo=None)
        factura = Factura(
            numero=generar_numero_factura(db, fecha.year),
            propietario_id=datos.propietario_id,
            mascota_id=mascota_id,
            consulta_id=datos.consulta_id,
            usuario_id=usuario_actual.id,
            fecha=fecha,
            subtotal=subtotal,
            descuento=descuento,
            total=subtotal - descuento,
            estado=EstadoFactura.PENDIENTE,
            metodo_pago=datos.metodo_pago,
            observaciones=datos.observaciones,
            detalles=detalles,
        )
        db.add(factura)
        db.commit()
        db.refresh(factura)
        return factura
    except HTTPException:
        db.rollback()
        raise
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo registrar la factura por una referencia inválida",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al registrar la factura")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al registrar la factura",
        )


@router.patch(
    "/{factura_id}",
    response_model=FacturaResponse,
)
def actualizar(
    factura_id: int,
    datos: FacturaUpdate,
    db: Session = Depends(get_db),
    usuario_actual: Usuario = Depends(get_current_user),
):
    factura = (
        db.query(Factura)
        .filter(Factura.id == factura_id)
        .with_for_update()
        .one_or_none()
    )
    if not factura:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Factura no encontrada",
        )
    cambios = datos.model_dump(exclude_unset=True)
    if not cambios:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No se enviaron datos para actualizar",
        )
    if factura.estado == EstadoFactura.ANULADA and cambios:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede modificar una factura anulada",
        )

    estado_nuevo = cambios.get("estado")
    if estado_nuevo is None and "estado" in cambios:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El estado no puede ser nulo",
        )
    if (
        estado_nuevo == EstadoFactura.PENDIENTE
        and factura.estado != EstadoFactura.PENDIENTE
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede volver una factura a estado pendiente",
        )
    if (
        estado_nuevo == EstadoFactura.ANULADA
        and usuario_actual.rol != RolUsuario.ADMIN
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo un administrador puede anular facturas",
        )
    if estado_nuevo == EstadoFactura.PAGADA and not (
        cambios.get("metodo_pago") or factura.metodo_pago
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Indicá el método de pago para marcar la factura como pagada",
        )
    if (
        factura.estado == EstadoFactura.PAGADA
        and "metodo_pago" in cambios
        and not cambios["metodo_pago"]
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se puede quitar el método de pago de una factura pagada",
        )

    try:
        if estado_nuevo == EstadoFactura.ANULADA:
            actualizar_stock(factura.detalles, db, reponer=True)
        for campo, valor in cambios.items():
            setattr(factura, campo, valor)
        db.commit()
        db.refresh(factura)
        return factura
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No se pudo actualizar la factura",
        )
    except SQLAlchemyError:
        db.rollback()
        logger.exception("Error al actualizar la factura %s", factura_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error al actualizar la factura",
        )