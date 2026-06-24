# IBM iSeries AS/400 & System/36 (S/36) Emulator Core
> Un entorno inmersivo multipropósito de simulación y entrenamiento para la plataforma de rango medio IBM i (OS/400) y heredados de System/36.
> 
> **Desarrollado y optimizado por Alberto Arce**

---

## 🎨 Resumen del Sistema

Este emulador interactivo web recrea fielmente la experiencia operativa de la icónica terminal **IBM 5250** (pantalla de fósforo verde), combinando la administración de sistemas modernos (Control Language - CL) con un entorno de compatibilidad completo para el legado de **System/36 (S/36)**. 

Cuenta con un editor **SEU (Source Entry Utility)** integrado, un intérprete de consultas **DB2 SQL**, un procesador cognitivo de ejecución de código **RPG/COBOL** alimentado por Gemini AI, y un panel de monitorización de recursos de CPU, memoria y cola de trabajos.

---

## 🚀 Características Clave

### 1. Terminal Interactiva 5250 (Consola CL / SQL)
Consola principal interactiva para la administración y control de la máquina virtual del iSeries, con soporte para:
* **WRKACTJOB**: Monitorización de trabajos interactivos y por lotes (BATCH) con uso de CPU.
* **WRKMBRPDM / PDM**: Gestor de desarrollo de miembros fuente para editar y compilar.
* **STRSQL**: Consola interactiva DB2/400 para realizar consultas, inserciones y actualizaciones.
* **DSPPFM FILE(nombre)**: Visualizador dinámico de archivos físicos a nivel de registro.
* **STRS36**: Comando clave para activar la emulación System/36.

### 2. Emulación Integrada System/36 (`STRS36`)
Al ejecutar el mandato `STRS36` en la consola, el procesador conmuta al modo de compatibilidad heredada del System/36, habilitando el **Operator Control Language (OCL)** y simulando un microprocesador virtual. Los comandos de OCL disponibles son:
* `HELP`: Despliega la guía de referencia rápida de mandatos de S/36.
* `STATUS`: Consulta de recursos asignados, sectores libres en disco y estado de CPU de S/36.
* `FLIB [librería]`: Cambia la biblioteca de trabajo actual del entorno virtual.
* `BLDLIBR [nombre]`: Crea un nuevo sector o librería de S/36.
* `LISTLIBR`: Lista detallada de programas cargados, miembros, su tipo, tamaño en sectores y atribución de autoría.
* `LOAD [programa]`: Prepara e introduce un programa de RPG o COBOL compilado en la RAM virtualizada.
* `RUN`: Inicia la ejecución semántica secuencial del programa cargado a través del procesador emulado.
* `FREE [programa]`: Descarga y libera los recursos asignados del programa en memoria.
* `SST`: Inicia las System Service Tools virtuales para el análisis de sectores de hardware del puente.
* `ENDS36` u `OFF`: Apaga el subsistema S/36 y regresa inmediatamente al Control Language (CL) nativo de OS/400.

### 3. Editor de Fuentes SEU (Source Entry Utility)
* Editor clásico de formato rígido para la programación estructurada en **RPG (Report Program Generator)** y **COBOL**.
* Compilador cognitivo integrado que envía el fuente a una máquina virtual inteligente para verificar la sintaxis, emitir reportes de compilación detallados en formato SPOOL de impresión e interpretar la ejecución semántica de variables.

### 4. Gestor de Archivos Físicos (DB2/400)
* Base de datos simulada con soporte de definición de esquemas de registro (DDS).
* Inserción, borrado y consulta en tiempo real mediante sentencias de SQL estándar de base de datos relacional.

---

## 🛠️ Tecnologías Utilizadas

* **Frontend:** React 18, Vite, Tailwind CSS para el renderizado del estilo retro, Lucide React para iconografía de control y Framer Motion para transiciones suaves de terminal.
* **Backend / VM:** Servidor Express.js en Node.js que procesa e interpreta lógicamente la ejecución de hilos de RPG y COBOL.
* **Motor de IA:** SDK `@google/genai` utilizando la tecnología de Gemini 3.5 para la compilación cognitiva semántica y depuración de lógica legacy.

---

## 📦 Instalación y Despliegue Local

Sigue estos sencillos pasos para clonar el repositorio e iniciar la terminal en tu máquina local:

```bash
# 1. Clonar el repositorio oficial de Alberto Arce
git clone https://github.com/alberto-arce/iseries-as400-s36-emulator.git
cd iseries-as400-s36-emulator

# 2. Instalar dependencias del proyecto
npm install

# 3. Lanzar el servidor de desarrollo de alta velocidad (Vite + Express)
npm run dev

# 4. Compilar optimizado para producción (Cloud Run, Docker, etc.)
npm run build
npm start
```

---

## 👨‍💻 Autoría y Contribuciones

* **Creador Principal:** [Alberto Arce](mailto:alberto.arce.ti@gmail.com)
* **Licencia:** MIT - Siéntete libre de modificar, contribuir o bifurcar este proyecto para propósitos de capacitación y rescate de sistemas heredados de rango medio de IBM.

---
*Este emulador ha sido diseñado buscando la máxima fidelidad operativa del mainframe con fines académicos y de desarrollo ágil.*
