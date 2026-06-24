import { SourceMember, DBFile, TutorialMission, ActiveJob, SystemMessage } from "./types";

export const INITIAL_MEMBERS: SourceMember[] = [
  {
    name: "SALUDOCOB",
    type: "COBOL",
    srcFile: "QCBLSRC",
    code: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. SALUDOCOB.
       AUTHOR. ALBERTO.

       ENVIRONMENT DIVISION.
       CONFIGURATION SECTION.

       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 NOMBRE PIC X(15) VALUE "ALBERTO ARCE".
       01 SALUDO PIC X(30) VALUE "BIENVENIDO AL AS400 EMULATOR".

       PROCEDURE DIVISION.
           DISPLAY "========================================".
           DISPLAY SALUDO.
           DISPLAY "PROCESANDO INTEGRACION CON LEGACY...".
           DISPLAY "HOLA, " NOMBRE "!".
           DISPLAY "SISTEMA OPERATIVO OS/400 EMULADO OK.".
           DISPLAY "========================================".
           GOBACK.`,
    compiled: false
  },
  {
    name: "CALCULAD",
    type: "COBOL",
    srcFile: "QCBLSRC",
    code: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. CALCULAD.
       
       DATA DIVISION.
       WORKING-STORAGE SECTION.
       01 PRECIO        PIC 9(5)V99 VALUE 150.00.
       01 IMPUESTO      PIC 9(3)V99 VALUE 0.21.
       01 TOTAL         PIC 9(6)V99 VALUE 0.00.
       01 CLIENTE-NOM   PIC X(20) VALUE "CLIENTE GENERAL".

       PROCEDURE DIVISION.
           DISPLAY "--- LIQUIDACION DE COMPRA ---".
           COMPUTE TOTAL = PRECIO + (PRECIO * IMPUESTO).
           DISPLAY "CLIENTE: " CLIENTE-NOM.
           DISPLAY "SUBTOTAL: " PRECIO.
           DISPLAY "TOTAL CON IMPUESTO: " TOTAL.
           
           * Guardamos simulación de escritura
           WRITE QUSERPF.
           
           GOBACK.`,
    compiled: false
  },
  {
    name: "PROGRPG3",
    type: "RPG",
    srcFile: "QRPGSRC",
    code: `     *----------------------------------------------------------------
     * PROGRAMA RPG III CLASICO - CONSULTA DE CLIENTES
     *----------------------------------------------------------------
     FQUSERPF  IF   E           K DISK
     D* Definicion de Variables
     D NOMBRE          S             15A   INZ('QSECOFR')
     D MENSAJE         S             25A   INZ('INICIANDO PROCESO RPG...')
     D LIMITE          S              5I 0 INZ(500)
     *
     C     *ENTRY        PLIST
     C                   PARM                    NOMBRE
     *
     C                   DSPLY                   MENSAJE
     C                   DSPLY                   'CONSULTANDO PARAMETRO:'
     C                   DSPLY                   NOMBRE
     * Realizamos calculo
     C     LIMITE        MULT      1.10          NUEVOLIM          5 0
     C                   DSPLY                   'NUEVO LIMITE CREDITO:'
     C                   DSPLY                   NUEVOLIM
     *
     C                   SETON                                        LR`,
    compiled: false
  },
  {
    name: "RPGIVFREE",
    type: "RPG",
    srcFile: "QRPGSRC",
    code: `**FREE
//----------------------------------------------------------------
// PROGRAMA RPG IV MODERN FREE-FORM - SIMULACION REGISTRO
//----------------------------------------------------------------
ctl-opt dftactgrp(*no) actgrp('QILE');

dcl-s usuario char(10) inz('QSECOFR');
dcl-s cant_reg packed(5:0) inz(12);
dcl-s mensaje char(30);

mensaje = 'CONEXION CON DB2 COMPLETA';
dsply mensaje;

cant_reg = cant_reg + 1;
dsply 'CANTIDAD ACTUALIZADA DE TRABAJOS:';
dsply cant_reg;

// Registro en el archivo de logs
write QRPGPF;

return;`,
    compiled: false
  }
];

export const INITIAL_DB_FILES: DBFile[] = [
  {
    name: "QUSERPF",
    schema: ["ID", "NAME", "DATETIME"],
    records: [
      { ID: 101, NAME: "ALBERTO ARCE", DATETIME: "2026-06-23 10:15:00" },
      { ID: 102, NAME: "JUAN SANDOVAL", DATETIME: "2026-06-23 11:30:22" },
      { ID: 103, NAME: "MARIA GOMEZ", DATETIME: "2026-06-23 12:05:45" },
      { ID: 104, NAME: "QSECOFR SUPER", DATETIME: "2026-06-23 14:00:00" }
    ]
  },
  {
    name: "QRPGPF",
    schema: ["ID", "VALUE", "DATETIME"],
    records: [
      { ID: 201, VALUE: 1500.00, DATETIME: "2026-06-23 09:00:10" },
      { ID: 202, VALUE: 2450.50, DATETIME: "2026-06-23 15:40:00" }
    ]
  }
];

export const INITIAL_JOBS: ActiveJob[] = [
  { id: "J001", name: "QINTER", type: "INTERACTIVE", user: "QSECOFR", status: "RUN", cpu: 0.5, function: "DSPSYS" },
  { id: "J002", name: "QBATCH", type: "BATCH", user: "QSYS", status: "CND", cpu: 0.0, function: "PGM-QCMD" },
  { id: "J003", name: "SYSCOMP", type: "BATCH", user: "ALBERTO", status: "RUN", cpu: 1.2, function: "PGM-CRTRPG" },
  { id: "J004", name: "DB2DSYN", type: "BATCH", user: "QSYS", status: "RUN", cpu: 0.8, function: "IDX-REBLD" }
];

export const INITIAL_MESSAGES: SystemMessage[] = [
  { id: "M001", timestamp: "2026-06-23 21:00:00", type: "INFO", sender: "QSYS", text: "Subsistema QINTER iniciado en pool de memoria principal." },
  { id: "M002", timestamp: "2026-06-23 21:05:00", type: "INFO", sender: "QSYS", text: "La base de datos relacional DB2/400 está lista para recibir conexiones locales." },
  { id: "M003", timestamp: "2026-06-23 21:10:00", type: "WARNING", sender: "QSECOFR", text: "Alerta: Verificando compatibilidad de compilador RPG III posicional." }
];

export const TUTORIAL_MISSIONS: TutorialMission[] = [
  {
    id: "M_COB_1",
    title: "Hola Mundo en COBOL-400",
    difficulty: "Básico",
    description: "Aprende a escribir, compilar y ejecutar un programa interactivo simple en COBOL-400 para desplegar un saludo por la terminal.",
    language: "COBOL",
    objectives: [
      "Abre el miembro SALUDOCOB en el editor SEU.",
      "Revisa la estructura obligatoria de DIVISIONES de COBOL.",
      "Compila el programa usando la opción 14 en PDM o el comando 'CRTCBLPGM PGM(SALUDOCOB)'.",
      "Ejecuta el programa con 'CALL PGM(SALUDOCOB)' en la consola y observa el saludo."
    ],
    templateCode: `       IDENTIFICATION DIVISION.
       PROGRAM-ID. HOLAMUNDO.
       AUTHOR. ALBERTO.

       PROCEDURE DIVISION.
           DISPLAY "HOLA MUNDO DESDE EL COBOL DE LA ISERIES AS400!".
           DISPLAY "CAPACITACION Y ENTRENAMIENTO COMPLETO COGNITIVO.".
           GOBACK.`,
    srcFile: "QCBLSRC",
    memberName: "HOLAMUNDO",
    hints: [
      "Recuerda que en COBOL las líneas deben respetar los márgenes tradicionales (Área A y Área B).",
      "Cada instrucción debe finalizar con un punto (.) para evitar errores de sintaxis."
    ]
  },
  {
    id: "M_RPG_1",
    title: "RPG IV Free-Form y DB2/400",
    difficulty: "Intermedio",
    description: "Crea un programa RPG IV moderno en modo Free-form que interactúe con el archivo físico QRPGPF sumando transacciones.",
    language: "RPG",
    objectives: [
      "Crea un miembro nuevo llamado CARGARPG en QRPGSRC de tipo RPG.",
      "Escribe un script en formato libre (**FREE) que defina variables y use WRITE para registrar datos.",
      "Compíla con 'CRTRPGPGM PGM(CARGARPG)'.",
      "Ejecuta el CALL y usa 'DSPPFM FILE(QRPGPF)' para verificar la base de datos."
    ],
    templateCode: `**FREE
// Programa de entrenamiento RPG IV moderno
ctl-opt dftactgrp(*no);

dcl-s d_monto packed(7:2) inz(350.75);
dcl-s d_descr char(20) inz('COMPRA CURSO');

dsply 'INICIANDO INSERCION DE MONTO...';
dsply d_descr;

// Escribe un registro en QRPGPF
write QRPGPF;

dsply 'PROCESO FINALIZADO CON EXITO.';
return;`,
    srcFile: "QRPGSRC",
    memberName: "CARGARPG",
    hints: [
      "**FREE debe estar en la primerísima línea del código RPG.",
      "Usa la sintaxis 'write NOMBRE_TABLA' para registrar cambios en los Physical Files."
    ]
  },
  {
    id: "M_CL_1",
    title: "Control Language (CL) y Trabajo",
    difficulty: "Básico",
    description: "Familiarízate con los mandatos CL de iSeries para gestionar trabajos activos y monitorizar el sistema.",
    language: "CL",
    objectives: [
      "Escribe comandos directos en la línea de comandos interactiva de AS/400.",
      "Usa 'WRKACTJOB' para ver la carga de CPU y subsistemas.",
      "Ejecuta 'DSPPFM FILE(QUSERPF)' para hacer un dump de los registros de usuarios.",
      "Envía un mensaje al sistema con 'SNDMSG MSG('Test')' o simula su cola."
    ],
    templateCode: `/* Comandos CL de Prueba */
SNDMSG MSG('Iniciando prueba del subsistema') TOUSR(*SYSOPR)
DSPPFM FILE(QUSERPF)
WRKACTJOB`,
    srcFile: "QCLSRC",
    memberName: "PROBANDO",
    hints: [
      "Los comandos CL son el lenguaje de control del iSeries. No requieren compilación para probarse si se ejecutan directo en la línea de mandatos.",
      "Escribe 'WRKMBRPDM' en la consola principal para ir directo al gestor de desarrollo."
    ]
  },
  {
    id: "M_DB2_1",
    title: "Gestión de Datos y Programación RPG",
    difficulty: "Avanzado",
    description: "Aprende a analizar estructuras físicas y lógicas con DSPDBR, DSPFD, DSPFFD, buscar texto con FNDSTRPDM, copiar archivos con CPYF, y consultar el manual de RPG.",
    language: "RPG",
    objectives: [
      "Ejecuta 'DSPDBR FILE(QUSERPF)' para visualizar las relaciones lógicas.",
      "Ejecuta 'DSPFD FILE(QUSERPF)' para analizar la descripción del archivo físico.",
      "Ejecuta 'DSPFFD FILE(QUSERPF)' para inspeccionar el búfer de campos.",
      "Usa 'FNDSTRPDM SALUDO' para buscar coincidencias de texto en el código fuente.",
      "Usa 'CPYF FROMFILE(QUSERPF) TOFILE(QUSERPF_RESP)' para crear un respaldo físico.",
      "Escribe 'DSPRPG' y navega por el manual interactivo de hojas, ciclo y SETLL."
    ],
    templateCode: `/* Comandos de Análisis DB2 y RPG */
DSPDBR FILE(QUSERPF)
DSPFD FILE(QUSERPF)
DSPFFD FILE(QUSERPF)
FNDSTRPDM SALUDO
CPYF FROMFILE(QUSERPF) TOFILE(QUSERPF_RESP)
DSPRPG`,
    srcFile: "QCLSRC",
    memberName: "MANEJODB2",
    hints: [
      "Los mandatos DSPDBR, DSPFD y DSPFFD proporcionan el catálogo de metadatos más completo de DB2/400.",
      "Usa CPYF para duplicar tablas completas o añadir registros de datos entre bibliotecas de iSeries.",
      "Escribe DSPRPG seguido de un capítulo (1, 2, 3 o 4) para estudiar temas específicos como el ciclo de lógica y la instrucción SETLL."
    ]
  }
];
