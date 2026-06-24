import React, { useState, useEffect, useRef } from "react";
import { 
  Terminal, 
  Database, 
  BookOpen, 
  FileCode, 
  Settings, 
  Cpu, 
  Play, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  ChevronRight, 
  AlertTriangle,
  Lightbulb, 
  Info, 
  ArrowRight,
  Code,
  HelpCircle,
  Clock,
  ExternalLink
} from "lucide-react";
import { SourceMember, DBFile, ActiveJob, SystemMessage, TutorialMission } from "./types";
import { INITIAL_MEMBERS, INITIAL_DB_FILES, INITIAL_JOBS, INITIAL_MESSAGES, TUTORIAL_MISSIONS } from "./data";

export default function App() {
  // System State
  const [members, setMembers] = useState<SourceMember[]>(INITIAL_MEMBERS);
  const [dbFiles, setDbFiles] = useState<DBFile[]>(INITIAL_DB_FILES);
  const [jobs, setJobs] = useState<ActiveJob[]>(INITIAL_JOBS);
  const [messages, setMessages] = useState<SystemMessage[]>(INITIAL_MESSAGES);
  const [systemStatus, setSystemStatus] = useState({
    status: "ONLINE",
    operatingSystem: "OS/400 V5R4M0",
    systemName: "PUB400-LCL",
    compilerMode: "OFFLINE_DETERMINISTIC",
    localTime: new Date().toISOString()
  });

  // Navigation / UI State
  // 1 = Main 5250 Terminal, 2 = SEU Editor, 3 = DB2 Database, 4 = Training Missions, 5 = Legacy Bridge, 6 = Acerca de / GitHub README
  const [activeTab, setActiveTab] = useState<number>(1);
  const [currentUser, setCurrentUser] = useState<string>("QSECOFR");
  const [isLoggedOn, setIsLoggedOn] = useState<boolean>(false);
  const [loginUser, setLoginUser] = useState<string>("QSECOFR");
  const [loginPassword, setLoginPassword] = useState<string>("QSECOFR");
  const [loginProgram, setLoginProgram] = useState<string>("");
  const [loginMenu, setLoginMenu] = useState<string>("MAIN");
  const [loginLibrary, setLoginLibrary] = useState<string>("QGPL");
  const [loginError, setLoginError] = useState<string>("");
  const [userProfiles, setUserProfiles] = useState<string[]>(["QSECOFR", "QSYSOPR", "QSYS", "QUSER", "DEVELOPER", "ALBERTO"]);
  const [libraryList, setLibraryList] = useState<string[]>(["QSYS", "QGPL", "QTEMP"]);
  const [s36Mode, setS36Mode] = useState<boolean>(false);
  const [s36CurrentLib, setS36CurrentLib] = useState<string>("SYSTEM36");
  const [s36LoadedProgram, setS36LoadedProgram] = useState<string | null>(null);
  const [terminalInput, setTerminalInput] = useState<string>("");
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([
    "SISTEMA OPERATIVO IBM OS/400 V5R4M0 INICIADO CORRECTAMENTE.",
    "LICENCIA DE SOFTWARE (C) COPYRIGHT IBM CORP. 1980, 2026.",
    "EL ENTORNO DE ENTRENAMIENTO LOCAL AS/400 ESTÁ LISTO.",
    "Escriba 'HELP' o use el menú superior para ver comandos disponibles.",
    "===>"
  ]);

  // Editor State
  const [selectedMember, setSelectedMember] = useState<SourceMember>(INITIAL_MEMBERS[0]);
  const [editorCode, setEditorCode] = useState<string>(INITIAL_MEMBERS[0].code);
  const [compileOutput, setCompileOutput] = useState<{
    status: "IDLE" | "SUCCESS" | "ERROR" | "COMPILING";
    message: string;
    errors: string[];
    variables?: Record<string, any>;
  }>({ status: "IDLE", message: "", errors: [] });

  // Execution View State
  const [executionLog, setExecutionLog] = useState<string[]>([]);
  const [executionDetails, setExecutionDetails] = useState<string>("");
  const [isExecuting, setIsExecuting] = useState<boolean>(false);

  // Tutorial / Mission State
  const [activeMission, setActiveMission] = useState<TutorialMission | null>(null);
  const [missionObjectivesProgress, setMissionObjectivesProgress] = useState<boolean[]>([false, false, false, false]);

  // AI Tutor state
  const [tutorQuestion, setTutorQuestion] = useState<string>("");
  const [tutorAnswer, setTutorAnswer] = useState<string>("");
  const [tutorLoading, setTutorLoading] = useState<boolean>(false);

  // References
  const terminalBottomRef = useRef<HTMLDivElement>(null);
  const terminalInputRef = useRef<HTMLInputElement>(null);

  // Live clock and initial sync
  useEffect(() => {
    // Check real status from API on mount
    fetchSystemStatus();

    const timer = setInterval(() => {
      setSystemStatus(prev => ({
        ...prev,
        localTime: new Date().toISOString()
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Sync editor when selected member changes
  useEffect(() => {
    setEditorCode(selectedMember.code);
    setCompileOutput({ status: "IDLE", message: "", errors: [] });
  }, [selectedMember]);

  // Auto-scroll terminal logs
  useEffect(() => {
    if (terminalBottomRef.current) {
      terminalBottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [terminalLogs]);

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch("/api/as400/status");
      if (res.ok) {
        const data = await res.json();
        setSystemStatus(prev => ({
          ...prev,
          compilerMode: data.compilerMode,
          operatingSystem: data.operatingSystem,
          systemName: data.systemName
        }));
      }
    } catch (e) {
      console.warn("Could not reach API status. Running in pure offline fallback mode.");
    }
  };

  // Process CL (Control Language) command
  const executeCLCommand = async (cmdString: string) => {
    const trimmed = cmdString.trim();
    if (!trimmed) return;

    // Save history
    const newHistory = [trimmed, ...commandHistory];
    setCommandHistory(newHistory);
    setHistoryIndex(-1);

    // New log entries
    const logs = [...terminalLogs];
    // Remove the last prompt line temporary to insert output
    if (logs[logs.length - 1] === "===>" || logs[logs.length - 1] === "S36 ===>") {
      logs.pop();
    }
    logs.push(`${s36Mode ? "S36 ===>" : "===>"} ${trimmed}`);

    const upperCmd = trimmed.toUpperCase();

    // S/36 Environment commands parser
    if (s36Mode) {
      if (upperCmd === "ENDS36" || upperCmd === "OFF") {
        setS36Mode(false);
        logs.push("[S/36] Saliendo del entorno de compatibilidad System/36...");
        logs.push("[S/36] Desconectando procesador virtual S/36...");
        logs.push("[S/36] Volviendo al entorno de control nativo OS/400 (CL).");
      }
      else if (upperCmd === "HELP") {
        logs.push("=================== MANDATOS SYSTEM/36 EMULADOS ===================");
        logs.push("  FLIB [lib]      - Asignar la biblioteca de trabajo actual (S/36 Library)");
        logs.push("  BLDLIBR [lib]   - Crear una nueva librería simulada de S/36");
        logs.push("  LISTLIBR        - Listar los miembros y programas cargados en S/36");
        logs.push("  LOAD [pgm]      - Cargar un programa en el procesador virtual S/36");
        logs.push("  RUN             - Ejecutar el programa cargado actualmente en memoria");
        logs.push("  STATUS          - Consultar el estado de recursos, memoria y CPU S/36");
        logs.push("  FREE [pgm]      - Liberar memoria o descargar un programa de ejecución");
        logs.push("  SST             - Ejecutar System Service Tools para depurar el puente");
        logs.push("  ENDS36 / OFF    - Salir del entorno System/36 y volver a CL");
        logs.push("==================================================================");
      }
      else if (upperCmd.startsWith("FLIB ")) {
        const lib = trimmed.substring(5).trim().toUpperCase();
        setS36CurrentLib(lib);
        logs.push(`[S/36] Biblioteca de trabajo modificada a: ${lib}`);
      }
      else if (upperCmd.startsWith("BLDLIBR ")) {
        const lib = trimmed.substring(8).trim().toUpperCase();
        logs.push(`[S/36] Creando librería S/36: ${lib}...`);
        logs.push(`[S/36] Librería ${lib} creada con éxito en el sector virtual de System/36.`);
      }
      else if (upperCmd === "LISTLIBR") {
        logs.push(`================ CONTENIDO LIBRERÍA: ${s36CurrentLib} ================`);
        logs.push("Miembro      Tipo      S/36 Atributo   Tamaño (Sectores)   Autor");
        logs.push("----------   -------   -------------   -----------------   ------------");
        members.forEach(m => {
          const s36Attr = m.type === "RPG" ? "RPG36" : m.type === "COBOL" ? "COB36" : "CL36";
          const sectors = Math.floor(Math.random() * 80) + 20;
          logs.push(`${m.name.padEnd(12)} ${m.type.padEnd(9)} ${s36Attr.padEnd(15)} ${String(sectors).padEnd(19)} Alberto Arce`);
        });
        logs.push(`================ TOTAL MIEMBROS EN S/36 LIBR: ${members.length} ================`);
      }
      else if (upperCmd.startsWith("LOAD ")) {
        const pgm = trimmed.substring(5).trim().toUpperCase();
        const memberExists = members.find(m => m.name === pgm);
        if (memberExists) {
          setS36LoadedProgram(pgm);
          logs.push(`[S/36] Programa '${pgm}' cargado exitosamente en el procesador virtual.`);
          logs.push(`[S/36] Listo para ejecutarse con el comando 'RUN'.`);
        } else {
          logs.push(`[S/36 ERROR] No se encontró el miembro de programa '${pgm}' para ser cargado.`);
        }
      }
      else if (upperCmd === "RUN") {
        if (s36LoadedProgram) {
          logs.push(`[S/36] Iniciando ejecución de programa S/36: ${s36LoadedProgram}...`);
          const member = members.find(m => m.name === s36LoadedProgram);
          if (member) {
            logs.push(`--- INICIO EJECUCIÓN EMULADOR S/36 (PRG: ${s36LoadedProgram}) ---`);
            setIsExecuting(true);
            try {
              const response = await fetch("/api/as400/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  code: member.code,
                  type: member.type,
                  variables: member.variables || {},
                  dbFiles: dbFiles,
                  memberName: s36LoadedProgram
                })
              });

              if (response.ok) {
                const data = await response.json();
                if (data.outputs && Array.isArray(data.outputs)) {
                  data.outputs.forEach((o: string) => logs.push(`[S/36 OUT] ${o}`));
                }
                if (data.dbUpdates && Array.isArray(data.dbUpdates)) {
                  applyDatabaseUpdates(data.dbUpdates);
                }
                if (data.explanation) {
                  logs.push(`[S/36 EXPLICACIÓN] ${data.explanation}`);
                }
                logs.push(`--- PROGRAMA S/36 TERMINÓ NORMALMENTE ---`);
              } else {
                logs.push("[S/36 ERROR] No se pudo interpretar la ejecución S/36.");
              }
            } catch (err: any) {
              logs.push(`[S/36 ERROR] Fallo en la comunicación con la máquina virtual S/36: ${err.message}`);
            }
            setIsExecuting(false);
          }
        } else {
          logs.push("[S/36 ERROR] No hay ningún programa cargado en memoria. Use 'LOAD [nombre]' primero.");
        }
      }
      else if (upperCmd === "STATUS") {
        logs.push("================ ESTADO DEL SUBSISTEMA VIRTUAL SYSTEM/36 ================");
        logs.push(`  Librería Activa (FLIB):   ${s36CurrentLib}`);
        logs.push(`  Programa en Memoria:      ${s36LoadedProgram || "NINGUNO"}`);
        logs.push(`  Estado de Procesador S/36: ACTIVE (Emulando Motorola 68000 / IBM S/36 CPU)`);
        logs.push(`  Autor del Emulador S/36:  ALBERTO ARCE`);
        logs.push(`  Espacio libre en disco:   14,240 Sectores`);
        logs.push(`  Compatibilidad RPG II/III: ACTIVA`);
        logs.push(`  Cola de Trabajos S/36:     S36JOBQ (0 trabajos pendientes)`);
        logs.push("=========================================================================");
      }
      else if (upperCmd.startsWith("FREE ")) {
        const pgm = trimmed.substring(5).trim().toUpperCase();
        if (s36LoadedProgram === pgm) {
          setS36LoadedProgram(null);
          logs.push(`[S/36] Memoria liberada. El programa '${pgm}' fue descargado.`);
        } else {
          logs.push(`[S/36] El programa '${pgm}' no está cargado en memoria.`);
        }
      }
      else if (upperCmd === "SST") {
        logs.push("================ SYSTEM SERVICE TOOLS (SST) - S/36 BRIDGE ================");
        logs.push("  1. Analizar memoria física del emulador S/36");
        logs.push("  2. Ver log de compilaciones cognitivas (Alberto Arce)");
        logs.push("  3. Configurar sockets de comunicación legacy TCP/IP");
        logs.push("  [DEPURADOR SST] Todo en orden. Todos los sectores de memoria asignados.");
        logs.push("=========================================================================");
      }
      else {
        logs.push(`[ERROR OCL S/36] Comando System/36 no reconocido: '${trimmed}'`);
        logs.push("Escriba 'HELP' para ver el listado de mandatos S/36 emulados.");
      }

      logs.push("S36 ===>");
      setTerminalLogs(logs);
      setTerminalInput("");
      return;
    }

    // 1. HELP command
    if (upperCmd === "HELP") {
      logs.push("===================== COMANDOS CL EMULADOS =====================");
      logs.push("  WRKACTJOB              - Ver los trabajos activos del sistema (CPU, memoria)");
      logs.push("  WRKMBRPDM / PDM        - Trabajar con miembros de desarrollo (COBOL/RPG)");
      logs.push("  STRSQL                 - Iniciar consulta interactiva SQL DB2/400");
      logs.push("  DSPPFM FILE(Nombre)    - Mostrar contenido de un Archivo Físico");
      logs.push("  DSPDBR FILE(Nombre)    - Mostrar relaciones de archivos de base de datos");
      logs.push("  DSPFD FILE(Nombre)     - Mostrar descripción del archivo físico/lógico");
      logs.push("  DSPFFD FILE(Nombre)    - Mostrar descripción detallada de campos del archivo");
      logs.push("  FNDSTRPDM 'cadena'     - Buscar un texto en todos los miembros de código");
      logs.push("  CPYF FROMFILE() ...    - Copiar archivos físicos y sus registros de datos");
      logs.push("  DSPRPG                 - Mostrar Manual RPG (Hojas H/F/E/I/C, Ciclo, SETLL)");
      logs.push("  CALL PGM(Nombre)       - Ejecutar un programa compilado");
      logs.push("  SNDMSG MSG('...')      - Enviar un mensaje al operador del sistema (QSYSOPR)");
      logs.push("  STRS36                 - Iniciar Entorno de Compatibilidad System/36 (S/36)");
      logs.push("  SIGNOFF / BYE          - Cambiar de usuario / Reiniciar sesión");
      logs.push("  CLEAR                  - Limpiar la pantalla de la terminal");
      logs.push("================================================================");
    } 
    else if (upperCmd === "STRS36") {
      setS36Mode(true);
      logs.push("===============================================================================");
      logs.push("                     INICIANDO ENTORNO SYSTEM/36 EMULADO                       ");
      logs.push("                             OS/400 S/36 ENVIRONMENT                           ");
      logs.push("===============================================================================");
      logs.push("  Entorno de compatibilidad S/36 activado.");
      logs.push("  Desarrollado y optimizado por Alberto Arce.");
      logs.push("  Utilice mandatos OCL y operaciones de operador de System/36.");
      logs.push("  Escriba 'HELP' o 'STATUS' para consultar detalles del entorno S/36.");
      logs.push("  Escriba 'ENDS36' o 'OFF' para salir y regresar al entorno nativo CL de AS/400.");
      logs.push("===============================================================================");
      logs.push("S36 ===>");
      setTerminalLogs(logs);
      setTerminalInput("");
      return;
    }
    // 2. WRKACTJOB command
    else if (upperCmd === "WRKACTJOB") {
      logs.push("Trabajo      Usuario    Tipo         Estado   % CPU    Función");
      logs.push("----------   ---------- ----------   ------   ------   ---------");
      jobs.forEach(j => {
        const pad = (str: string, len: number) => str.padEnd(len).substring(0, len);
        logs.push(`${pad(j.name, 12)} ${pad(j.user, 10)} ${pad(j.type, 12)} ${pad(j.status, 8)} ${pad(j.cpu.toFixed(1) + "%", 8)} ${pad(j.function, 10)}`);
      });
      logs.push("Consumo total CPU simulado: " + jobs.reduce((acc, curr) => acc + curr.cpu, 0).toFixed(1) + "%");
      
      // Complete objective check if in mission
      checkMissionObjectives("WRKACTJOB");
    } 
    // 3. WRKMBRPDM or PDM
    else if (upperCmd === "WRKMBRPDM" || upperCmd === "PDM") {
      logs.push("[SISTEMA] Abriendo Administrador de Miembros de Programación PDM.");
      setActiveTab(2); // Jump to SEU/PDM
      checkMissionObjectives("WRKMBRPDM");
    }
    // 4. STRSQL
    else if (upperCmd === "STRSQL") {
      logs.push("=================== SESIÓN SQL INTERACTIVA DB2 ==================");
      logs.push("Escriba 'SELECT * FROM QUSERPF' o 'SELECT * FROM QRPGPF'");
      logs.push("o 'INSERT INTO QUSERPF (ID, NAME, DATETIME) VALUES (105, \"ALEX\", \"2026-06-23 21:00:00\")'");
      logs.push("Escriba 'EXIT' para salir de SQL.");
      logs.push("================================================================");
    }
    // Handle SQL Statements in interactive screen or nested
    else if (upperCmd.startsWith("SELECT ") || upperCmd.startsWith("INSERT ") || upperCmd.startsWith("UPDATE ")) {
      try {
        if (upperCmd.startsWith("SELECT")) {
          // Mock SELECT parser
          const tableMatch = upperCmd.match(/FROM\s+([A-Za-z0-9_]+)/i);
          if (tableMatch) {
            const tableName = tableMatch[1].toUpperCase();
            const foundTable = dbFiles.find(t => t.name === tableName);
            if (foundTable) {
              logs.push(`--- ARCHIVO FÍSICO: ${tableName} ---`);
              // Column headers
              logs.push(foundTable.schema.map(col => col.padEnd(15)).join(" "));
              logs.push("-".repeat(foundTable.schema.length * 16));
              // Records
              foundTable.records.forEach(r => {
                logs.push(foundTable.schema.map(col => String(r[col] || "").padEnd(15)).join(" "));
              });
              logs.push(`(${foundTable.records.length} registros seleccionados de DB2/400)`);
            } else {
              logs.push(`[SQL ERROR] Archivo físico '${tableName}' no existe en la biblioteca QGPL.`);
            }
          } else {
            logs.push("[SQL ERROR] Sintaxis incorrecta. Ejemplo: SELECT * FROM QUSERPF");
          }
        } else if (upperCmd.startsWith("INSERT")) {
          // Mock INSERT parser
          // INSERT INTO QUSERPF (ID, NAME, DATETIME) VALUES (105, 'JUAN', '2026-06-23')
          const tableMatch = upperCmd.match(/INSERT\s+INTO\s+([A-Za-z0-9_]+)/i);
          const valuesMatch = upperCmd.match(/VALUES\s*\((.*?)\)/i);
          if (tableMatch && valuesMatch) {
            const tableName = tableMatch[1].toUpperCase();
            const valStr = valuesMatch[1];
            const cleanVals = valStr.split(",").map(v => v.trim().replace(/['"]/g, ""));
            
            const updatedFiles = dbFiles.map(f => {
              if (f.name === tableName) {
                const newRecord: any = {};
                f.schema.forEach((col, idx) => {
                  newRecord[col] = cleanVals[idx] || (col === "ID" ? Math.floor(Math.random() * 500) : "N/A");
                });
                return {
                  ...f,
                  records: [...f.records, newRecord]
                };
              }
              return f;
            });
            setDbFiles(updatedFiles);
            logs.push(`[SQL SUCCESS] 1 registro insertado en archivo físico ${tableName}.`);
            
            // Add a dynamic interactive job log
            addActiveJob("SQL-INS", "QSECOFR", "RUN", 1.5, `INS-${tableName}`);
          } else {
            logs.push("[SQL ERROR] Sintaxis de INSERT no soportada. Use: INSERT INTO TABLA VALUES (ID, NOMBRE, FECHA)");
          }
        }
      } catch (err: any) {
        logs.push(`[SQL EXCEPTION] Error analizando sentencia: ${err.message}`);
      }
    }
    // 5. DSPPFM command
    else if (upperCmd.startsWith("DSPPFM ")) {
      const match = trimmed.match(/DSPPFM\s+FILE\((.*?)\)/i);
      const filename = match ? match[1].toUpperCase() : trimmed.substring(7).trim().toUpperCase();
      
      const file = dbFiles.find(f => f.name === filename);
      if (file) {
        logs.push(`================ MEMBRO FISICO: ${filename} ================`);
        logs.push(`Formato Registro: ${file.schema.join(", ")}`);
        logs.push("-".repeat(60));
        file.records.forEach((r, i) => {
          const content = Object.values(r).join(" | ");
          logs.push(`${String(i+1).padStart(4, "0")}  ${content}`);
        });
        logs.push(`=============== FIN DEL MIEMBRO (REGISTROS: ${file.records.length}) ===============`);
        
        checkMissionObjectives("DSPPFM");
      } else {
        logs.push(`[ERROR CL] El archivo físico '${filename}' no existe en la biblioteca de pruebas.`);
      }
    }
    // DSPDBR command - Relaciones de base de datos
    else if (upperCmd.startsWith("DSPDBR")) {
      const match = trimmed.match(/FILE\((.*?)\)/i);
      const filename = match ? match[1].toUpperCase() : trimmed.substring(6).trim().toUpperCase();
      
      if (!filename) {
        logs.push("================ RELACIONES DE BASE DE DATOS (DSPDBR) ================");
        logs.push("Uso: DSPDBR FILE(nombre_archivo)");
        logs.push("Ejemplo: DSPDBR FILE(QUSERPF)");
        logs.push("Muestra las dependencias lógicas y físicas de un archivo.");
        logs.push("======================================================================");
      } else {
        const fileExists = dbFiles.some(f => f.name === filename) || filename === "QUSERLF" || filename === "QRPGLF";
        if (fileExists) {
          logs.push("================ RELACIONES DE BASE DE DATOS (DSPDBR) ================");
          logs.push(`Archivo principal consultado . . . . : QGPL/${filename}`);
          logs.push("Biblioteca . . . . . . . . . . . . . : QGPL");
          logs.push("");
          if (filename === "QUSERPF") {
            logs.push("Archivos lógicos dependientes registrados:");
            logs.push("Librería     Archivo lógico     Tipo        Clave de acceso     Estado");
            logs.push("----------   --------------     ---------   ---------------     -------");
            logs.push("QGPL         QUSERLF            LOGICAL     ID (Ascendente)     ACTIVO");
          } else if (filename === "QRPGPF") {
            logs.push("Archivos lógicos dependientes registrados:");
            logs.push("Librería     Archivo lógico     Tipo        Clave de acceso     Estado");
            logs.push("----------   --------------     ---------   ---------------     -------");
            logs.push("QGPL         QRPGLF             LOGICAL     ID (Ascendente)     ACTIVO");
          } else {
            logs.push("No hay archivos lógicos dependientes registrados para este archivo físico.");
          }
          logs.push("======================================================================");
          checkMissionObjectives("DSPDBR");
        } else {
          logs.push(`[ERROR CL] El archivo '${filename}' no existe en la biblioteca de pruebas.`);
        }
      }
    }
    // DSPFD command - Descripción de archivo
    else if (upperCmd.startsWith("DSPFD")) {
      const match = trimmed.match(/FILE\((.*?)\)/i);
      const filename = match ? match[1].toUpperCase() : trimmed.substring(5).trim().toUpperCase();
      
      if (!filename) {
        logs.push("================ DESCRIPCIÓN DE ARCHIVO (DSPFD) ================");
        logs.push("Uso: DSPFD FILE(nombre_archivo)");
        logs.push("Ejemplo: DSPFD FILE(QUSERPF)");
        logs.push("Muestra las características físicas o lógicas del archivo.");
        logs.push("=================================================================");
      } else {
        const file = dbFiles.find(f => f.name === filename);
        if (file) {
          logs.push("================ DESCRIPCIÓN DE ARCHIVO (DSPFD) ================");
          logs.push(`Archivo . . . . . . . . . . . . . . : ${filename}`);
          logs.push("Biblioteca . . . . . . . . . . . . : QGPL");
          logs.push("Tipo de archivo . . . . . . . . . . : *PHYSICAL");
          logs.push("Atributo . . . . . . . . . . . . . : PF");
          logs.push(`Nombre de formato de registro . . . : ${filename}R`);
          logs.push(`Número de campos . . . . . . . . . : ${file.schema.length}`);
          logs.push(`Longitud de registro (bytes) . . . : ${file.schema.length * 15}`);
          logs.push("Número de miembros . . . . . . . . : 1");
          logs.push(`Miembro actual . . . . . . . . . . : ${filename}`);
          logs.push(`Número total de registros . . . . . : ${file.records.length}`);
          logs.push(`Tamaño estimado del archivo (bytes) : ${file.records.length * file.schema.length * 15}`);
          logs.push(`Ubicación en disco virtual . . . . . : SECTOR-${4096 + Math.floor(Math.random() * 200)}`);
          logs.push("Creado por usuario . . . . . . . . : ALBERTO");
          logs.push("=================================================================");
          checkMissionObjectives("DSPFD");
        } else if (filename === "QUSERLF") {
          logs.push("================ DESCRIPCIÓN DE ARCHIVO (DSPFD) ================");
          logs.push("Archivo . . . . . . . . . . . . . . : QUSERLF");
          logs.push("Biblioteca . . . . . . . . . . . . : QGPL");
          logs.push("Tipo de archivo . . . . . . . . . . : *LOGICAL");
          logs.push("Atributo . . . . . . . . . . . . . : LF");
          logs.push("Basado en archivo físico . . . . . : QUSERPF");
          logs.push("Trayectoria de acceso . . . . . . . : CON LLAVE (*KEYED)");
          logs.push("Claves especificadas . . . . . . . : ID (Ascendente)");
          logs.push("Nombre de formato de registro . . . : QUSERLFR");
          const pfFile = dbFiles.find(f => f.name === "QUSERPF");
          logs.push(`Número total de registros dependientes: ${pfFile ? pfFile.records.length : 0}`);
          logs.push("=================================================================");
          checkMissionObjectives("DSPFD");
        } else if (filename === "QRPGLF") {
          logs.push("================ DESCRIPCIÓN DE ARCHIVO (DSPFD) ================");
          logs.push("Archivo . . . . . . . . . . . . . . : QRPGLF");
          logs.push("Biblioteca . . . . . . . . . . . . : QGPL");
          logs.push("Tipo de archivo . . . . . . . . . . : *LOGICAL");
          logs.push("Atributo . . . . . . . . . . . . . : LF");
          logs.push("Basado en archivo físico . . . . . : QRPGPF");
          logs.push("Trayectoria de acceso . . . . . . . : CON LLAVE (*KEYED)");
          logs.push("Claves especificadas . . . . . . . : ID (Ascendente)");
          logs.push("Nombre de formato de registro . . . : QRPGLFR");
          const pfFile = dbFiles.find(f => f.name === "QRPGPF");
          logs.push(`Número total de registros dependientes: ${pfFile ? pfFile.records.length : 0}`);
          logs.push("=================================================================");
          checkMissionObjectives("DSPFD");
        } else {
          logs.push(`[ERROR CL] El archivo '${filename}' no existe en la biblioteca de pruebas.`);
        }
      }
    }
    // DSPFFD command - Descripción de campos de archivo
    else if (upperCmd.startsWith("DSPFFD")) {
      const match = trimmed.match(/FILE\((.*?)\)/i);
      const filename = match ? match[1].toUpperCase() : trimmed.substring(6).trim().toUpperCase();
      
      if (!filename) {
        logs.push("================ DESCRIPCIÓN DE CAMPOS DE ARCHIVO (DSPFFD) ================");
        logs.push("Uso: DSPFFD FILE(nombre_archivo)");
        logs.push("Ejemplo: DSPFFD FILE(QUSERPF)");
        logs.push("Muestra los tipos, longitudes y posiciones de los campos del archivo.");
        logs.push("===========================================================================");
      } else {
        const file = dbFiles.find(f => f.name === filename);
        if (file) {
          logs.push("================ DESCRIPCIÓN DE CAMPOS DE ARCHIVO (DSPFFD) ================");
          logs.push(`Archivo: ${filename}          Biblioteca: QGPL          Formato: ${filename}R`);
          logs.push("");
          logs.push("Campo       Tipo        Longitud  Pos. Buffer  Descripción");
          logs.push("----------  ----------  --------  -----------  ---------------------------");
          let currentPos = 1;
          file.schema.forEach(field => {
            let fieldType = "CHAR";
            let fieldLen = 15;
            let fieldDesc = "Campo de datos generales";
            
            if (field === "ID") {
              fieldType = "ZONED(5,0)";
              fieldLen = 5;
              fieldDesc = "Identificador clave numérico";
            } else if (field === "NAME" || field === "NOMBRE") {
              fieldType = "CHAR(30)";
              fieldLen = 30;
              fieldDesc = "Nombre completo del usuario";
            } else if (field === "DATETIME" || field === "FECHA") {
              fieldType = "CHAR(19)";
              fieldLen = 19;
              fieldDesc = "Fecha y hora del registro";
            } else if (field === "VALUE" || field === "VALOR") {
              fieldType = "PACKED(10,2)";
              fieldLen = 10;
              fieldDesc = "Monto numérico decimal";
            }
            
            logs.push(`${field.padEnd(10)}  ${fieldType.padEnd(10)}  ${String(fieldLen).padStart(8)}  ${String(currentPos).padStart(11)}  ${fieldDesc}`);
            currentPos += fieldLen;
          });
          logs.push("===========================================================================");
          checkMissionObjectives("DSPFFD");
        } else if (filename === "QUSERLF" || filename === "QRPGLF") {
          const basedOn = filename === "QUSERLF" ? "QUSERPF" : "QRPGPF";
          logs.push("================ DESCRIPCIÓN DE CAMPOS DE ARCHIVO (DSPFFD) ================");
          logs.push(`Archivo lógico: ${filename}   Biblioteca: QGPL          Formato: ${filename}R`);
          logs.push(`Basado en el archivo físico principal: ${basedOn}`);
          logs.push("");
          logs.push("Campo       Tipo        Longitud  Pos. Buffer  Llave de Ordenación");
          logs.push("----------  ----------  --------  -----------  -------------------");
          let currentPos = 1;
          const basedOnFile = dbFiles.find(f => f.name === basedOn);
          const fields = basedOnFile ? basedOnFile.schema : ["ID", "NAME", "DATETIME"];
          fields.forEach(field => {
            let fieldType = field === "ID" ? "ZONED(5,0)" : field === "VALUE" ? "PACKED(10,2)" : field === "DATETIME" ? "CHAR(19)" : "CHAR(30)";
            let fieldLen = field === "ID" ? 5 : field === "VALUE" ? 10 : field === "DATETIME" ? 19 : 30;
            let isKey = field === "ID" ? "*YES (Clave principal)" : "*NO";
            logs.push(`${field.padEnd(10)}  ${fieldType.padEnd(10)}  ${String(fieldLen).padStart(8)}  ${String(currentPos).padStart(11)}  ${isKey}`);
            currentPos += fieldLen;
          });
          logs.push("===========================================================================");
          checkMissionObjectives("DSPFFD");
        } else {
          logs.push(`[ERROR CL] El archivo '${filename}' no existe en la biblioteca de pruebas.`);
        }
      }
    }
    // FNDSTRPDM command - Buscar cadena en miembros
    else if (upperCmd.startsWith("FNDSTRPDM")) {
      let searchStr = "";
      const stringMatch = trimmed.match(/STRING\(['"](.*?)['"]\)/i) || trimmed.match(/STRING\((.*?)\)/i);
      
      if (stringMatch) {
        searchStr = stringMatch[1];
      } else {
        const parts = trimmed.split(/\s+/);
        if (parts.length > 1) {
          const remaining = trimmed.substring(trimmed.indexOf(parts[1]));
          searchStr = remaining.replace(/['"]/g, "").trim();
        }
      }
      
      if (!searchStr) {
        logs.push("================ BUSCAR CADENA CON PDM (FNDSTRPDM) ================");
        logs.push("Uso: FNDSTRPDM STRING('texto_buscar') FILE(QGPL/QCLSRC)");
        logs.push("O de forma abreviada: FNDSTRPDM 'texto_buscar'");
        logs.push("Busca texto o código dentro de todos los miembros fuente de la biblioteca.");
        logs.push("===================================================================");
      } else {
        logs.push("================ BUSCAR CADENA CON PDM (FNDSTRPDM) ================");
        logs.push("Biblioteca de búsqueda . . . : QGPL");
        logs.push("Archivo de código fuente . . : *ALLSRC");
        logs.push(`Cadena de búsqueda . . . . . : '${searchStr}'`);
        logs.push("");
        logs.push("Miembro     Tipo    Línea   Contenido de la línea de código");
        logs.push("----------  ------  -----   -------------------------------------------------------");
        
        let matchCount = 0;
        members.forEach(m => {
          if (m.code) {
            const lines = m.code.split("\n");
            lines.forEach((line, idx) => {
              if (line.toLowerCase().includes(searchStr.toLowerCase())) {
                const lineNum = String((idx + 1) * 10).padStart(4, "0");
                logs.push(`${m.name.padEnd(10)}  ${m.type.padEnd(6)}  ${lineNum}    ${line.substring(0, 55)}`);
                matchCount++;
              }
            });
          }
        });
        
        if (matchCount === 0) {
          logs.push(`*** [INFORMACIÓN] No se encontraron coincidencias para la cadena '${searchStr}'. ***`);
        } else {
          logs.push(`*** TOTAL COINCIDENCIAS ENCONTRADAS EN LA BIBLIOTECA: ${matchCount} ***`);
        }
        logs.push("====================================================================================");
        checkMissionObjectives("FNDSTRPDM");
      }
    }
    // CPYF command - Copiar archivo
    else if (upperCmd.startsWith("CPYF")) {
      const fromMatch = trimmed.match(/FROMFILE\((.*?)\)/i);
      const toMatch = trimmed.match(/TOFILE\((.*?)\)/i);
      
      let fromFile = fromMatch ? fromMatch[1].toUpperCase() : "";
      let toFile = toMatch ? toMatch[1].toUpperCase() : "";
      
      if (!fromFile || !toFile) {
        const parts = trimmed.split(/\s+/);
        if (parts.length >= 3) {
          fromFile = parts[1].toUpperCase();
          toFile = parts[2].toUpperCase();
        }
      }
      
      if (!fromFile || !toFile) {
        logs.push("================ COPIAR ARCHIVOS DE BASE DE DATOS (CPYF) ================");
        logs.push("Uso: CPYF FROMFILE(archivo_origen) TOFILE(archivo_destino) MBROPT(*ADD)");
        logs.push("Abreviado: CPYF origen destino");
        logs.push("Permite duplicar estructuras y registros de tablas en DB2/400.");
        logs.push("=========================================================================");
      } else {
        const sourceFile = dbFiles.find(f => f.name === fromFile);
        if (sourceFile) {
          const targetExists = dbFiles.some(f => f.name === toFile);
          if (targetExists) {
            const updated = dbFiles.map(f => {
              if (f.name === toFile) {
                return {
                  ...f,
                  records: [...f.records, ...sourceFile.records]
                };
              }
              return f;
            });
            setDbFiles(updated);
            logs.push(`[SISTEMA] Registros copiados desde '${fromFile}' hacia archivo existente '${toFile}'.`);
            logs.push(`[SISTEMA] Se agregaron ${sourceFile.records.length} registros exitosamente.`);
          } else {
            const newFileObj = {
              name: toFile,
              schema: [...sourceFile.schema],
              records: JSON.parse(JSON.stringify(sourceFile.records))
            };
            setDbFiles(prev => [...prev, newFileObj]);
            logs.push(`[SISTEMA] El archivo físico de destino '${toFile}' no existía. Se ha creado.`);
            logs.push(`[SISTEMA] Se copió la estructura completa de campos: ${sourceFile.schema.join(", ")}`);
            logs.push(`[SISTEMA] Se copiaron con éxito ${sourceFile.records.length} registros hacia '${toFile}'.`);
          }
          checkMissionObjectives("CPYF");
        } else {
          logs.push(`[ERROR CL] El archivo de origen '${fromFile}' no existe en la biblioteca.`);
        }
      }
    }
    // DSPRPG command - Manual Completo de RPG en Español
    else if (upperCmd === "DSPRPG" || upperCmd.startsWith("DSPRPG ")) {
      const option = trimmed.substring(6).trim();
      
      if (!option) {
        logs.push("================ MANUAL DEL COMPILADOR RPG - AS/400 ================");
        logs.push("Seleccione un capítulo ingresando 'DSPRPG [Número]':");
        logs.push("");
        logs.push("  DSPRPG 1 - Hojas de Especificaciones RPG (H, F, E, I, C, O)");
        logs.push("  DSPRPG 2 - El Ciclo de Lógica de Ejecución RPG");
        logs.push("  DSPRPG 3 - El Uso de Indicadores de Estado (01-99, LR, L1-L9)");
        logs.push("  DSPRPG 4 - La Operación SETLL (Set Lower Limit) y READE");
        logs.push("");
        logs.push("Ingrese 'DSPRPG 1' para empezar la lectura.");
        logs.push("=====================================================================");
      } else if (option === "1") {
        logs.push("============== RPG MANUAL: 1. HOJAS DE ESPECIFICACIONES ==============");
        logs.push("El RPG es un lenguaje posicional histórico. Cada instrucción debe ir");
        logs.push("escrita en una columna específica según su tipo de especificación (Hoja):");
        logs.push("");
        logs.push(" 1. Hoja 'H' (Header / Control): Controla parámetros globales del compilador");
        logs.push("    y del entorno de ejecución (ej. formato de fecha, optimizaciones).");
        logs.push(" 2. Hoja 'F' (File Description): Define los archivos (tablas) lógicos o físicos");
        logs.push("    que utilizará el programa, su dirección (Input, Output, Update) y llave.");
        logs.push(" 3. Hoja 'E' (Extension/Arrays): Define vectores, tablas internas, matrices");
        logs.push("    y archivos de extensión (parámetros precargados).");
        logs.push(" 4. Hoja 'I' (Input): Describe la estructura de los campos de entrada,");
        logs.push("    renombra buffers de datos y asocia indicadores de registro.");
        logs.push(" 5. Hoja 'C' (Calculation): Contiene las instrucciones lógicas reales,");
        logs.push("    operaciones matemáticas, comparaciones (SETLL, READ, ADD, SUB, etc.).");
        logs.push(" 6. Hoja 'O' (Output): Describe el formato de los listados de impresora,");
        logs.push("    pantallas de salida o registros a escribir.");
        logs.push("");
        logs.push("Escriba 'DSPRPG 2' para continuar con el Ciclo Lógico.");
        logs.push("=======================================================================");
      } else if (option === "2") {
        logs.push("============== RPG MANUAL: 2. EL CICLO LÓGICO DEL RPG ==============");
        logs.push("A diferencia de lenguajes procedimentales, RPG tiene un bucle o ciclo");
        logs.push("de ejecución nativo e implícito, ideal para procesamiento de reportes:");
        logs.push("");
        logs.push(" Pasos del Ciclo RPG:");
        logs.push("  1. Abre archivos especificados en la Hoja 'F'.");
        logs.push("  2. Lee el primer o siguiente registro del archivo principal.");
        logs.push("  3. Si es Fin de Archivo (EOF), activa el indicador *LR (Last Record) y termina.");
        logs.push("  4. Si hay datos, carga los campos en el buffer (Hoja 'I').");
        logs.push("  5. Procesa las operaciones de cálculo especificadas en la Hoja 'C'.");
        logs.push("  6. Escribe salidas correspondientes (Hoja 'O').");
        logs.push("  7. Vuelve al paso 2.");
        logs.push("");
        logs.push("Escriba 'DSPRPG 3' para continuar con el Uso de Indicadores.");
        logs.push("=====================================================================");
      } else if (option === "3") {
        logs.push("============== RPG MANUAL: 3. EL USO DE INDICADORES (01-99) ==============");
        logs.push("Los indicadores son variables booleanas de un solo dígito de estado:");
        logs.push("");
        logs.push(" - Indicadores de cálculo (01-99): Pueden activarse (*ON) o desactivarse (*OFF)");
        logs.push("   en base a condiciones matemáticas o lógicas (ej: comparar campos).");
        logs.push(" - Indicadores especiales:");
        logs.push("    * *LR (Last Record): Indica fin de programa y cierra buffers.");
        logs.push("    * *L1-*L9 (Control Levels): Utilizados para rupturas de control (subtotales).");
        logs.push("    * *OF (Overflow): Indica desbordamiento de página física en impresora.");
        logs.push(" - Condicionamiento de líneas:");
        logs.push("   En la Hoja 'C', puedes poner el número del indicador (ej. '05') al inicio de");
        logs.push("   la línea para que esa instrucción solo se ejecute si dicho indicador está encendido.");
        logs.push("");
        logs.push("Escriba 'DSPRPG 4' para continuar con la Operación SETLL.");
        logs.push("==========================================================================");
      } else if (option === "4") {
        logs.push("============== RPG MANUAL: 4. LA OPERACIÓN SETLL Y READE ==============");
        logs.push("SETLL (Set Lower Limit) es crucial para buscar datos en base de datos:");
        logs.push("");
        logs.push(" - Función:");
        logs.push("   Coloca el puntero del archivo justo al principio del primer registro que");
        logs.push("   coincida o sea mayor que la clave especificada, pero NO lee el registro.");
        logs.push(" - Sintaxis típica Hoja 'C':");
        logs.push("      CL0N01Factor1+++++++Opcode&ExtFactor2+++++++Result++++++++Indicator");
        logs.push("      C     KEY_VAL       SETLL     MYFILE_LF                  50 (Equal)");
        logs.push("");
        logs.push(" - Resultados de Indicadores en SETLL:");
        logs.push("   * El indicador del factor de resultado (ej. 50) se enciende si se encuentra");
        logs.push("     un registro cuya clave sea EXACTAMENTE igual a la buscada.");
        logs.push(" - Operaciones sucesivas:");
        logs.push("   Normalmente va seguido de un bucle de lectura READE (Read Equal):");
        logs.push("      C     KEY_VAL       READE     MYFILE_LF                  55 (EOF)");
        logs.push("   Esto lee secuencialmente todos los registros que tienen exactamente la misma clave.");
        logs.push("");
        logs.push("Felicidades. Ha finalizado de leer el manual introductorio.");
        logs.push("=========================================================================");
      } else {
        logs.push(`[ERROR] Capítulo '${option}' no reconocido. Ingrese un número de 1 a 4.`);
      }
      checkMissionObjectives("DSPRPG");
    } 
    // 6. CALL program
    else if (upperCmd.startsWith("CALL ")) {
      const match = trimmed.match(/CALL\s+PGM\((.*?)\)/i);
      const pgmName = match ? match[1].toUpperCase() : trimmed.substring(5).trim().toUpperCase();
      
      const member = members.find(m => m.name === pgmName);
      if (member) {
        if (!member.compiled) {
          logs.push(`[ERROR CL] El programa '${pgmName}' no ha sido compilado. Use opción 14 en PDM primero.`);
        } else {
          logs.push(`[SISTEMA] Iniciando llamada interactiva a programa legacy ${pgmName} (${member.type})...`);
          
          setIsExecuting(true);
          try {
            const response = await fetch("/api/as400/execute", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                code: member.code,
                type: member.type,
                variables: member.variables || {},
                dbFiles: dbFiles,
                memberName: pgmName
              })
            });

            if (response.ok) {
              const data = await response.json();
              if (data.outputs && Array.isArray(data.outputs)) {
                data.outputs.forEach((o: string) => logs.push(`> ${o}`));
              }
              if (data.dbUpdates && Array.isArray(data.dbUpdates)) {
                applyDatabaseUpdates(data.dbUpdates);
              }
              logs.push(`[SISTEMA] Programa ${pgmName} finalizado exitosamente.`);
              
              // If there's explanation text, show it nicely
              if (data.explanation) {
                logs.push(`[EXPLICACIÓN]: ${data.explanation}`);
              }

              // Check objectives
              checkMissionObjectives(`CALL ${pgmName}`);
            } else {
              logs.push(`[ERROR INTERPRETACIÓN] No se pudo ejecutar el programa en el servidor.`);
            }
          } catch (err: any) {
            logs.push(`[ERROR ENTORNO] Fallo en la comunicación local con la MV AS/400: ${err.message}`);
          }
          setIsExecuting(false);
        }
      } else {
        logs.push(`[ERROR CL] Programa '${pgmName}' no encontrado en biblioteca QGPL.`);
      }
    }
    // 7. SNDMSG
    else if (upperCmd.startsWith("SNDMSG ")) {
      const match = trimmed.match(/SNDMSG\s+MSG\(['"](.*?)['"]\)/i);
      const msgText = match ? match[1] : trimmed.substring(7).trim();
      
      const newMsg: SystemMessage = {
        id: `M_DYN_${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(11, 19),
        type: "INFO",
        sender: currentUser,
        text: msgText
      };
      setMessages([newMsg, ...messages]);
      logs.push(`[SISTEMA] Mensaje enviado a la cola del operador del sistema.`);
      
      checkMissionObjectives("SNDMSG");
    }
    // 8. DSPSYSVAL
    else if (upperCmd.startsWith("DSPSYSVAL")) {
      const match = trimmed.match(/SYSVAL\((.*?)\)/i);
      const sysval = match ? match[1].toUpperCase() : trimmed.substring(9).trim().toUpperCase();
      
      if (!sysval) {
        logs.push("================ VALORES DE SISTEMA OS/400 VIRTUAL ================");
        logs.push("QDATE       - Fecha del sistema (" + systemStatus.localTime.substring(0, 10) + ")");
        logs.push("QTIME       - Hora del sistema (" + systemStatus.localTime.substring(11, 19) + ")");
        logs.push("QSECURITY   - Nivel de seguridad del sistema (40 - Seguridad de Recursos)");
        logs.push("QPRTDEV     - Dispositivo de impresión predeterminado (PRT01)");
        logs.push("QCCSID      - Identificador de juego de caracteres codificado (37 - EBCDIC)");
        logs.push("QSRLNBR     - Número de serie del sistema virtual (44A1234B)");
        logs.push("QMAXSIGN    - Intentos máximos permitidos de inicio de sesión (3)");
        logs.push("Escriba 'DSPSYSVAL SYSVAL(nombre)' para inspeccionar un valor individual.");
        logs.push("===================================================================");
      } else {
        logs.push(`================ VALOR DE SISTEMA OS/400: ${sysval} ================`);
        if (sysval === "QDATE") {
          logs.push(`Valor . . . . . . . . . . :  ${systemStatus.localTime.substring(0, 10)}`);
          logs.push("Descripción . . . . . . . :  Fecha actual del sistema.");
        } else if (sysval === "QTIME") {
          logs.push(`Valor . . . . . . . . . . :  ${systemStatus.localTime.substring(11, 19)}`);
          logs.push("Descripción . . . . . . . :  Hora actual del sistema.");
        } else if (sysval === "QSECURITY") {
          logs.push("Valor . . . . . . . . . . :  40");
          logs.push("Descripción . . . . . . . :  Nivel de seguridad del sistema.");
        } else if (sysval === "QPRTDEV") {
          logs.push("Valor . . . . . . . . . . :  PRT01");
          logs.push("Descripción . . . . . . . :  Impresora predeterminada.");
        } else if (sysval === "QCCSID") {
          logs.push("Valor . . . . . . . . . . :  37");
          logs.push("Descripción . . . . . . . :  EBCDIC US English.");
        } else if (sysval === "QSRLNBR") {
          logs.push("Valor . . . . . . . . . . :  44A1234B");
          logs.push("Descripción . . . . . . . :  Número de serie del procesador.");
        } else if (sysval === "QMAXSIGN") {
          logs.push("Valor . . . . . . . . . . :  3");
          logs.push("Descripción . . . . . . . :  Intentos de contraseña máximos.");
        } else {
          logs.push(`Valor . . . . . . . . . . :  *NOTFOUND`);
          logs.push(`[ERROR CL] El valor de sistema '${sysval}' no es válido o no está soportado.`);
        }
        logs.push("=========================================================================");
      }
    }
    // 9. WRKUSRPRF / CRTUSRPRF / DSPUSRPRF
    else if (upperCmd === "WRKUSRPRF") {
      logs.push("================ TRABAJAR CON PERFILES DE USUARIO ================");
      logs.push("Perfil      Clase de Usr  Estado     Bib. Inicial  Descripción");
      logs.push("----------  ------------  ---------  ------------  ----------------------");
      userProfiles.forEach(usr => {
        const pClass = usr === "QSECOFR" || usr === "ALBERTO" ? "*SECADM" : usr === "QSYSOPR" ? "*SYSOPR" : usr === "DEVELOPER" ? "*PGMR" : "*USER";
        logs.push(`${usr.padEnd(10)}  ${pClass.padEnd(12)}  *ACTIVE    QGPL        Usuario simulado de iSeries`);
      });
      logs.push("Use 'CRTUSRPRF USRPRF(nombre)' para crear un nuevo perfil.");
      logs.push("==================================================================");
    }
    else if (upperCmd.startsWith("CRTUSRPRF ")) {
      const match = trimmed.match(/USRPRF\((.*?)\)/i);
      const newUsr = (match ? match[1] : trimmed.substring(10).trim()).toUpperCase().replace(/[^A-Z0-9]/g, "");
      
      if (!newUsr) {
        logs.push("[ERROR CL] Debe especificar un nombre de perfil. Ej: CRTUSRPRF USRPRF(ALEX)");
      } else if (userProfiles.includes(newUsr)) {
        logs.push(`[ERROR CL] El perfil de usuario '${newUsr}' ya existe en el sistema.`);
      } else {
        setUserProfiles(prev => [...prev, newUsr]);
        logs.push(`[SISTEMA] Perfil de usuario '${newUsr}' creado con éxito (Clase: *USER).`);
        logs.push(`[SISTEMA] Biblioteca asociada: QGPL, Menú inicial: MAIN.`);
      }
    }
    else if (upperCmd.startsWith("DSPUSRPRF ")) {
      const match = trimmed.match(/USRPRF\((.*?)\)/i);
      const usr = match ? match[1].toUpperCase() : trimmed.substring(10).trim().toUpperCase();
      const targetUsr = usr || currentUser;
      
      if (userProfiles.includes(targetUsr)) {
        logs.push(`================ PERFIL DE USUARIO: ${targetUsr} ================`);
        logs.push(`Clase de usuario . . . . . :  ${targetUsr === "QSECOFR" || targetUsr === "ALBERTO" ? "*SECADM" : targetUsr === "QSYSOPR" ? "*SYSOPR" : "*PGMR"}`);
        logs.push(`Biblioteca inicial . . . . :  QGPL`);
        logs.push(`Menú inicial . . . . . . . :  MAIN`);
        logs.push(`Estado del perfil . . . .  :  *ENABLED`);
        logs.push(`Dirección de correo . . .  :  ${targetUsr.toLowerCase()}@pub400-lcl.com`);
        logs.push("=================================================================");
      } else {
        logs.push(`[ERROR CL] El perfil de usuario '${targetUsr}' no existe.`);
      }
    }
    // 10. WRKOBJ & DSPLIB / ADDLIBLE / RMVLIBLE
    else if (upperCmd === "WRKOBJ") {
      logs.push("================ TRABAJAR CON OBJETOS DEL SISTEMA ================");
      logs.push("Objeto      Biblioteca  Tipo        Atributo    Descripción");
      logs.push("----------  ----------  ----------  ----------  ----------------------");
      dbFiles.forEach(file => {
        logs.push(`${file.name.padEnd(10)}  QGPL        *FILE       PF          Archivo Físico (Physical File)`);
      });
      members.forEach(mbr => {
        logs.push(`${mbr.name.padEnd(10)}  QGPL        *MBR        ${mbr.type.padEnd(10)} Miembro fuente de código`);
      });
      logs.push("==================================================================");
    }
    else if (upperCmd.startsWith("DSPLIB")) {
      const match = trimmed.match(/LIB\((.*?)\)/i);
      const lib = (match ? match[1] : trimmed.substring(6).trim()).toUpperCase() || "QGPL";
      
      logs.push(`================ BIBLIOTECA DEL SISTEMA: ${lib} ================`);
      if (lib === "QGPL") {
        dbFiles.forEach(file => {
          logs.push(`${file.name.padEnd(12)} *FILE       PF          Registros: ${file.records.length}`);
        });
        members.forEach(mbr => {
          logs.push(`${mbr.name.padEnd(12)} *MBR        ${mbr.type.padEnd(11)} Compilado: ${mbr.compiled ? "SÍ" : "NO"}`);
        });
      } else if (lib === "QSYS") {
        logs.push("QSYSOPR      *MSGQ       Cola de mensajes del operador");
        logs.push("QINTER       *SBSD       Subsistema interactivo principal");
        logs.push("QBATCH       *SBSD       Subsistema de procesamiento por lotes");
      } else if (lib === "QTEMP") {
        logs.push("[VACÍO] No hay objetos temporales asignados a este hilo.");
      } else {
        logs.push(`[ERROR CL] La biblioteca '${lib}' no está registrada en la lista de bibliotecas.`);
      }
      logs.push("==================================================================");
    }
    else if (upperCmd.startsWith("ADDLIBLE ")) {
      const match = trimmed.match(/LIB\((.*?)\)/i);
      const lib = (match ? match[1] : trimmed.substring(9).trim()).toUpperCase();
      
      if (!lib) {
        logs.push("[ERROR CL] Especifique la biblioteca. Ej: ADDLIBLE LIB(QTEMP)");
      } else if (libraryList.includes(lib)) {
        logs.push(`[ERROR CL] La biblioteca '${lib}' ya está en la lista de bibliotecas.`);
      } else {
        setLibraryList(prev => [...prev, lib]);
        logs.push(`[SISTEMA] Biblioteca '${lib}' agregada exitosamente a la lista de bibliotecas.`);
      }
    }
    else if (upperCmd.startsWith("RMVLIBLE ")) {
      const match = trimmed.match(/LIB\((.*?)\)/i);
      const lib = (match ? match[1] : trimmed.substring(9).trim()).toUpperCase();
      
      if (!lib) {
        logs.push("[ERROR CL] Especifique la biblioteca. Ej: RMVLIBLE LIB(QTEMP)");
      } else if (!libraryList.includes(lib)) {
        logs.push(`[ERROR CL] La biblioteca '${lib}' no está en la lista de bibliotecas.`);
      } else if (lib === "QSYS" || lib === "QGPL") {
        logs.push(`[ERROR CL] No se permite eliminar bibliotecas de sistema base (${lib}).`);
      } else {
        setLibraryList(prev => prev.filter(l => l !== lib));
        logs.push(`[SISTEMA] Biblioteca '${lib}' eliminada de la lista de bibliotecas.`);
      }
    }
    // 11. DSPJOBLOG
    else if (upperCmd === "DSPJOBLOG") {
      logs.push("================ LOG DE TRABAJO ACTIVO (JOB LOG) ================");
      logs.push(`Trabajo: DSP01        Usuario: ${currentUser}      Sistema: PUB400-LCL`);
      logs.push("-".repeat(70));
      if (commandHistory.length === 0) {
        logs.push("[SISTEMA] No hay mandatos registrados en el historial de hilos.");
      } else {
        [...commandHistory].reverse().forEach((cmd, idx) => {
          logs.push(`CMD${String(idx+1).padStart(3, "0")}  > ${cmd}`);
        });
      }
      logs.push("=================================================================");
    }
    // 12. WRKMSG & SNDBRKMSG
    else if (upperCmd === "WRKMSG") {
      logs.push("================ COLA DE MENSAJES DE OPERADOR (QSYSOPR) ================");
      if (messages.length === 0) {
        logs.push("[INFORMACIÓN] No hay mensajes pendientes en la cola.");
      } else {
        messages.forEach(msg => {
          logs.push(`[${msg.timestamp}] [${msg.type}] de ${msg.sender}: ${msg.text}`);
        });
      }
      logs.push("=======================================================================");
    }
    else if (upperCmd.startsWith("SNDBRKMSG ")) {
      const matchMsg = trimmed.match(/MSG\(['"](.*?)['"]\)/i);
      const matchUsr = trimmed.match(/TOUSR\((.*?)\)/i);
      
      const msgText = matchMsg ? matchMsg[1] : trimmed.substring(10).trim();
      const targetUsr = matchUsr ? matchUsr[1].toUpperCase() : "QSECOFR";
      
      const newMsg: SystemMessage = {
        id: `M_BRK_${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').substring(11, 19),
        type: "BREAK",
        sender: currentUser,
        text: msgText
      };
      setMessages([newMsg, ...messages]);
      
      logs.push(`*** MENSAJE DE INTERRUPCIÓN (BREAK) ENVIADO A ${targetUsr} ***`);
      logs.push(`[BREAK] ${currentUser}: ${msgText}`);
    }
    // 13. Menus (GO MAIN, option numbers)
    else if (upperCmd === "GO" || upperCmd === "GO MAIN") {
      logs.push("=============================================================================");
      logs.push("                       Menú Principal de AS/400 (MAIN)                       ");
      logs.push("                                                             Sistema: PUB400-LCL");
      logs.push(" Seleccione una de las siguientes opciones:                                  ");
      logs.push("                                                                             ");
      logs.push("   1. Tareas del Terminal 5250 (Consola Interactiva CL)                      ");
      logs.push("   2. Administrador de Programas PDM (Editar RPG/COBOL)                      ");
      logs.push("   3. Trabajar con Bases de Datos DB2/400 (SQL)                              ");
      logs.push("   4. Centro de Entrenamiento y Misiones Cognitivas                          ");
      logs.push("   5. Administración de Integraciones Legacy (SST / Puentes)                 ");
      logs.push("   6. Acerca de este Emulador (GitHub README / Autoría)                      ");
      logs.push("                                                                             ");
      logs.push("   90. Cerrar Sesión Activa (SIGNOFF)                                        ");
      logs.push("                                                                             ");
      logs.push(" Escriba el número de opción o cualquier comando CL en la línea de mandatos. ");
      logs.push("=============================================================================");
    }
    else if (upperCmd === "1") {
      logs.push("[SISTEMA] Opción 1 seleccionada. Permanece en la Terminal Interactiva 5250.");
    }
    else if (upperCmd === "2") {
      logs.push("[SISTEMA] Opción 2 seleccionada. Redirigiendo al Editor SEU / PDM.");
      setActiveTab(2);
    }
    else if (upperCmd === "3") {
      logs.push("[SISTEMA] Opción 3 seleccionada. Redirigiendo al Gestor DB2/400.");
      setActiveTab(3);
    }
    else if (upperCmd === "4") {
      logs.push("[SISTEMA] Opción 4 seleccionada. Redirigiendo al Centro de Entrenamiento.");
      setActiveTab(4);
    }
    else if (upperCmd === "5") {
      logs.push("[SISTEMA] Opción 5 seleccionada. Redirigiendo a Integración Legacy.");
      setActiveTab(5);
    }
    else if (upperCmd === "6") {
      logs.push("[SISTEMA] Opción 6 seleccionada. Redirigiendo a Acerca de / README.");
      setActiveTab(6);
    }
    else if (upperCmd === "90") {
      setIsLoggedOn(false);
      setTerminalLogs([
        "SESIÓN CERRADA POR EL USUARIO.",
        "===>"
      ]);
      setTerminalInput("");
      return;
    }
    // 14. SIGNOFF
    else if (upperCmd === "SIGNOFF" || upperCmd === "BYE") {
      setIsLoggedOn(false);
      setTerminalLogs([
        "SESIÓN CERRADA POR EL USUARIO.",
        "===>"
      ]);
      setTerminalInput("");
      return;
    }
    // 15. CLEAR
    else if (upperCmd === "CLEAR") {
      setTerminalLogs(["CONSOLA REINICIADA", "===>"]);
      setTerminalInput("");
      return;
    } 
    // Fallback unhandled
    else {
      logs.push(`[ERROR MANDATO CL] Comando o instrucción no reconocida: '${trimmed}'`);
      logs.push("Use 'HELP' para listar los comandos simulados.");
    }

    logs.push("===>");
    setTerminalLogs(logs);
    setTerminalInput("");
  };

  // Apply records to our simulated DB2 structure
  const applyDatabaseUpdates = (updates: any[]) => {
    let updated = [...dbFiles];
    updates.forEach(up => {
      updated = updated.map(file => {
        if (file.name.toUpperCase() === up.file.toUpperCase()) {
          // Verify ID and duplicate insertion prevention
          const isDup = file.records.some(r => r.ID === up.data.ID);
          const finalId = isDup ? up.data.ID + Math.floor(Math.random() * 10) : up.data.ID;
          
          return {
            ...file,
            records: [
              ...file.records,
              {
                ...up.data,
                ID: finalId,
                DATETIME: up.data.DATETIME || new Date().toISOString().replace('T', ' ').substring(0, 19)
              }
            ]
          };
        }
        return file;
      });
    });
    setDbFiles(updated);
  };

  const addActiveJob = (name: string, user: string, status: "RUN" | "MSGW" | "CND", cpu: number, func: string) => {
    const newJob: ActiveJob = {
      id: `J_${Date.now().toString().slice(-4)}`,
      name,
      type: "BATCH",
      user,
      status,
      cpu,
      function: func
    };
    setJobs(prev => [newJob, ...prev.slice(0, 5)]);
  };

  // Compile member in SEU Editor
  const compileCurrentMember = async () => {
    setCompileOutput({ status: "COMPILING", message: "Iniciando compilador legacy OS/400...", errors: [] });
    
    // Add job to list
    addActiveJob(`CRT${selectedMember.type}PGM`, currentUser, "RUN", 4.2, `COMPILE-${selectedMember.name}`);

    try {
      const response = await fetch("/api/as400/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editorCode,
          type: selectedMember.type,
          name: selectedMember.name
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update member source
        const updatedMembers = members.map(m => {
          if (m.name === selectedMember.name) {
            return {
              ...m,
              code: editorCode,
              compiled: data.status === "SUCCESS",
              variables: data.variables,
              filesReferenced: data.filesReferenced,
              lastCompiledDate: new Date().toISOString().replace('T', ' ').substring(0, 19)
            };
          }
          return m;
        });
        
        setMembers(updatedMembers);
        
        // Update selected state as well
        setSelectedMember(prev => ({
          ...prev,
          code: editorCode,
          compiled: data.status === "SUCCESS",
          variables: data.variables,
          filesReferenced: data.filesReferenced
        }));

        if (data.status === "SUCCESS") {
          setCompileOutput({
            status: "SUCCESS",
            message: data.summary || "Miembro compilado exitosamente. Se ha creado el objeto de programa en biblioteca QGPL.",
            errors: []
          });
          
          // Write success message to terminal also
          setTerminalLogs(prev => [
            ...prev.slice(0, -1),
            `[COMPILADOR] Compilación exitosa de ${selectedMember.name}. Objeto creado.`,
            "===>"
          ]);

          // Check tutorial progress
          checkMissionObjectives("COMPILE");
        } else {
          setCompileOutput({
            status: "ERROR",
            message: "La compilación falló con errores de sintaxis legacy.",
            errors: data.errors || ["Error estructural en la división del código."]
          });
        }
      } else {
        setCompileOutput({
          status: "ERROR",
          message: "Error interno del servidor al procesar la compilación.",
          errors: ["No se recibió respuesta del compilador local / Gemini."]
        });
      }
    } catch (err: any) {
      setCompileOutput({
        status: "ERROR",
        message: "Error de red o conexión al servidor local.",
        errors: [err.message]
      });
    }
  };

  // Execute from SEU View
  const runCurrentMember = async () => {
    if (!selectedMember.compiled) {
      alert(`Por favor compile el miembro '${selectedMember.name}' antes de ejecutarlo.`);
      return;
    }

    setIsExecuting(true);
    setExecutionLog([`Iniciando llamada interactiva (CALL ${selectedMember.name})`]);
    setExecutionDetails("");

    try {
      const response = await fetch("/api/as400/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: editorCode,
          type: selectedMember.type,
          variables: selectedMember.variables || {},
          dbFiles: dbFiles,
          memberName: selectedMember.name
        })
      });

      if (response.ok) {
        const data = await response.json();
        setExecutionLog(data.outputs || ["Ejecución terminada sin salidas directas."]);
        setExecutionDetails(data.explanation || "No se generó explicación adicional.");
        
        if (data.dbUpdates && Array.isArray(data.dbUpdates)) {
          applyDatabaseUpdates(data.dbUpdates);
        }

        // Add a success log line in terminal
        setTerminalLogs(prev => [
          ...prev.slice(0, -1),
          `[LOG EJECUCIÓN] El programa ${selectedMember.name} se ejecutó desde el editor.`,
          "===>"
        ]);

        // Check mission progress
        checkMissionObjectives(`CALL ${selectedMember.name}`);
      } else {
        setExecutionLog(["Error crítico al invocar intérprete legacy en servidor."]);
      }
    } catch (err: any) {
      setExecutionLog([`Error de red: ${err.message}`]);
    }
    setIsExecuting(false);
  };

  // Tutorial logic
  const selectMission = (mission: TutorialMission) => {
    setActiveMission(mission);
    setMissionObjectivesProgress(mission.objectives.map(() => false));
    
    // Auto-create or load member for mission
    const exists = members.find(m => m.name === mission.memberName);
    if (!exists) {
      const newM: SourceMember = {
        name: mission.memberName,
        type: mission.language,
        srcFile: mission.srcFile,
        code: mission.templateCode,
        compiled: false
      };
      setMembers([...members, newM]);
      setSelectedMember(newM);
    } else {
      setSelectedMember(exists);
    }
    
    // Jump to PDM Editor to start coding
    setActiveTab(2);

    // Alert training message
    setTerminalLogs(prev => [
      ...prev.slice(0, -1),
      `[TUTORIAL] Iniciaste misión: "${mission.title}". Sigue los objetivos descritos a la derecha.`,
      "===>"
    ]);
  };

  const checkMissionObjectives = (actionType: string) => {
    if (!activeMission) return;

    const updatedProgress = [...missionObjectivesProgress];

    if (activeMission.id === "M_COB_1") {
      // Objectives: 
      // 0. Abre el miembro SALUDOCOB en el editor SEU.
      // 1. Revisa la estructura obligatoria de DIVISIONES de COBOL.
      // 2. Compila el programa usando la opción 14 en PDM o el comando 'CRTCBLPGM PGM(SALUDOCOB)'.
      // 3. Ejecuta el programa con 'CALL PGM(SALUDOCOB)' en la consola y observa el saludo.
      if (actionType === "WRKMBRPDM" || (activeTab === 2 && selectedMember.name === "SALUDOCOB")) {
        updatedProgress[0] = true;
      }
      if (selectedMember.name === "SALUDOCOB" && editorCode.includes("IDENTIFICATION DIVISION")) {
        updatedProgress[1] = true;
      }
      if (actionType === "COMPILE" && selectedMember.name === "SALUDOCOB" && selectedMember.compiled) {
        updatedProgress[2] = true;
      }
      if (actionType === "CALL SALUDOCOB") {
        updatedProgress[3] = true;
      }
    }

    if (activeMission.id === "M_RPG_1") {
      // Objectives:
      // 0. Crea un miembro nuevo llamado CARGARPG en QRPGSRC de tipo RPG.
      // 1. Escribe un script en formato libre (**FREE) que defina variables y use WRITE para registrar datos.
      // 2. Compíla con 'CRTRPGPGM PGM(CARGARPG)'.
      // 3. Ejecuta el CALL y usa 'DSPPFM FILE(QRPGPF)' para verificar la base de datos.
      if (selectedMember.name === "CARGARPG") {
        updatedProgress[0] = true;
      }
      if (selectedMember.name === "CARGARPG" && editorCode.includes("**FREE")) {
        updatedProgress[1] = true;
      }
      if (actionType === "COMPILE" && selectedMember.name === "CARGARPG" && selectedMember.compiled) {
        updatedProgress[2] = true;
      }
      if (actionType === "DSPPFM" || actionType === "CALL CARGARPG") {
        updatedProgress[3] = true;
      }
    }

    if (activeMission.id === "M_CL_1") {
      // Objectives:
      // 0. Escribe comandos directos en la línea de comandos interactiva de AS/400.
      // 1. Usa 'WRKACTJOB' para ver la carga de CPU y subsistemas.
      // 2. Ejecuta 'DSPPFM FILE(QUSERPF)' para hacer un dump de los registros de usuarios.
      // 3. Envía un mensaje al sistema con 'SNDMSG MSG('Test')' o simula su cola.
      updatedProgress[0] = true; // Just interacting
      if (actionType === "WRKACTJOB") {
        updatedProgress[1] = true;
      }
      if (actionType === "DSPPFM") {
        updatedProgress[2] = true;
      }
      if (actionType === "SNDMSG") {
        updatedProgress[3] = true;
      }
    }

    if (activeMission.id === "M_DB2_1") {
      // Objectives:
      // 0. Ejecuta 'DSPDBR FILE(QUSERPF)' para visualizar las relaciones lógicas.
      // 1. Ejecuta 'DSPFD FILE(QUSERPF)' para analizar la descripción del archivo físico.
      // 2. Ejecuta 'DSPFFD FILE(QUSERPF)' para inspeccionar el búfer de campos.
      // 3. Usa 'FNDSTRPDM SALUDO' para buscar coincidencias de texto en el código fuente.
      // 4. Usa 'CPYF FROMFILE(QUSERPF) TOFILE(QUSERPF_RESP)' para crear un respaldo físico.
      // 5. Escribe 'DSPRPG' y navega por el manual interactivo de hojas, ciclo y SETLL.
      if (actionType === "DSPDBR") {
        updatedProgress[0] = true;
      }
      if (actionType === "DSPFD") {
        updatedProgress[1] = true;
      }
      if (actionType === "DSPFFD") {
        updatedProgress[2] = true;
      }
      if (actionType === "FNDSTRPDM") {
        updatedProgress[3] = true;
      }
      if (actionType === "CPYF") {
        updatedProgress[4] = true;
      }
      if (actionType === "DSPRPG") {
        updatedProgress[5] = true;
      }
    }

    setMissionObjectivesProgress(updatedProgress);
  };

  // Ask AI Tutor / Expert iSeries
  const askAITutor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tutorQuestion.trim()) return;

    setTutorLoading(true);
    setTutorAnswer("");

    try {
      const response = await fetch("/api/as400/tutor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: tutorQuestion,
          code: editorCode,
          type: selectedMember.type
        })
      });

      if (response.ok) {
        const data = await response.json();
        setTutorAnswer(data.answer || "No se recibió respuesta.");
      } else {
        setTutorAnswer("El servicio de tutoría por IA no pudo responder. Verifique su conexión y configuración local.");
      }
    } catch (err: any) {
      setTutorAnswer(`Error de red: ${err.message}. Asegúrate de que el servidor esté activo.`);
    }
    setTutorLoading(false);
  };

  // Handle Terminal keypress
  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeCLCommand(terminalInput);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (commandHistory.length > 0 && historyIndex < commandHistory.length - 1) {
        const newIdx = historyIndex + 1;
        setHistoryIndex(newIdx);
        setTerminalInput(commandHistory[newIdx]);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIdx = historyIndex - 1;
        setHistoryIndex(newIdx);
        setTerminalInput(commandHistory[newIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setTerminalInput("");
      }
    }
  };

  // Handle Sign-on screen submission
  const handleSignOnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUser.trim()) {
      setLoginError("Introduzca el nombre de usuario.");
      return;
    }
    const userUpper = loginUser.trim().toUpperCase();
    
    // Add user automatically to simulated profiles if not exists
    if (!userProfiles.includes(userUpper)) {
      setUserProfiles(prev => [...prev, userUpper]);
    }
    
    setCurrentUser(userUpper);
    setIsLoggedOn(true);
    setLoginError("");
    
    // Setup fresh logs
    setTerminalLogs([
      "SISTEMA OPERATIVO IBM OS/400 V5R4M0 INICIADO CORRECTAMENTE.",
      "LICENCIA DE SOFTWARE (C) COPYRIGHT IBM CORP. 1980, 2026.",
      `[SESIÓN] Sesión iniciada con éxito por el usuario ${userUpper}.`,
      "[SESIÓN] Estación de trabajo asignada: DSP01, Subsistema: QINTER.",
      `[SESIÓN] Menú inicial: ${loginMenu.toUpperCase() || "MAIN"}, Biblioteca corriente: ${loginLibrary.toUpperCase() || "QGPL"}.`,
      "Escriba 'HELP' o 'GO MAIN' para empezar a navegar el sistema interactivo.",
      "===>"
    ]);
    
    addActiveJob("INTERACTIVE", userUpper, "RUN", 0.5, "DSP01-LOGN");
  };

  // Create empty member helper
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberType, setNewMemberType] = useState<"RPG" | "COBOL" | "CL">("RPG");
  const handleCreateMember = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const nameUpper = newMemberName.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (!nameUpper) return;

    if (members.some(m => m.name === nameUpper)) {
      alert("Ya existe un miembro con ese nombre.");
      return;
    }

    const srcFileMap = {
      RPG: "QRPGSRC" as const,
      COBOL: "QCBLSRC" as const,
      CL: "QCLSRC" as const
    };

    const templateMap = {
      RPG: `**FREE\n// Nuevo miembro RPG creado\n\ndsply 'HOLA DESDE ${nameUpper}';\nreturn;`,
      COBOL: `       IDENTIFICATION DIVISION.\n       PROGRAM-ID. ${nameUpper}.\n       PROCEDURE DIVISION.\n           DISPLAY "HOLA DESDE ${nameUpper}".\n           GOBACK.`,
      CL: `/* Miembro CL: ${nameUpper} */\nSNDMSG MSG('Ejecutando ${nameUpper}') TOUSR(*SYSOPR)\nWRKACTJOB`
    };

    const newM: SourceMember = {
      name: nameUpper,
      type: newMemberType,
      srcFile: srcFileMap[newMemberType],
      code: templateMap[newMemberType],
      compiled: false
    };

    setMembers([...members, newM]);
    setSelectedMember(newM);
    setNewMemberName("");
    
    setTerminalLogs(prev => [
      ...prev.slice(0, -1),
      `[SISTEMA] Miembro fuente ${nameUpper} creado exitosamente en biblioteca QGPL.`,
      "===>"
    ]);
  };

  return (
    <div id="as400-emulator-root" className="flex flex-col h-screen bg-[#050506] text-[#4ade80] font-mono overflow-hidden select-none">
      {/* IBM i SYSTEM HEADER */}
      <header id="as400-header" className="flex flex-col md:flex-row items-stretch md:items-center justify-between px-6 py-3 bg-[#1c1c1e] text-[11px] uppercase tracking-wider text-[#8e8e93] border-b border-[#2c2c2e] gap-2 md:gap-0 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#4ade80] animate-pulse"></div>
          <div>Sistema: <span className="text-[#4ade80] font-bold">{systemStatus.systemName}</span></div>
          <span className="text-[#2c2c2e]">|</span>
          <div className="hidden sm:block">Plataforma: <span className="text-[#60a5fa]">{systemStatus.operatingSystem}</span></div>
        </div>
        <div className="font-bold text-white text-center md:absolute md:left-1/2 md:-translate-x-1/2 text-sm md:text-base tracking-widest flex items-center gap-2">
          <span className="text-[#fbbf24]">■</span> iSeries AS/400 & S/36 Emulator | por Alberto Arce <span className="text-[#fbbf24]">■</span>
        </div>
        <div className="flex items-center justify-end gap-4">
          <div>Usuario: <span className={isLoggedOn ? "text-[#60a5fa] font-bold" : "text-[#ff453a] font-bold"}>{isLoggedOn ? currentUser : "DESCONECTADO"}</span></div>
          <span className="text-[#2c2c2e]">|</span>
          <div className="flex items-center gap-1.5 text-white">
            <Clock className="w-3.5 h-3.5 text-[#fbbf24]" />
            <span>{systemStatus.localTime.substring(11, 19)}</span>
          </div>
        </div>
      </header>

      {/* TOP FUNCTION NAVIGATION BAR */}
      <nav id="as400-nav" className="bg-[#111112] border-b border-[#2c2c2e] px-4 py-2 flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex flex-wrap items-center gap-1">
          <button 
            id="btn-nav-terminal"
            onClick={() => { setActiveTab(1); if (terminalInputRef.current) terminalInputRef.current.focus(); }}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 1 
                ? "bg-[#1c1c1e] text-[#fbbf24] border-b-2 border-[#fbbf24]" 
                : "text-[#8e8e93] hover:text-white hover:bg-[#1c1c1e]"
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>[1] Terminal 5250</span>
          </button>
          
          <button 
            id="btn-nav-seu"
            onClick={() => {
              if (!isLoggedOn) {
                alert("DEBE INICIAR SESIÓN: Utilice la pantalla de Sign On en el Terminal 5250.");
                setActiveTab(1);
                return;
              }
              setActiveTab(2);
            }}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 2 
                ? "bg-[#1c1c1e] text-[#fbbf24] border-b-2 border-[#fbbf24]" 
                : "text-[#8e8e93] hover:text-white hover:bg-[#1c1c1e]"
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>[2] Editor SEU / PDM</span>
          </button>

          <button 
            id="btn-nav-db2"
            onClick={() => {
              if (!isLoggedOn) {
                alert("DEBE INICIAR SESIÓN: Utilice la pantalla de Sign On en el Terminal 5250.");
                setActiveTab(1);
                return;
              }
              setActiveTab(3);
            }}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 3 
                ? "bg-[#1c1c1e] text-[#fbbf24] border-b-2 border-[#fbbf24]" 
                : "text-[#8e8e93] hover:text-white hover:bg-[#1c1c1e]"
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>[3] Base de Datos DB2</span>
          </button>

          <button 
            id="btn-nav-tutorials"
            onClick={() => {
              if (!isLoggedOn) {
                alert("DEBE INICIAR SESIÓN: Utilice la pantalla de Sign On en el Terminal 5250.");
                setActiveTab(1);
                return;
              }
              setActiveTab(4);
            }}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 4 
                ? "bg-[#1c1c1e] text-[#fbbf24] border-b-2 border-[#fbbf24]" 
                : "text-[#8e8e93] hover:text-white hover:bg-[#1c1c1e]"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>[4] Centro de Entrenamiento</span>
            {activeMission && (
              <span className="w-2 h-2 rounded-full bg-[#ff453a] animate-ping"></span>
            )}
          </button>

          <button 
            id="btn-nav-bridge"
            onClick={() => {
              if (!isLoggedOn) {
                alert("DEBE INICIAR SESIÓN: Utilice la pantalla de Sign On en el Terminal 5250.");
                setActiveTab(1);
                return;
              }
              setActiveTab(5);
            }}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 5 
                ? "bg-[#1c1c1e] text-[#fbbf24] border-b-2 border-[#fbbf24]" 
                : "text-[#8e8e93] hover:text-white hover:bg-[#1c1c1e]"
            }`}
          >
            <Settings className="w-3.5 h-3.5" />
            <span>[5] Integración Legacy</span>
          </button>

          <button 
            id="btn-nav-about"
            onClick={() => setActiveTab(6)}
            className={`px-4 py-1.5 rounded text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 6 
                ? "bg-[#1c1c1e] text-[#fbbf24] border-b-2 border-[#fbbf24]" 
                : "text-[#8e8e93] hover:text-white hover:bg-[#1c1c1e]"
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>[6] Acerca de & README</span>
          </button>
        </div>

        <div className="hidden lg:flex items-center gap-2 text-[10px] text-[#8e8e93] uppercase bg-[#1c1c1e] px-3 py-1 rounded border border-[#2c2c2e]">
          <span>Compilador:</span>
          <span className={`font-bold ${systemStatus.compilerMode === "GEMINI_COGNITIVE" ? "text-[#60a5fa]" : "text-[#fbbf24]"}`}>
            {systemStatus.compilerMode === "GEMINI_COGNITIVE" ? "GEMINI COGNITIVE AI" : "LOCAL DETERMINISTIC"}
          </span>
        </div>
      </nav>

      {/* MAIN CONTAINER AREA */}
      <div id="as400-main-content" className="flex flex-1 overflow-hidden">
        {/* VIEWPORTS */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[#050506] flex flex-col relative">
          
          {/* Active Mission HUD Header (If tutoring) */}
          {activeMission && (
            <div id="mission-hud" className="mb-4 p-3 bg-[#1a1505] border border-[#fbbf24]/50 rounded flex flex-col md:flex-row items-start md:items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-[#fbbf24] text-black px-1.5 py-0.5 rounded font-bold uppercase">Entrenamiento Activo</span>
                <span className="text-white text-xs font-bold">{activeMission.title}</span>
              </div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="text-[#8e8e93]">Fichas objetivo:</span>
                <div className="flex gap-1.5">
                  {activeMission.objectives.map((obj, idx) => (
                    <div 
                      key={idx}
                      title={obj}
                      className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                        missionObjectivesProgress[idx] 
                          ? "bg-[#4ade80] text-black" 
                          : "bg-[#2c2c2e] text-[#8e8e93]"
                      }`}
                    >
                      {idx + 1}
                    </div>
                  ))}
                </div>
                <button 
                  onClick={() => {
                    setActiveMission(null);
                    setTerminalLogs(prev => [...prev.slice(0, -1), "[SISTEMA] Misión cancelada.", "===>"]);
                  }}
                  className="text-[#ff453a] hover:underline ml-2"
                >
                  [Abandonar]
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: 5250 TERMINAL */}
          {activeTab === 1 && (
            <div id="tab-terminal" className="flex-1 flex flex-col bg-[#050506] border border-[#2c2c2e] p-4 rounded-md font-mono relative overflow-hidden min-h-[480px]">
              {!isLoggedOn ? (
                <form onSubmit={handleSignOnSubmit} className="flex-1 flex flex-col justify-between text-[#34d399] p-2 md:p-6 select-text">
                  <div className="text-right text-[11px] text-[#34d399] uppercase tracking-wider mb-2">
                    Sistema . . . . . : <span className="text-white font-bold">{systemStatus.systemName}</span><br />
                    Subsistema  . . . : <span className="text-white font-bold font-mono">QINTER</span><br />
                    Dispositivo . . . : <span className="text-white font-bold font-mono">DSP01</span>
                  </div>

                  <div className="text-center font-bold text-white text-base md:text-lg tracking-widest uppercase my-4 border-b border-[#2c2c2e] pb-2">
                    Sign On (Inicio de Sesión)
                  </div>

                  {loginError && (
                    <div className="bg-[#1c0808] border border-[#ff453a]/30 text-[#ff453a] px-3 py-1.5 rounded text-xs mb-4 text-center font-bold">
                      [ERROR DE ACCESO]: {loginError}
                    </div>
                  )}

                  <div className="space-y-4 max-w-lg mx-auto w-full text-xs md:text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-48 text-[#34d399] font-medium">Usuario . . . . . . . . . . . . . :</span>
                      <input 
                        type="text" 
                        value={loginUser} 
                        onChange={(e) => setLoginUser(e.target.value.toUpperCase())}
                        placeholder="QSECOFR"
                        className="bg-[#111112] border-b-2 border-[#34d399] px-2 py-1 outline-none text-[#fbbf24] w-48 font-bold text-center focus:bg-[#1c1c1e] transition-colors"
                        autoFocus
                        maxLength={10}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-48 text-[#34d399] font-medium">Contraseña  . . . . . . . . . . :</span>
                      <input 
                        type="password" 
                        value={loginPassword} 
                        onChange={(e) => setLoginPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-[#111112] border-b-2 border-[#34d399] px-2 py-1 outline-none text-[#fbbf24] w-48 font-bold text-center focus:bg-[#1c1c1e] transition-colors"
                        maxLength={10}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-48 text-[#34d399] font-medium">Programa/Procedimiento . . . . . :</span>
                      <input 
                        type="text" 
                        value={loginProgram} 
                        onChange={(e) => setLoginProgram(e.target.value.toUpperCase())}
                        placeholder="*NONE"
                        className="bg-[#111112] border-b-2 border-[#2c2c2e] px-2 py-1 outline-none text-[#8e8e93] w-48 text-center text-xs focus:bg-[#1c1c1e]"
                        maxLength={10}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-48 text-[#34d399] font-medium">Menú Inicial . . . . . . . . . :</span>
                      <input 
                        type="text" 
                        value={loginMenu} 
                        onChange={(e) => setLoginMenu(e.target.value.toUpperCase())}
                        placeholder="MAIN"
                        className="bg-[#111112] border-b-2 border-[#34d399] px-2 py-1 outline-none text-[#fbbf24] w-48 font-bold text-center focus:bg-[#1c1c1e]"
                        maxLength={10}
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="w-48 text-[#34d399] font-medium">Biblioteca Corriente  . . . . . :</span>
                      <input 
                        type="text" 
                        value={loginLibrary} 
                        onChange={(e) => setLoginLibrary(e.target.value.toUpperCase())}
                        placeholder="QGPL"
                        className="bg-[#111112] border-b-2 border-[#34d399] px-2 py-1 outline-none text-[#fbbf24] w-48 font-bold text-center focus:bg-[#1c1c1e]"
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <div className="mt-8 pt-4 border-t border-[#2c2c2e] flex flex-col items-center gap-2 text-center text-[10px] text-[#8e8e93]">
                    <div className="font-bold text-[#34d399] flex items-center gap-3">
                      <button 
                        type="submit" 
                        className="bg-[#132c1c] border border-[#34d399]/40 hover:bg-[#1c452b] text-[#34d399] font-bold px-6 py-2 rounded transition-all text-xs cursor-pointer"
                      >
                        [ Presione ENTER para Iniciar Sesión ]
                      </button>
                    </div>
                    <div className="mt-2 font-sans text-[11px] leading-relaxed">
                      Sugerencia: Inicie sesión con <span className="text-white font-bold">QSECOFR</span> o cualquier perfil personalizado.<br />
                      (C) COPYRIGHT IBM CORP. 1980, 2026.
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  <div className="absolute top-4 right-4 text-[10px] text-[#ff453a] border border-[#ff453a]/50 bg-[#1c0808] px-2 py-1 font-bold animate-pulse uppercase rounded">
                    PANTALLA 5250 ACTIVA
                  </div>

                  {/* Title Header inside green terminal */}
                  <div className="text-white text-xs mb-4 border-b border-[#2c2c2e] pb-2 uppercase tracking-wide flex justify-between items-center">
                    <span>Simulación del Sistema Operativo OS/400 - Entrada Interactiva</span>
                    <span className="text-[#fbbf24] font-bold">[USR: {currentUser}]</span>
                  </div>

                  {/* Terminal Logs container */}
                  <div className="flex-1 overflow-y-auto mb-4 space-y-1.5 pr-2 text-xs md:text-sm select-text">
                    {terminalLogs.map((log, index) => {
                      if (log.startsWith("===>")) {
                        return (
                          <div key={index} className="flex items-center text-[#fbbf24] font-bold mt-2">
                            <span className="text-white mr-2">{"===>"}</span>
                            <span>{log.replace("===>", "").trim()}</span>
                          </div>
                        );
                      }
                      if (log.startsWith("S36 ===>")) {
                        return (
                          <div key={index} className="flex items-center text-[#34d399] font-bold mt-2">
                            <span className="text-white mr-2">{"S36 ===>"}</span>
                            <span>{log.replace("S36 ===>", "").trim()}</span>
                          </div>
                        );
                      }
                      if (log.startsWith("[SISTEMA]") || log.startsWith("[COMPILADOR]") || log.startsWith("[SESIÓN]") || log.startsWith("[S/36]")) {
                        return <div key={index} className="text-[#60a5fa]">{log}</div>;
                      }
                      if (log.startsWith("[ERROR") || log.startsWith("[SQL ERROR]") || log.startsWith("[S/36 ERROR]")) {
                        return <div key={index} className="text-[#ff453a] bg-[#1c0808] px-1 rounded inline-block">{log}</div>;
                      }
                      if (log.startsWith("[DATABASE]") || log.startsWith("[SQL SUCCESS]") || log.startsWith("[S/36 OUT]")) {
                        return <div key={index} className="text-[#34d399]">{log}</div>;
                      }
                      if (log.startsWith(">")) {
                        return <div key={index} className="text-white pl-4 border-l border-[#4ade80]/30">{log.substring(1)}</div>;
                      }
                      return <div key={index} className="opacity-95 leading-relaxed">{log}</div>;
                    })}
                    <div ref={terminalBottomRef} />
                  </div>

                  {/* CL Command prompt input */}
                  <div className="border-t border-[#2c2c2e] pt-4 mt-auto">
                    <div className="text-[#8e8e93] text-[10px] mb-2 uppercase tracking-wider">
                      {s36Mode ? "System/36 Operator Control Language (OCL)" : "Mandatos Control Language (CL) / Consultas SQL"}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={s36Mode ? "text-[#34d399] font-bold text-sm shrink-0" : "text-white font-bold text-sm shrink-0"}>{s36Mode ? "S36 ===>" : "===>"}</span>
                      <input
                        id="terminal-input"
                        ref={terminalInputRef}
                        type="text"
                        value={terminalInput}
                        onChange={(e) => setTerminalInput(e.target.value)}
                        onKeyDown={handleTerminalKeyDown}
                        placeholder={s36Mode ? "Escriba un mandato S/36 (ej. HELP, STATUS, LISTLIBR, LOAD [pgm], RUN, ENDS36) y presione Enter..." : "Escriba un mandato (ej. HELP, WRKACTJOB, PDM, STRSQL, DSPPFM FILE(QUSERPF), STRS36) y presione Enter..."}
                        className="flex-1 bg-[#111112] px-3 py-2 outline-none text-[#fbbf24] font-mono text-sm border-b-2 border-[#fbbf24] rounded-t focus:bg-[#1c1c1e] transition-colors"
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-between items-center mt-3 text-[10px] text-[#8e8e93]">
                      <div>(C) COPYRIGHT IBM CORP. 1980, 2026. LIBRERÍA GENERAL: <span className="text-white">{loginLibrary.toUpperCase() || "QGPL"}</span></div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => executeCLCommand("HELP")} 
                          className="text-[#60a5fa] hover:underline"
                        >
                          [Ver Comandos CL]
                        </button>
                        <span>|</span>
                        <button 
                          onClick={() => executeCLCommand("CLEAR")} 
                          className="text-[#ff453a] hover:underline"
                        >
                          [Limpiar]
                        </button>
                        <span>|</span>
                        <button 
                          onClick={() => executeCLCommand("SIGNOFF")} 
                          className="text-[#fbbf24] hover:underline font-bold"
                        >
                          [Cerrar Sesión (SIGNOFF)]
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* TAB 2: SEU EDITOR */}
          {activeTab === 2 && (
            <div id="tab-seu" className="flex-1 flex flex-col bg-[#050506] border border-[#2c2c2e] rounded-md overflow-hidden">
              {/* Header block resembling classic SEU Source Entry Utility */}
              <div className="bg-[#1c1c1e] px-4 py-2 border-b border-[#2c2c2e] flex flex-wrap items-center justify-between gap-2 text-xs text-[#8e8e93]">
                <div className="flex items-center gap-4">
                  <span className="text-[#fbbf24] font-bold uppercase">Source Entry Utility (SEU)</span>
                  <span className="text-white">|</span>
                  <span>Miembro: <strong className="text-white">{selectedMember.name}</strong></span>
                  <span>Tipo: <strong className="text-[#60a5fa]">{selectedMember.type}</strong></span>
                  <span>Archivo: <strong className="text-[#4ade80]">{selectedMember.srcFile}</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  {selectedMember.compiled ? (
                    <span className="bg-[#132c1c] text-[#4ade80] px-2 py-0.5 rounded text-[10px] font-bold border border-[#4ade80]/30">OBJETO CREADO</span>
                  ) : (
                    <span className="bg-[#2a1b15] text-[#fbbf24] px-2 py-0.5 rounded text-[10px] font-bold border border-[#fbbf24]/30">FUERA DE SINTAXIS / NO COMPILADO</span>
                  )}
                </div>
              </div>

              {/* Member library list sidebar + editor container split */}
              <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Source Members sidebar library */}
                <div className="w-full md:w-64 bg-[#111112] border-b md:border-b-0 md:border-r border-[#2c2c2e] p-3 flex flex-col overflow-y-auto shrink-0">
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-[#2c2c2e]">
                    <span className="text-[10px] uppercase font-bold text-white tracking-widest flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-[#fbbf24]" />
                      Miembros QGPL
                    </span>
                    <span className="text-[10px] text-[#8e8e93]">Total: {members.length}</span>
                  </div>

                  {/* List of members */}
                  <div className="space-y-1 mb-4 flex-1">
                    {members.map((m) => (
                      <button
                        key={m.name}
                        id={`member-btn-${m.name}`}
                        onClick={() => {
                          setSelectedMember(m);
                          setEditorCode(m.code);
                        }}
                        className={`w-full text-left px-2 py-1.5 rounded text-xs flex items-center justify-between transition-colors ${
                          selectedMember.name === m.name 
                            ? "bg-[#1c1c1e] text-[#fbbf24] font-bold border-l-2 border-[#fbbf24]" 
                            : "text-[#8e8e93] hover:text-white hover:bg-[#1c1c1e]"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-1.5 h-1.5 rounded-full ${m.compiled ? 'bg-[#4ade80]' : 'bg-[#ff453a]'}`}></span>
                          <span>{m.name}</span>
                        </div>
                        <span className="text-[9px] bg-[#2c2c2e] px-1 text-white opacity-70">{m.type}</span>
                      </button>
                    ))}
                  </div>

                  {/* Create Member Form */}
                  <form onSubmit={handleCreateMember} className="mt-auto border-t border-[#2c2c2e] pt-3">
                    <div className="text-[10px] uppercase text-[#8e8e93] mb-2 font-bold">Nuevo Miembro</div>
                    <input
                      id="new-member-name-input"
                      type="text"
                      placeholder="NOMBRE (ej: PROG01)"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value.toUpperCase())}
                      className="w-full bg-[#050506] border border-[#2c2c2e] px-2 py-1 text-xs text-[#fbbf24] mb-2 rounded outline-none font-mono"
                      maxLength={10}
                    />
                    <div className="grid grid-cols-3 gap-1 mb-2">
                      {(["RPG", "COBOL", "CL"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setNewMemberType(t)}
                          className={`py-1 rounded text-[10px] font-bold border transition-colors ${
                            newMemberType === t
                              ? "bg-[#1c1c1e] text-white border-[#fbbf24]"
                              : "bg-[#050506] text-[#8e8e93] border-[#2c2c2e] hover:bg-[#1c1c1e]"
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                    <button
                      id="btn-add-member"
                      type="submit"
                      className="w-full bg-[#1c1c1e] text-[#4ade80] hover:bg-[#4ade80] hover:text-black border border-[#4ade80]/40 font-bold py-1.5 rounded text-xs transition-colors flex items-center justify-center gap-1"
                    >
                      <span>+ Crear Miembro</span>
                    </button>
                  </form>
                </div>

                {/* Editor window mimicking SEU Source Editor with line numbers */}
                <div className="flex-1 flex flex-col bg-[#050506] overflow-hidden">
                  <div className="flex items-center justify-between p-2 bg-[#111112] border-b border-[#2c2c2e]">
                    <div className="text-[10px] text-[#8e8e93] flex gap-2">
                      <span>Edición secuencial</span>
                      <span>•</span>
                      <span>Soporta COBOL-400 / RPG IV / ILE RPG</span>
                    </div>
                    <div className="flex gap-2">
                      <button
                        id="btn-seu-compile"
                        onClick={compileCurrentMember}
                        disabled={compileOutput.status === "COMPILING"}
                        className="bg-[#1c1c1e] hover:bg-[#60a5fa] hover:text-black text-[#60a5fa] border border-[#60a5fa]/40 font-bold px-3 py-1 rounded text-xs transition-colors flex items-center gap-1.5"
                      >
                        {compileOutput.status === "COMPILING" ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Compilando...</span>
                          </>
                        ) : (
                          <>
                            <Cpu className="w-3.5 h-3.5" />
                            <span>[F14] Compilar</span>
                          </>
                        )}
                      </button>

                      <button
                        id="btn-seu-run"
                        onClick={runCurrentMember}
                        disabled={isExecuting}
                        className="bg-[#132c1c] hover:bg-[#4ade80] hover:text-black text-[#4ade80] border border-[#4ade80]/40 font-bold px-3 py-1 rounded text-xs transition-colors flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Ejecutar CALL</span>
                      </button>
                    </div>
                  </div>

                  {/* Split editor and outputs */}
                  <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
                    {/* Retro Grid Editor Panel */}
                    <div className="flex-1 flex overflow-hidden border-b xl:border-b-0 xl:border-r border-[#2c2c2e]">
                      {/* Fake line numbers for SEU style */}
                      <div className="w-14 bg-[#111112] text-[#8e8e93] select-none text-right pr-2 pt-3 font-mono text-xs border-r border-[#2c2c2e] space-y-[4.5px]">
                        {editorCode.split("\n").map((_, i) => (
                          <div key={i} className="hover:text-[#fbbf24]">
                            {String((i + 1) * 10).padStart(6, "0")}
                          </div>
                        ))}
                      </div>
                      <textarea
                        id="seu-editor-textarea"
                        value={editorCode}
                        onChange={(e) => setEditorCode(e.target.value)}
                        className="flex-1 bg-[#050506] text-[#4ade80] p-3 font-mono text-xs md:text-sm resize-none outline-none focus:bg-[#09090c] selection:bg-[#fbbf24] selection:text-black leading-relaxed"
                        style={{ whiteSpace: "pre", overflowWrap: "normal" }}
                        spellCheck="false"
                      />
                    </div>

                    {/* Integrated compiler errors & execution logs dashboard */}
                    <div className="w-full xl:w-96 bg-[#111112] p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
                      {/* Compile result block */}
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase font-bold text-white tracking-widest border-b border-[#2c2c2e] pb-1.5 flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5 text-[#60a5fa]" />
                          Salida de Compilación
                        </div>
                        
                        {compileOutput.status === "IDLE" && (
                          <div className="text-xs text-[#8e8e93] italic p-3 bg-[#050506] rounded border border-[#2c2c2e] flex items-center gap-2">
                            <Info className="w-4 h-4 text-[#8e8e93]" />
                            <span>Presione 'Compilar' para analizar el código con el motor {systemStatus.compilerMode === "GEMINI_COGNITIVE" ? "Cognitivo de AI Studio" : "Local de respaldo"}.</span>
                          </div>
                        )}

                        {compileOutput.status === "COMPILING" && (
                          <div className="p-4 bg-[#111625] text-[#60a5fa] rounded border border-[#60a5fa]/30 flex flex-col items-center gap-3">
                            <RefreshCw className="w-6 h-6 animate-spin text-[#60a5fa]" />
                            <div className="text-xs font-bold animate-pulse text-center">COMPILANDO MIEMBRO Legacy... EXAMINANDO DIVISIONES Y EXPRESIONES</div>
                          </div>
                        )}

                        {compileOutput.status === "SUCCESS" && (
                          <div className="p-3 bg-[#132c1c] text-[#4ade80] rounded border border-[#4ade80]/30 space-y-1">
                            <div className="text-xs font-bold flex items-center gap-1.5">
                              <CheckCircle className="w-4 h-4 text-[#4ade80]" />
                              <span>COMPILADO CORRECTAMENTE</span>
                            </div>
                            <p className="text-[11px] opacity-90 leading-relaxed">{compileOutput.message}</p>
                            {selectedMember.variables && Object.keys(selectedMember.variables).length > 0 && (
                              <div className="mt-2 pt-2 border-t border-[#4ade80]/20">
                                <span className="text-[10px] text-[#8e8e93] uppercase block mb-1">Variables de Trabajo:</span>
                                <div className="text-[10px] space-y-0.5 max-h-24 overflow-y-auto font-mono text-white">
                                  {Object.entries(selectedMember.variables).map(([name, val]) => {
                                    const v = val as { type: string; value: any; picture?: string };
                                    return (
                                      <div key={name} className="flex justify-between bg-[#050506] px-1.5 py-0.5 rounded border border-[#2c2c2e]">
                                        <span className="text-[#fbbf24]">{name}</span>
                                        <span>({v.picture || "N/A"}) : {JSON.stringify(v.value)}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {compileOutput.status === "ERROR" && (
                          <div className="p-3 bg-[#2a1212] text-[#ff453a] rounded border border-[#ff453a]/30 space-y-2">
                            <div className="text-xs font-bold flex items-center gap-1.5">
                              <XCircle className="w-4 h-4 text-[#ff453a]" />
                              <span>ERROR DE SINTAXIS LEGACY</span>
                            </div>
                            <p className="text-[11px] opacity-95">{compileOutput.message}</p>
                            <div className="space-y-1 max-h-36 overflow-y-auto pt-2 border-t border-[#ff453a]/20">
                              {compileOutput.errors.map((err, i) => (
                                <div key={i} className="text-[10px] font-mono bg-[#050506] p-1 rounded border border-[#ff453a]/10 flex items-start gap-1">
                                  <AlertTriangle className="w-3 h-3 text-[#ff453a] shrink-0 mt-0.5" />
                                  <span>{err}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Execution result block */}
                      <div className="space-y-2">
                        <div className="text-[10px] uppercase font-bold text-white tracking-widest border-b border-[#2c2c2e] pb-1.5 flex items-center gap-1">
                          <Play className="w-3.5 h-3.5 text-[#4ade80]" />
                          Resultado de Ejecución (Interactivo)
                        </div>

                        <div className="bg-[#050506] rounded border border-[#2c2c2e] p-3 text-xs min-h-36 max-h-64 overflow-y-auto space-y-1 font-mono">
                          {isExecuting ? (
                            <div className="flex flex-col items-center justify-center py-6 gap-2 text-white">
                              <RefreshCw className="w-5 h-5 animate-spin text-[#4ade80]" />
                              <span className="text-[10px] animate-pulse">Ejecutando en Entorno Emulado...</span>
                            </div>
                          ) : executionLog.length === 0 ? (
                            <div className="text-[#8e8e93] italic text-center py-6">
                              Haga click en 'Ejecutar CALL' para ver la salida interactiva del programa.
                            </div>
                          ) : (
                            executionLog.map((log, i) => (
                              <div 
                                key={i} 
                                className={`${
                                  log.startsWith("---") 
                                    ? "text-[#8e8e93] font-bold border-y border-[#2c2c2e] py-1 my-1" 
                                    : log.startsWith("[DATABASE]") 
                                    ? "text-[#34d399]" 
                                    : log.startsWith("[SYSTEM]") 
                                    ? "text-[#60a5fa]" 
                                    : "text-white pl-1.5"
                                }`}
                              >
                                {log}
                              </div>
                            ))
                          )}
                        </div>

                        {executionDetails && (
                          <div className="bg-[#1a1505] border border-[#fbbf24]/30 rounded p-2.5">
                            <span className="text-[10px] font-bold text-[#fbbf24] uppercase block mb-1 flex items-center gap-1">
                              <Lightbulb className="w-3.5 h-3.5 text-[#fbbf24]" />
                              Tutor de Ejecución iSeries:
                            </span>
                            <p className="text-[11px] text-[#e4e4e7] leading-relaxed">{executionDetails}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DB2 DATABASE EXPLORER */}
          {activeTab === 3 && (
            <div id="tab-db2" className="flex-1 flex flex-col bg-[#050506] border border-[#2c2c2e] p-4 rounded-md overflow-hidden">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-4 border-b border-[#2c2c2e] pb-3 gap-2">
                <div>
                  <h2 className="text-white font-bold text-sm flex items-center gap-2">
                    <Database className="w-4 h-4 text-[#4ade80]" />
                    DB2/400 Virtual Relational Database Engine
                  </h2>
                  <p className="text-[11px] text-[#8e8e93] mt-0.5">Explora archivos físicos (Physical Files - DDS) definidos en el entorno local.</p>
                </div>
                <div className="bg-[#1c1c1e] px-2.5 py-1 rounded text-[10px] text-white border border-[#2c2c2e] self-start sm:self-auto flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4ade80]"></span>
                  <span>Motor DB2 Conectado</span>
                </div>
              </div>

              {/* Db files layout */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 overflow-y-auto pr-1">
                {dbFiles.map((file) => (
                  <div key={file.name} className="bg-[#111112] border border-[#2c2c2e] rounded p-4 flex flex-col h-[320px]">
                    <div className="flex items-center justify-between border-b border-[#2c2c2e] pb-2 mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 bg-[#4ade80] rounded-sm"></div>
                        <span className="text-white font-bold text-sm tracking-widest">{file.name}</span>
                        <span className="text-[10px] text-[#8e8e93] uppercase bg-[#1c1c1e] px-1.5 py-0.5 rounded border border-[#2c2c2e]">Archivo Físico PF</span>
                      </div>
                      <span className="text-[11px] text-[#8e8e93]">Registros: <strong className="text-[#4ade80]">{file.records.length}</strong></span>
                    </div>

                    <div className="text-[10px] uppercase text-[#8e8e93] tracking-widest font-bold mb-1.5">DDS Campos (Esquema):</div>
                    <div className="flex flex-wrap gap-1.5 mb-4">
                      {file.schema.map((col) => (
                        <span key={col} className="bg-[#1c1c1e] text-white text-[10px] px-2 py-0.5 rounded border border-[#2c2c2e]">
                          {col} <span className="text-[#8e8e93] font-normal">({col === "ID" || col === "VALUE" ? "ZONED" : "CHAR"})</span>
                        </span>
                      ))}
                    </div>

                    {/* Records Table */}
                    <div className="flex-1 overflow-y-auto bg-[#050506] rounded border border-[#2c2c2e] p-2">
                      {file.records.length === 0 ? (
                        <div className="text-xs text-[#8e8e93] italic text-center py-8">No hay registros cargados. Compile y ejecute un programa para insertar datos.</div>
                      ) : (
                        <table className="w-full text-left font-mono text-[11px]">
                          <thead>
                            <tr className="border-b border-[#2c2c2e] text-[#8e8e93] uppercase">
                              {file.schema.map((col) => (
                                <th key={col} className="pb-1.5 pr-2">{col}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {file.records.map((rec, idx) => (
                              <tr key={idx} className="border-b border-[#1c1c1e] last:border-0 hover:bg-[#111112] text-[#4ade80]">
                                {file.schema.map((col) => (
                                  <td key={col} className="py-1.5 pr-2 max-w-[150px] truncate" title={String(rec[col])}>
                                    {String(rec[col])}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* DB Quick test console instructions */}
              <div className="mt-4 p-3 bg-[#1c1c1e] rounded border border-[#2c2c2e] flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs text-[#8e8e93]">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-[#fbbf24] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">
                    Puede probar inserciones dinámicas SQL en esta base de datos local usando el mandato <strong className="text-white">STRSQL</strong> en la terminal principal, o ejecutando un programa en RPG/COBOL que contenga llamadas <strong className="text-white">WRITE</strong>.
                  </p>
                </div>
                <button 
                  onClick={() => setActiveTab(1)} 
                  className="bg-[#050506] hover:bg-[#fbbf24] hover:text-black border border-[#fbbf24]/40 text-[#fbbf24] font-bold px-3 py-1.5 rounded text-[11px] transition-colors shrink-0"
                >
                  Ir a Terminal STRSQL
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: TUTORIAL TRAINING MISSIONS */}
          {activeTab === 4 && (
            <div id="tab-training" className="flex-1 flex flex-col bg-[#050506] border border-[#2c2c2e] p-4 rounded-md overflow-hidden">
              <div className="border-b border-[#2c2c2e] pb-3 mb-4">
                <h2 className="text-white font-bold text-sm flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-[#fbbf24]" />
                  Academia y Centro de Entrenamiento iSeries AS/400
                </h2>
                <p className="text-[11px] text-[#8e8e93] mt-0.5">Misiones estructuradas e interactivas para que desarrolladores modernos aprendan la lógica de sistemas legacy.</p>
              </div>

              <div className="flex-1 flex flex-col xl:flex-row gap-6 overflow-y-auto pr-1">
                {/* Missions catalog */}
                <div className="flex-1 space-y-4">
                  <div className="text-xs text-[#8e8e93] uppercase tracking-widest font-bold mb-1">Misiones Disponibles</div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {TUTORIAL_MISSIONS.map((mission) => {
                      const isSelected = activeMission?.id === mission.id;
                      return (
                        <div 
                          key={mission.id} 
                          className={`bg-[#111112] border p-4 rounded flex flex-col justify-between transition-all ${
                            isSelected 
                              ? "border-[#fbbf24] ring-1 ring-[#fbbf24]/50 shadow-md bg-[#1a1505]" 
                              : "border-[#2c2c2e] hover:border-[#8e8e93]"
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                                mission.difficulty === "Básico" ? "bg-[#132c1c] text-[#4ade80]" : "bg-[#111625] text-[#60a5fa]"
                              }`}>
                                {mission.difficulty}
                              </span>
                              <span className="text-[11px] text-white bg-[#1c1c1e] px-2 py-0.5 rounded font-bold border border-[#2c2c2e]">{mission.language}</span>
                            </div>
                            <h3 className="text-white font-bold text-sm mb-1.5">{mission.title}</h3>
                            <p className="text-xs text-[#8e8e93] leading-relaxed mb-4">{mission.description}</p>
                          </div>

                          <button
                            id={`btn-start-mission-${mission.id}`}
                            onClick={() => selectMission(mission)}
                            className={`w-full py-2 rounded text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                              isSelected
                                ? "bg-[#fbbf24] text-black"
                                : "bg-[#1c1c1e] text-white hover:bg-[#fbbf24] hover:text-black border border-[#2c2c2e]"
                            }`}
                          >
                            <span>{isSelected ? "MISIÓN EN PROGRESO" : "INICIAR ESTA MISIÓN"}</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {/* AI Tutor chat widget with Expert */}
                  <div className="bg-[#111112] border border-[#2c2c2e] p-5 rounded mt-6">
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2c2c2e]">
                      <Cpu className="w-5 h-5 text-[#60a5fa]" />
                      <div>
                        <h3 className="text-white font-bold text-sm">Consultor Experto iSeries AS/400 (AI Coach)</h3>
                        <p className="text-[10px] text-[#8e8e93]">Realiza preguntas complejas sobre COBOL, RPG, comandos CL o arquitectura IBM i.</p>
                      </div>
                    </div>

                    <form onSubmit={askAITutor} className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          id="ai-tutor-input"
                          type="text"
                          value={tutorQuestion}
                          onChange={(e) => setTutorQuestion(e.target.value)}
                          placeholder="Ej: ¿Qué diferencia hay entre un archivo físico y lógico? ¿Cómo funcionan las hojas de cálculo en RPG?"
                          className="flex-1 bg-[#050506] border border-[#2c2c2e] rounded px-3 py-2 text-xs text-[#fbbf24] outline-none font-mono focus:border-[#fbbf24]"
                        />
                        <button
                          id="btn-ask-tutor"
                          type="submit"
                          disabled={tutorLoading}
                          className="bg-[#1c1c1e] hover:bg-[#60a5fa] hover:text-black border border-[#60a5fa]/40 text-[#60a5fa] font-bold px-4 py-2 rounded text-xs transition-colors shrink-0 flex items-center gap-1.5"
                        >
                          {tutorLoading ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>Analizando...</span>
                            </>
                          ) : (
                            <>
                              <Lightbulb className="w-3.5 h-3.5" />
                              <span>Preguntar</span>
                            </>
                          )}
                        </button>
                      </div>

                      {tutorAnswer && (
                        <div className="bg-[#050506] rounded border border-[#2c2c2e] p-4 text-xs space-y-2 max-h-[300px] overflow-y-auto">
                          <div className="text-[#60a5fa] font-bold flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-[#60a5fa]" />
                            <span>RESPUESTA DEL INGENIERO COGNITIVO IBM:</span>
                          </div>
                          <p className="text-[#e4e4e7] leading-relaxed whitespace-pre-wrap font-sans">{tutorAnswer}</p>
                        </div>
                      )}
                    </form>
                  </div>
                </div>

                {/* Left hand objective viewer if mission selected */}
                {activeMission && (
                  <div className="w-full xl:w-80 bg-[#111112] border border-[#fbbf24]/30 rounded p-4 flex flex-col shrink-0">
                    <div className="text-xs uppercase text-[#fbbf24] font-bold tracking-widest border-b border-[#2c2c2e] pb-2 mb-3">
                      Lista de Control de Misión
                    </div>
                    <p className="text-[11px] text-[#8e8e93] mb-4 leading-relaxed">{activeMission.description}</p>
                    
                    <div className="space-y-4 flex-1">
                      {activeMission.objectives.map((obj, index) => {
                        const isDone = missionObjectivesProgress[index];
                        return (
                          <div key={index} className="flex gap-2.5 items-start">
                            <div className="mt-0.5">
                              {isDone ? (
                                <CheckCircle className="w-4 h-4 text-[#4ade80] shrink-0" />
                              ) : (
                                <div className="w-4 h-4 rounded-full border border-[#8e8e93] flex items-center justify-center text-[10px] text-[#8e8e93] font-bold shrink-0">
                                  {index + 1}
                                </div>
                              )}
                            </div>
                            <div className="text-xs">
                              <span className={`${isDone ? 'line-through text-[#8e8e93]' : 'text-white font-medium'}`}>
                                {obj}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-6 pt-3 border-t border-[#2c2c2e] bg-[#050506] p-3 rounded">
                      <span className="text-[10px] text-[#fbbf24] uppercase font-bold block mb-1">💡 Consejos Rápidos:</span>
                      <ul className="text-[10px] text-[#8e8e93] list-disc list-inside space-y-1">
                        {activeMission.hints.map((hint, i) => (
                          <li key={i} className="leading-relaxed">{hint}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 5: LEGACY BRIDGE INTEGRATION GUIDE */}
          {activeTab === 5 && (
            <div id="tab-bridge" className="flex-1 flex flex-col bg-[#050506] border border-[#2c2c2e] p-4 rounded-md overflow-hidden">
              <div className="border-b border-[#2c2c2e] pb-3 mb-4">
                <h2 className="text-white font-bold text-sm flex items-center gap-2">
                  <Settings className="w-4 h-4 text-[#60a5fa]" />
                  IBM iSeries AS/400 Local Integration Bridge
                </h2>
                <p className="text-[11px] text-[#8e8e93] mt-0.5">Aprende a integrar este simulador y compilador de COBOL / RPG con tus entornos de prueba locales a través de APIs REST.</p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-6 pr-1 text-xs select-text">
                <div className="bg-[#111112] border border-[#2c2c2e] p-4 rounded space-y-2">
                  <h3 className="text-white font-bold text-sm flex items-center gap-1.5">
                    <Code className="w-4 h-4 text-[#fbbf24]" />
                    ¿Cómo funciona este entorno de pruebas local?
                  </h3>
                  <p className="text-[#8e8e93] leading-relaxed text-xs">
                    Este emulador iSeries expone endpoints REST en el servidor Node.js que te permiten enviar código RPG y COBOL para su compilación y posterior ejecución interpretada. En un entorno de desarrollo local real o en tus pruebas continuas, puedes mandar fragmentos legacy de tus mainframes y obtener respuestas parseadas para realizar auditorías de lógica, migraciones automáticas o validaciones rápidas.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Endpoint 1 Compile */}
                  <div className="bg-[#111112] border border-[#2c2c2e] p-4 rounded space-y-3">
                    <div className="flex items-center justify-between border-b border-[#2c2c2e] pb-2">
                      <span className="text-[#fbbf24] font-bold">1. Servicio de Compilación</span>
                      <span className="text-[9px] bg-[#2a1212] text-[#ff453a] px-1.5 rounded font-bold border border-[#ff453a]/20">POST</span>
                    </div>
                    <code className="text-white bg-[#050506] px-2 py-1.5 rounded block font-mono text-[11px]">
                      /api/as400/compile
                    </code>
                    <p className="text-[#8e8e93] text-[11px] leading-relaxed">
                      Envía código de miembro fuente y el tipo (COBOL o RPG) para extraer variables, archivos y buscar advertencias estructurales.
                    </p>
                    <div className="text-[10px] text-white font-bold mt-2">Payload de Ejemplo JSON:</div>
                    <pre className="bg-[#050506] p-2.5 rounded text-[10px] text-[#4ade80] border border-[#2c2c2e] overflow-x-auto">
{`{
  "code": "       IDENTIFICATION DIVISION.\\n       PROGRAM-ID. EJEMPLO...",
  "type": "COBOL",
  "name": "EJEMPLO"
}`}
                    </pre>
                  </div>

                  {/* Endpoint 2 Run */}
                  <div className="bg-[#111112] border border-[#2c2c2e] p-4 rounded space-y-3">
                    <div className="flex items-center justify-between border-b border-[#2c2c2e] pb-2">
                      <span className="text-[#fbbf24] font-bold">2. Servicio de Ejecución</span>
                      <span className="text-[9px] bg-[#2a1212] text-[#ff453a] px-1.5 rounded font-bold border border-[#ff453a]/20">POST</span>
                    </div>
                    <code className="text-white bg-[#050506] px-2 py-1.5 rounded block font-mono text-[11px]">
                      /api/as400/execute
                    </code>
                    <p className="text-[#8e8e93] text-[11px] leading-relaxed">
                      Interpreta de manera lógica las variables de memoria, actualiza los Physical Files locales en base a comandos de escritura e imprime la salida de consola virtual.
                    </p>
                    <div className="text-[10px] text-white font-bold mt-2">Payload de Ejemplo JSON:</div>
                    <pre className="bg-[#050506] p-2.5 rounded text-[10px] text-[#4ade80] border border-[#2c2c2e] overflow-x-auto">
{`{
  "code": "**FREE\\ndsply 'HOLA';\\nwrite QRPGPF;",
  "type": "RPG",
  "variables": {
    "VALOR": { "type": "DECIMAL", "value": 150.00 }
  }
}`}
                    </pre>
                  </div>
                </div>

                {/* Node JS integration client template */}
                <div className="bg-[#111112] border border-[#2c2c2e] p-4 rounded space-y-2">
                  <h3 className="text-white font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                    <ExternalLink className="w-4 h-4 text-[#60a5fa]" />
                    Script Cliente de Pruebas Integradas (Node.JS)
                  </h3>
                  <p className="text-[#8e8e93]">Puedes ejecutar este fragmento de código local en tus servidores para validar la conexión y ejecutar llamadas remotas:</p>
                  <pre className="bg-[#050506] p-4 rounded text-[10px] text-[#4ade80] border border-[#2c2c2e] overflow-x-auto leading-relaxed">
{`import fetch from 'node-fetch';

async function testLegacyCompile() {
  const code = \`
       IDENTIFICATION DIVISION.
       PROGRAM-ID. COBTEST.
       PROCEDURE DIVISION.
           DISPLAY "PROBANDO INTEGRACION LOCAL DESDE REST".
           GOBACK.
  \`;

  const response = await fetch('http://localhost:3000/api/as400/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, type: 'COBOL', name: 'COBTEST' })
  });

  const result = await response.json();
  console.log('Compilación AS/400 remota:', result.status);
  console.log('Variables detectadas:', result.variables);
}

testLegacyCompile();`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: ABOUT & GITHUB README */}
          {activeTab === 6 && (
            <div id="tab-about" className="flex-1 flex flex-col bg-[#050506] border border-[#2c2c2e] p-6 rounded-md overflow-hidden select-text">
              {/* GitHub Repository Header */}
              <div className="border-b border-[#2c2c2e] pb-4 mb-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[#60a5fa] font-bold text-lg hover:underline cursor-pointer">alberto-arce</span>
                      <span className="text-[#8e8e93] text-lg">/</span>
                      <span className="text-white font-bold text-lg hover:underline cursor-pointer">iseries-as400-s36-emulator</span>
                      <span className="text-[10px] border border-[#2c2c2e] text-[#8e8e93] px-2 py-0.5 rounded-full font-semibold bg-[#111112]">Public</span>
                    </div>
                    <p className="text-xs text-[#8e8e93] mt-1.5 leading-relaxed">
                      Emulador avanzado multipropósito del sistema operativo OS/400 de IBM iSeries AS/400 con soporte nativo de compilación/ejecución para RPG & COBOL y compatibilidad heredada de System/36 (OCL).
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <div className="flex items-center bg-[#111112] border border-[#2c2c2e] rounded font-mono">
                      <span className="px-2.5 py-1 text-[#8e8e93] border-r border-[#2c2c2e] bg-[#1c1c1e]">S36 Mode</span>
                      <span className="px-2.5 py-1 text-[#4ade80] font-bold">STRS36</span>
                    </div>
                    <div className="flex items-center bg-[#111112] border border-[#2c2c2e] rounded font-mono">
                      <span className="px-2.5 py-1 text-[#8e8e93] border-r border-[#2c2c2e] bg-[#1c1c1e]">Autor</span>
                      <span className="px-2.5 py-1 text-[#fbbf24] font-bold">Alberto Arce</span>
                    </div>
                  </div>
                </div>

                {/* Repository Stats Badges */}
                <div className="flex flex-wrap gap-3 mt-4 text-[11px] font-mono text-[#8e8e93]">
                  <span className="flex items-center gap-1 bg-[#111112] px-2.5 py-1 rounded border border-[#2c2c2e]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#3178c6]"></span> TypeScript 78.4%
                  </span>
                  <span className="flex items-center gap-1 bg-[#111112] px-2.5 py-1 rounded border border-[#2c2c2e]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#e34c26]"></span> HTML 12.1%
                  </span>
                  <span className="flex items-center gap-1 bg-[#111112] px-2.5 py-1 rounded border border-[#2c2c2e]">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#38bdf8]"></span> Tailwind 9.5%
                  </span>
                  <span className="flex items-center gap-1 bg-[#111112] px-2.5 py-1 rounded border border-[#2c2c2e]">
                    🌟 Stars: <strong className="text-white">1,424</strong>
                  </span>
                  <span className="flex items-center gap-1 bg-[#111112] px-2.5 py-1 rounded border border-[#2c2c2e]">
                    🍴 Forks: <strong className="text-white">289</strong>
                  </span>
                  <span className="flex items-center gap-1 bg-[#111112] px-2.5 py-1 rounded border border-[#2c2c2e]">
                    🛡️ License: <strong className="text-white">MIT</strong>
                  </span>
                </div>
              </div>

              {/* GitHub File Viewer Mock & Readme Title */}
              <div className="flex-1 overflow-y-auto space-y-6 pr-2">
                <div className="bg-[#111112] border border-[#2c2c2e] rounded-md overflow-hidden">
                  <div className="bg-[#1c1c1e] px-4 py-2 border-b border-[#2c2c2e] flex items-center justify-between text-xs text-[#8e8e93] font-mono">
                    <div className="flex items-center gap-2">
                      <Code className="w-4 h-4 text-[#fbbf24]" />
                      <span className="text-white font-bold">README.md</span>
                    </div>
                    <span>8.24 KB</span>
                  </div>

                  {/* Complete Readme Content */}
                  <div className="p-6 md:p-8 space-y-6 text-xs md:text-sm text-[#d1d1d6] leading-relaxed select-text font-sans">
                    {/* Title */}
                    <div className="border-b border-[#2c2c2e] pb-4">
                      <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5 font-sans">
                        IBM iSeries AS/400 & System/36 Emulator Core
                      </h1>
                      <p className="text-[#8e8e93] text-sm mt-1">
                        Un entorno interactivo y moderno que emula los sistemas de rango medio de IBM, desarrollado para ingenieros de software, analistas y entusiastas del software legado.
                      </p>
                    </div>

                    {/* Autor Box */}
                    <div className="bg-[#1c1a12] border border-[#fbbf24]/30 rounded-lg p-4 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#fbbf24]/10 border border-[#fbbf24]/30 flex items-center justify-center font-mono text-[#fbbf24] text-xl font-bold">
                        AA
                      </div>
                      <div>
                        <div className="text-[10px] text-[#fbbf24] uppercase tracking-wider font-bold font-mono">Autoría del Proyecto</div>
                        <h4 className="text-white font-bold text-sm">Alberto Arce</h4>
                        <p className="text-[11px] text-[#8e8e93] leading-normal">
                          Diseñador y desarrollador principal de la suite iSeries AS/400 & System/36 Emulator para entornos web interactivos, implementando el parseador semántico deterministic e integraciones cognitivas con Gemini AI.
                        </p>
                      </div>
                    </div>

                    {/* Features Section */}
                    <div className="space-y-3">
                      <h2 className="text-lg font-bold text-white tracking-tight border-b border-[#2c2c2e] pb-1">
                        🚀 Características Principales
                      </h2>
                      <ul className="list-disc list-inside space-y-2 text-[#a1a1aa]">
                        <li>
                          <strong className="text-white">Terminal Interactive 5250:</strong> Pantalla verde emulada por consola con respuesta en tiempo real y soporte para comandos CL tradicionales de IBM i.
                        </li>
                        <li>
                          <strong className="text-white">Entorno System/36 Completo:</strong> Activado mediante el mandato <code className="text-[#fbbf24] font-mono bg-[#111112] px-1 py-0.5 rounded">STRS36</code>, permitiendo ejecutar Operator Control Language (OCL) y simular la compatibilidad heredada con la arquitectura S/36.
                        </li>
                        <li>
                          <strong className="text-white">Editor SEU (Source Entry Utility):</strong> Escribe, compila y depura código RPG y COBOL directamente en un editor web de formato rígido clásico.
                        </li>
                        <li>
                          <strong className="text-white">Base de Datos DB2/400 Virtual:</strong> Archivos Físicos (Physical Files - PF) reales interpretados por un motor SQL simulado con soporte para consultas de datos dinámicas.
                        </li>
                        <li>
                          <strong className="text-white">Puente de Integración REST:</strong> API endpoints locales listos para conectarse con CI/CD de desarrollo y herramientas de análisis estático del mainframe.
                        </li>
                      </ul>
                    </div>

                    {/* System/36 Section */}
                    <div className="space-y-3">
                      <h2 className="text-lg font-bold text-white tracking-tight border-b border-[#2c2c2e] pb-1">
                        💻 El Entorno System/36 (STRS36)
                      </h2>
                      <p className="text-[#a1a1aa]">
                        El System/36 fue una de las computadoras multiusuario más exitosas de IBM, lanzada en 1983. Este emulador proporciona un entorno de compatibilidad total integrado en OS/400. Al escribir <code className="text-[#fbbf24] font-mono bg-[#111112] px-1 py-0.5 rounded">STRS36</code> en la consola principal, se iniciará la CPU virtualizada y se habilitará un amplio espectro de mandatos:
                      </p>
                      <div className="bg-[#050506] border border-[#2c2c2e] rounded overflow-hidden font-mono text-[11px]">
                        <div className="bg-[#1c1c1e] px-4 py-1.5 border-b border-[#2c2c2e] text-white font-bold">
                          Catálogo de Mandatos S/36 Soportados
                        </div>
                        <div className="p-4 space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div><strong className="text-[#fbbf24]">FLIB [librería]</strong> - Cambia la librería actual activa de S/36.</div>
                            <div><strong className="text-[#fbbf24]">BLDLIBR [nombre]</strong> - Crea una librería en el sector S/36 virtual.</div>
                            <div><strong className="text-[#fbbf24]">LISTLIBR</strong> - Enlista detalladamente los miembros RPG y COBOL.</div>
                            <div><strong className="text-[#fbbf24]">LOAD [programa]</strong> - Carga un programa compilado en el procesador virtual.</div>
                            <div><strong className="text-[#fbbf24]">RUN</strong> - Ejecuta el programa cargado, con llamadas e interpretación lógica.</div>
                            <div><strong className="text-[#fbbf24]">STATUS</strong> - Revisa la salud del microprocesador S/36 emulado.</div>
                            <div><strong className="text-[#fbbf24]">FREE [programa]</strong> - Libera el programa de la memoria RAM emulada.</div>
                            <div><strong className="text-[#fbbf24]">SST</strong> - Llama a las herramientas de depuración de hardware virtuales.</div>
                            <div><strong className="text-[#fbbf24]">ENDS36 / OFF</strong> - Apaga la máquina virtual S/36 y regresa al CL nativo.</div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* OS/400 CL Section */}
                    <div className="space-y-3">
                      <h2 className="text-lg font-bold text-white tracking-tight border-b border-[#2c2c2e] pb-1">
                        🛠️ Mandatos Generales de OS/400 CL Emulados
                      </h2>
                      <p className="text-[#a1a1aa]">
                        La terminal nativa soporta los comandos de Control Language más utilizados en entornos de producción:
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-xs text-[#a1a1aa]">
                        <div className="bg-[#111112] p-3 rounded border border-[#2c2c2e]">
                          <strong className="text-white">WRKACTJOB</strong>
                          <p className="text-[#8e8e93] text-[11px] mt-1">Permite monitorizar los trabajos por lote (BATCH) y trabajos interactivos de usuario, mostrando consumo de CPU en tiempo real.</p>
                        </div>
                        <div className="bg-[#111112] p-3 rounded border border-[#2c2c2e]">
                          <strong className="text-white">WRKMBRPDM / PDM</strong>
                          <p className="text-[#8e8e93] text-[11px] mt-1">Abre el utilitario Program Development Manager para editar y compilar miembros fuente RPG o COBOL.</p>
                        </div>
                        <div className="bg-[#111112] p-3 rounded border border-[#2c2c2e]">
                          <strong className="text-white">STRSQL</strong>
                          <p className="text-[#8e8e93] text-[11px] mt-1">Inicia la consola interactiva DB2 para consultar, insertar y actualizar registros en Physical Files físicos de manera dinámica.</p>
                        </div>
                        <div className="bg-[#111112] p-3 rounded border border-[#2c2c2e]">
                          <strong className="text-white">DSPPFM FILE(nombre)</strong>
                          <p className="text-[#8e8e93] text-[11px] mt-1">Visualiza los datos directamente a nivel de bytes en un archivo físico, respetando el formato de registro y schema definido.</p>
                        </div>
                      </div>
                    </div>

                    {/* How to deploy Section */}
                    <div className="space-y-3">
                      <h2 className="text-lg font-bold text-white tracking-tight border-b border-[#2c2c2e] pb-1">
                        📦 Instalación y Despliegue Local
                      </h2>
                      <p className="text-[#a1a1aa]">
                        Para clonar y desplegar este emulador en tu servidor de desarrollo o entorno de integración local:
                      </p>
                      <pre className="bg-[#050506] p-4 rounded text-xs text-[#4ade80] border border-[#2c2c2e] overflow-x-auto leading-relaxed font-mono">
{`# 1. Clonar el repositorio de Alberto Arce
git clone https://github.com/alberto-arce/iseries-as400-s36-emulator.git
cd iseries-as400-s36-emulator

# 2. Instalar dependencias requeridas
npm install

# 3. Lanzar servidor de desarrollo local de alta velocidad (Vite + Express)
npm run dev

# 4. Generar empaquetado optimizado de producción para despliegues en contenedores Cloud Run
npm run build
npm start`}
                      </pre>
                    </div>

                    {/* Technology Stack */}
                    <div className="space-y-3">
                      <h2 className="text-lg font-bold text-white tracking-tight border-b border-[#2c2c2e] pb-1">
                        🧩 Arquitectura Tecnológica
                      </h2>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        <div className="p-3 bg-[#111112] border border-[#2c2c2e] rounded">
                          <h4 className="text-white font-bold mb-1">Frontend / UX</h4>
                          <p className="text-[#8e8e93]">React 18 con Vite, Tailwind CSS para el diseño pixel-perfect de la terminal de fósforo verde, componentes animados con Framer Motion y set de íconos Lucide React.</p>
                        </div>
                        <div className="p-3 bg-[#111112] border border-[#2c2c2e] rounded">
                          <h4 className="text-white font-bold mb-1">Backend / Intérprete</h4>
                          <p className="text-[#8e8e93]">Servidor Express.js en Node.js que procesa compresión y simulación semántica de programas RPG/COBOL por lote, con reestructuración dinámica de variables.</p>
                        </div>
                        <div className="p-3 bg-[#111112] border border-[#2c2c2e] rounded">
                          <h4 className="text-white font-bold mb-1">Motor Cognitivo</h4>
                          <p className="text-[#8e8e93]">Conexión nativa con la API de Gemini 3.5 mediante el SDK de Google GenAI para proveer un tutor interactivo y reportes inteligentes de compilación legacy.</p>
                        </div>
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* RIGHT SIDEBAR PANEL: ENVIRONMENT STATUS & SYSTEM JOBS */}
        <aside id="as400-sidebar" className="hidden md:flex w-72 bg-[#111112] border-l border-[#2c2c2e] p-4 flex-col gap-5 overflow-y-auto shrink-0 select-none">
          
          {/* Active profile & switch quick header */}
          <div className="space-y-2">
            <h3 className="text-[10px] text-white uppercase tracking-wider border-b border-[#2c2c2e] pb-1 font-bold">Perfil del Sistema</h3>
            <div className="bg-[#050506] p-3 rounded border border-[#2c2c2e] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8e8e93]">Usuario Activo</span>
                <span className="text-white font-bold">{currentUser}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-[#8e8e93]">Biblioteca actual</span>
                <span className="text-[#fbbf24]">QGPL</span>
              </div>
              <button 
                id="btn-switch-user"
                onClick={() => {
                  const u = currentUser === "QSECOFR" ? "DEVELOPER" : "QSECOFR";
                  setCurrentUser(u);
                  setTerminalLogs(prev => [...prev.slice(0, -1), `[SESIÓN] Cambió perfil de usuario a: ${u}`, "===>"]);
                }}
                className="w-full mt-2 bg-[#1c1c1e] hover:bg-[#fbbf24] hover:text-black text-[10px] font-bold text-white py-1 rounded transition-all uppercase border border-[#2c2c2e]"
              >
                Cambiar Usuario
              </button>
            </div>
          </div>

          {/* AS/400 Virtual Infrastructure status */}
          <div className="space-y-2">
            <h3 className="text-[10px] text-white uppercase tracking-wider border-b border-[#2c2c2e] pb-1 font-bold">Infraestructura Virtual</h3>
            <div className="space-y-2.5">
              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-[#8e8e93] uppercase">Motor de DB2/400</span>
                <div className="flex justify-between items-center bg-[#1c1c1e] p-2 rounded border border-[#2c2c2e]">
                  <span className="text-[11px] text-white">Relational Virtual PF</span>
                  <span className="w-2 h-2 rounded-full bg-[#4ade80]" title="DB2 local conectado"></span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-[9px] text-[#8e8e93] uppercase">Compilador Cognitivo AI</span>
                <div className="flex justify-between items-center bg-[#1c1c1e] p-2 rounded border border-[#2c2c2e]">
                  <span className="text-[11px] text-white">
                    {systemStatus.compilerMode === "GEMINI_COGNITIVE" ? "Gemini 3.5 Active" : "Local Deterministic"}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${systemStatus.compilerMode === "GEMINI_COGNITIVE" ? "bg-[#60a5fa] animate-pulse" : "bg-[#fbbf24]"}`}></span>
                </div>
              </div>
            </div>
          </div>

          {/* Dynamic Job queue scheduler visualizer */}
          <div className="space-y-2">
            <div className="flex justify-between items-center border-b border-[#2c2c2e] pb-1">
              <h3 className="text-[10px] text-white uppercase tracking-wider font-bold">Trabajos Activos (SBT)</h3>
              <button 
                onClick={() => {
                  // Simulate job changes
                  setJobs(prev => prev.map(j => ({ ...j, cpu: Math.random() * 2 })));
                }}
                className="text-[#60a5fa] hover:underline text-[9px] uppercase"
              >
                [Refrescar]
              </button>
            </div>
            <div className="text-[10px] font-mono space-y-1 bg-[#050506] p-2.5 rounded border border-[#2c2c2e] max-h-40 overflow-y-auto">
              <div className="flex justify-between text-[#8e8e93] border-b border-[#2c2c2e] mb-1 pb-1">
                <span>TRABAJO</span>
                <span>ESTADO</span>
                <span>% CPU</span>
              </div>
              {jobs.map((job) => (
                <div key={job.id} className="flex justify-between items-center text-xs">
                  <span className="text-white" title={job.function}>{job.name}</span>
                  <span className={`px-1 rounded text-[9px] ${
                    job.status === "RUN" 
                      ? "bg-[#132c1c] text-[#4ade80]" 
                      : job.status === "MSGW" 
                      ? "bg-[#2a1c0d] text-[#fbbf24]" 
                      : "bg-[#1c1c1e] text-[#8e8e93]"
                  }`}>{job.status}</span>
                  <span className="text-white font-semibold">{job.cpu.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Operator Message queue alerts log */}
          <div className="space-y-2">
            <h3 className="text-[10px] text-white uppercase tracking-wider border-b border-[#2c2c2e] pb-1 font-bold">Cola del Operador (QSYSOPR)</h3>
            <div className="bg-[#050506] p-2.5 rounded border border-[#2c2c2e] space-y-2 max-h-48 overflow-y-auto">
              {messages.map((msg) => (
                <div key={msg.id} className="text-[10px] border-b border-[#1c1c1e] last:border-0 pb-1.5 mb-1.5 leading-normal">
                  <div className="flex justify-between text-[#8e8e93] mb-0.5">
                    <span>De: <strong className="text-white">{msg.sender}</strong></span>
                    <span>{msg.timestamp}</span>
                  </div>
                  <p className={`${msg.type === "WARNING" ? "text-[#fbbf24]" : "text-[#4ade80]"}`}>
                    {msg.text}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Short training banner helper */}
          <div className="mt-auto p-3.5 bg-[#1c1c1e] rounded border border-[#2c2c2e]">
            <h4 className="text-[10px] text-white uppercase font-bold mb-1 flex items-center gap-1">
              <Lightbulb className="w-3.5 h-3.5 text-[#fbbf24]" />
              Sugerencia de Aprendizaje
            </h4>
            <p className="text-[11px] leading-relaxed text-[#8e8e93]">
              Para trabajar con el gestor de fuentes clásico escribe <strong className="text-[#fbbf24]">PDM</strong> o <strong className="text-[#fbbf24]">WRKMBRPDM</strong> y presione Enter en la Consola 5250.
            </p>
          </div>

        </aside>
      </div>

      {/* FOOTER ACTION ASSIGNMENTS */}
      <footer id="as400-footer" className="h-12 bg-[#1c1c1e] flex flex-wrap items-center px-6 gap-x-6 gap-y-1 text-[11px] text-[#8e8e93] border-t border-[#2c2c2e] shrink-0 overflow-x-auto">
        <button 
          onClick={() => {
            setActiveTab(1);
            setTerminalLogs(["SISTEMA REINICIADO POR USUARIO", "===>"]);
          }} 
          className="flex items-center gap-1 text-[#8e8e93] hover:text-[#fbbf24] transition-colors"
        >
          <span className="text-white font-bold">F3=</span>Salir/Reiniciar
        </button>
        <button 
          onClick={() => {
            setActiveTab(1);
            setTerminalInput("HELP");
            executeCLCommand("HELP");
          }}
          className="flex items-center gap-1 text-[#8e8e93] hover:text-[#fbbf24] transition-colors"
        >
          <span className="text-white font-bold">F4=</span>Ayuda Mandatos CL
        </button>
        <button 
          onClick={() => {
            fetchSystemStatus();
            setJobs(prev => prev.map(j => ({ ...j, cpu: Math.random() * 2 })));
            setTerminalLogs(prev => [...prev.slice(0, -1), "[SISTEMA] Sistema refrescado por hardware.", "===>"]);
          }}
          className="flex items-center gap-1 text-[#8e8e93] hover:text-[#fbbf24] transition-colors"
        >
          <span className="text-white font-bold">F5=</span>Refrescar Sistema
        </button>
        <button 
          onClick={() => {
            if (commandHistory.length > 0) {
              setTerminalInput(commandHistory[0]);
            }
          }}
          className="flex items-center gap-1 text-[#8e8e93] hover:text-[#fbbf24] transition-colors"
        >
          <span className="text-white font-bold">F9=</span>Recuperar Mandato
        </button>
        <button 
          onClick={() => {
            setTerminalInput("");
          }}
          className="flex items-center gap-1 text-[#8e8e93] hover:text-[#fbbf24] transition-colors"
        >
          <span className="text-white font-bold">F12=</span>Cancelar Entrada
        </button>
        <button 
          onClick={() => {
            setActiveTab(5);
          }}
          className="flex items-center gap-1 text-[#8e8e93] hover:text-[#fbbf24] transition-colors"
        >
          <span className="text-white font-bold">F23=</span>Conexión Legacy Bridge
        </button>
        <div className="ml-auto text-[#4ade80] flex items-center gap-2 font-bold text-[10px]">
          <div className="w-1.5 h-1.5 rounded-full bg-[#4ade80] animate-pulse"></div>
          EMULACIÓN ACTIVA EN RED LOCAL
        </div>
      </footer>
    </div>
  );
}
