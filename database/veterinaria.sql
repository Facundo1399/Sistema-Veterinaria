
CREATE DATABASE IF NOT EXISTS veterinaria
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE veterinaria;


CREATE TABLE IF NOT EXISTS usuario (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100),
    telefono        VARCHAR(30),
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255) NOT NULL,
    rol             ENUM('admin', 'veterinario', 'recepcion') NOT NULL,
    especialidad    VARCHAR(100) NULL,
    activo          TINYINT NOT NULL DEFAULT 1,
    creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS especie (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB;

INSERT IGNORE INTO especie (nombre) VALUES
('canino'),
('felino'),
('ave'),
('equino'),
('reptil');


CREATE TABLE IF NOT EXISTS propietario (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(100) NOT NULL,
    apellido        VARCHAR(100),
    telefono        VARCHAR(30),
    email           VARCHAR(150),
    activo          TINYINT NOT NULL DEFAULT 1,
    creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_propietario_nombre (apellido, nombre),
    INDEX idx_propietario_telefono (telefono)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS mascota (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    propietario_id      INT NOT NULL,
    nombre              VARCHAR(100) NOT NULL,
    especie_id          INT NOT NULL,
    raza                VARCHAR(100),
    sexo                ENUM('M', 'H') NULL,
    fecha_nacimiento    DATE NULL,
    peso_actual         DECIMAL(5,2) NULL,
    castrado            TINYINT NOT NULL DEFAULT 0,
    observaciones       TEXT,
    activo              TINYINT NOT NULL DEFAULT 1,
    creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (propietario_id) REFERENCES propietario(id),
    FOREIGN KEY (especie_id) REFERENCES especie(id),
    
    INDEX idx_mascota_propietario (propietario_id),
    INDEX idx_mascota_nombre (nombre)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS cita (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    mascota_id          INT NOT NULL,
    veterinario_id      INT NULL,
    tipo                ENUM('consulta', 'vacunacion', 'cirugia', 'control') NOT NULL DEFAULT 'consulta',
    fecha_hora          DATETIME NOT NULL,
    duracion_min        SMALLINT UNSIGNED NOT NULL DEFAULT 30,
    motivo              TEXT,
    estado              ENUM('pendiente', 'confirmada', 'cancelada', 'completada') NOT NULL DEFAULT 'pendiente',
    creado_por          INT NULL,
    creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (mascota_id) REFERENCES mascota(id),
    FOREIGN KEY (veterinario_id) REFERENCES usuario(id),
    FOREIGN KEY (creado_por) REFERENCES usuario(id),
    
    INDEX idx_cita_fecha (fecha_hora),
    INDEX idx_cita_veterinario_fecha (veterinario_id, fecha_hora),
    INDEX idx_cita_mascota (mascota_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS consulta (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    cita_id             INT NULL,
    mascota_id          INT NOT NULL,
    veterinario_id      INT NOT NULL,
    fecha               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    anamnesis           TEXT,
    examen_fisico       TEXT,
    diagnostico         TEXT,
    tratamiento         TEXT,
    peso                DECIMAL(5,2),
    temperatura         DECIMAL(4,1),
    observaciones       TEXT,
    
    FOREIGN KEY (cita_id) REFERENCES cita(id),
    FOREIGN KEY (mascota_id) REFERENCES mascota(id),
    FOREIGN KEY (veterinario_id) REFERENCES usuario(id),
    
    INDEX idx_consulta_mascota_fecha (mascota_id, fecha)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS historial_medico (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    mascota_id          INT NOT NULL,
    consulta_id         INT NULL,
    tipo                ENUM('vacuna', 'desparasitacion', 'cirugia', 'control', 'otro') NOT NULL,
    descripcion         TEXT NOT NULL,
    fecha               DATE NOT NULL,
    proxima_fecha       DATE NULL,
    veterinario_id      INT NULL,
    creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    FOREIGN KEY (mascota_id) REFERENCES mascota(id),
    FOREIGN KEY (consulta_id) REFERENCES consulta(id),
    FOREIGN KEY (veterinario_id) REFERENCES usuario(id),
    
    INDEX idx_historial_mascota_fecha (mascota_id, fecha),
    INDEX idx_historial_proxima (proxima_fecha)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS producto (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    nombre          VARCHAR(150) NOT NULL,
    descripcion     TEXT,
    tipo            ENUM('medicamento', 'servicio', 'insumo', 'otro') NOT NULL DEFAULT 'servicio',
    precio          DECIMAL(10,2) NOT NULL,
    stock           INT NOT NULL DEFAULT 0,
    activo          TINYINT NOT NULL DEFAULT 1,
    creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- =====================================================
-- 9. CONTADOR DE FACTURAS (para numeración segura)
-- =====================================================
CREATE TABLE IF NOT EXISTS contador_factura (
    anio            SMALLINT UNSIGNED NOT NULL PRIMARY KEY,
    ultimo          INT UNSIGNED NOT NULL DEFAULT 0
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS factura (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    numero              VARCHAR(20) NOT NULL UNIQUE,
    propietario_id      INT NOT NULL,
    mascota_id          INT NULL,
    consulta_id         INT NULL,
    usuario_id          INT NOT NULL,
    fecha               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    subtotal            DECIMAL(12,2) NOT NULL DEFAULT 0,
    descuento           DECIMAL(12,2) NOT NULL DEFAULT 0,
    total               DECIMAL(12,2) NOT NULL DEFAULT 0,
    estado              ENUM('pendiente', 'pagada', 'anulada') NOT NULL DEFAULT 'pendiente',
    metodo_pago         VARCHAR(50) NULL,
    observaciones       TEXT,
    creado_en           DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    FOREIGN KEY (propietario_id) REFERENCES propietario(id),
    FOREIGN KEY (mascota_id) REFERENCES mascota(id),
    FOREIGN KEY (consulta_id) REFERENCES consulta(id),
    FOREIGN KEY (usuario_id) REFERENCES usuario(id),
    
    INDEX idx_factura_propietario (propietario_id),
    INDEX idx_factura_fecha (fecha)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS detalle_factura (
    id                  INT AUTO_INCREMENT PRIMARY KEY,
    factura_id          INT NOT NULL,
    producto_id         INT NULL,
    descripcion         VARCHAR(200) NOT NULL,
    cantidad            DECIMAL(8,2) NOT NULL DEFAULT 1,
    precio_unitario     DECIMAL(10,2) NOT NULL,
    subtotal            DECIMAL(12,2) NOT NULL,
    
    FOREIGN KEY (factura_id) REFERENCES factura(id) ON DELETE CASCADE,
    FOREIGN KEY (producto_id) REFERENCES producto(id),
    
    INDEX idx_detalle_factura (factura_id)
) ENGINE=InnoDB;

-- =====================================================
-- TRIGGER: Generación automática de número de factura
-- Formato: FAC-2025-0001
-- =====================================================
DELIMITER $$

DROP TRIGGER IF EXISTS before_insert_factura$$

CREATE TRIGGER before_insert_factura
BEFORE INSERT ON factura
FOR EACH ROW
BEGIN
    DECLARE v_anio SMALLINT;
    DECLARE v_ultimo INT;

    SET v_anio = YEAR(CURRENT_DATE);

    -- Crear el contador del año si no existe
    INSERT IGNORE INTO contador_factura (anio, ultimo) VALUES (v_anio, 0);

    -- Bloquear la fila y obtener el siguiente número
    SELECT ultimo INTO v_ultimo
    FROM contador_factura
    WHERE anio = v_anio
    FOR UPDATE;

    SET v_ultimo = v_ultimo + 1;

    UPDATE contador_factura
    SET ultimo = v_ultimo
    WHERE anio = v_anio;

    -- Generar el número con formato FAC-AAAA-0001
    SET NEW.numero = CONCAT('FAC-', v_anio, '-', LPAD(v_ultimo, 4, '0'));
END$$

DELIMITER ;
