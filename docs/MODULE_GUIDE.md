# Guía de Funcionalidad y Estado de Módulos

Este documento detalla el propósito y el estado de implementación actual de los módulos **Gestión Judicial**, **Automatización Documental** y **Gestión de Expedientes**, visibles en el frontend.

---

## 1. Gestión Judicial

### ¿Qué es y para qué sirve?
Este módulo es el centro de comando para interactuar con los sistemas externos del Poder Judicial (como **PJN** - Poder Judicial de la Nación, **MEV** - Mesa de Entradas Virtual PBA, etc.).
Su objetivo es **centralizar las notificaciones y movimientos**, evitando que el abogado tenga que entrar manualmente a múltiples portales con diferentes credenciales ("tokens") todos los días.

### Funcionalidades Clave (Visión):
- **Sincronización Automática**: Un "robot" revisa periódicamente los expedientes en busca de nuevos despachos.
- **Alertas Unificadas**: Recibe avisos de cédulas electrónicas o sentencias en una sola bandeja de entrada.
- **Gestión de Cuentas**: Vincula de forma segura las credenciales (CUIT/Clave) de los letrados.

### Estado Actual de Implementación (Demo Técnica):
✅ **Interfaz de Usuario**: Implementada. Muestra el estado del servicio y las cuentas vinculadas.
✅ **Conexión Backend**: Implementada.
⚠️ **Integración Real**: **Simulada**.
- Dado que no poseemos credenciales reales de un abogado matriculado ni certificados digitales para conectarnos al PJN real en este entorno de desarrollo, el sistema utiliza un **"Mock" (Simulador)**.
- El botón **"Forzar Sincronización"** llama al backend, el cual simula una conexión con el servidor judicial, espera unos segundos y devuelve resultados aleatorios (o predefinidos) de movimientos exitosos.
- **Propósito**: Demostrar el flujo de datos y la experiencia de usuario (UX) sin depender de la burocracia externa para pruebas.

---

## 2. Automatización Documental

### ¿Qué es y para qué sirve?
Es un motor de generación de documentos jurídicos basado en plantillas inteligentes. Permite a los estudios jurídicos estandarizar su trabajo y reducir errores humanos en escritos repetitivos.

### Funcionalidades Clave:
- **Plantillas Dinámicas**: Escritos pre-redactados (Demandas, Cartas Documento, Oficios) con "huecos" o variables (`{{nombre_cliente}}`, `{{juzgado}}`).
- **Generación Masiva**: Posibilidad de generar 50 oficios idénticos para 50 destinatarios distintos con un solo clic.
- **Control de Calidad**: Asegura que todos los escritos del estudio sigan el mismo estándar de formato y contenido.

### Estado Actual de Implementación:
✅ **Interfaz de Usuario**: Implementada. Muestra la galería de plantillas disponibles.
✅ **Lógica de Generación**: Implementada.
⚠️ **Motor de Descarga**: **Simulado**.
- El botón **"Generar Documento"** activa el proceso en el backend que fusiona los datos del usuario con la plantilla seleccionada.
- Actualmente, el sistema muestra una confirmación visual (toast/alerta) del éxito de la operación.
- **Próximo paso en producción**: Generar y descargar un archivo `.docx` o `.pdf` real listo para imprimir o firmar digitalmente.

---

## 3. Gestión de Expedientes

### ¿Qué es y para qué sirve?
Es el módulo core del sistema (`Case Management`), donde el abogado organiza todas sus causas. Actúa como el expediente digital privado del estudio.

### Funcionalidades Clave Implementadas:
1.  **Alta de Expedientes**:
    *   Formulario completo para registrar nuevas causas (`Carátula`, `Número`, `Fuero`, `Jurisdicción`).
    *   **Carga Inicial de Archivos**: Zona de Drag & Drop para subir la documentación inicial al momento de crear la carpeta (simulado).

2.  **Gestión Documental Individual**:
    *   Dentro de cada expediente, un visor de documentos.
    *   **Importación de Escritos/Cédulas**: Botón **"Importar PDF"** que simula el flujo de:
        1. Selección de archivo local.
        2. Subida segura a la nube (S3).
        3. Procesamiento OCR automático.

### Estado Actual de Implementación:
✅ **Alta de Causa**: Funcional. Guarda el nuevo expediente en la base de datos real.
✅ **Importación Documental**: **Simulada**.
- El botón activa la interfaz y muestra el mensaje de éxito, simulando la interacción con el sistema de archivos del SO y el servicio de almacenamiento en la nube.

---

## Resumen para el Usuario

| Módulo | Estado | ¿Funciona? | Nota Técnica |
| :--- | :--- | :--- | :--- |
| **Gestión Judicial** | **Funcional (Simulado)** | **SÍ** | Simula conexión al PJN para mostrar el flujo de actualización. |
| **Automatización** | **Funcional (Simulado)** | **SÍ** | Simula la fusión de variables y confirma la creación del documento. |
| **Expedientes** | **Funcional (Híbrido)** | **SÍ** | Alta real en BD. Subida de archivos simulada (mock). |

Ambos módulos están conectados `Frontend <-> Backend` y ejecutan lógica de negocio real, con la única salvedad de que los servicios externos (PJN y Generador PDF) están mockeados para facilitar el desarrollo y la demostración inmediata.
