import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json());

// Helper for lazy loading Gemini API
let aiInstance: GoogleGenAI | null = null;
function getAIClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === "MY_GEMINI_API_KEY") {
    // If key is not set, we will use mock/offline simulation
    return null;
  }
  if (!aiInstance) {
    aiInstance = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiInstance;
}

// Check system status
app.get("/api/as400/status", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  res.json({
    status: "ONLINE",
    operatingSystem: "OS/400 V5R4M0",
    systemName: "PUB400",
    compilerMode: hasKey ? "GEMINI_COGNITIVE" : "OFFLINE_DETERMINISTIC",
    localTime: new Date().toISOString()
  });
});

// Mock Compiler for local offline fallback
function offlineCompile(code: string, type: "COBOL" | "RPG") {
  const lines = code.split("\n");
  const errors: string[] = [];
  const variables: Record<string, { type: string; value: any; picture?: string }> = {};
  const files: string[] = [];

  if (type === "COBOL") {
    // Check basic COBOL structures
    let hasIdentification = false;
    let hasEnvironment = false;
    let hasData = false;
    let hasProcedure = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toUpperCase();
      if (line.includes("IDENTIFICATION DIVISION")) hasIdentification = true;
      if (line.includes("ENVIRONMENT DIVISION")) hasEnvironment = true;
      if (line.includes("DATA DIVISION")) hasData = true;
      if (line.includes("PROCEDURE DIVISION")) hasProcedure = true;

      // Match variables e.g., 01 MY-VAR PIC X(20) VALUE "HELLO"
      const matchVar = lines[i].match(/(?:01|05|10|77)\s+([A-Za-z0-9\-]+)\s+PIC\s+([A-Z0-9\(\)]+)(?:\s+VALUE\s+["']?([^"']*)["']?)?/i);
      if (matchVar) {
        const varName = matchVar[1].toUpperCase();
        const pic = matchVar[2].toUpperCase();
        let val: any = matchVar[3] || "";
        if (pic.includes("9") && !isNaN(Number(val))) {
          val = Number(val);
        }
        variables[varName] = {
          type: pic.includes("9") ? "DECIMAL" : "CHAR",
          value: val,
          picture: pic
        };
      }

      // Match select files
      const fileMatch = lines[i].match(/SELECT\s+([A-Za-z0-9\-]+)\s+ASSIGN\s+TO/i);
      if (fileMatch) {
        files.push(fileMatch[1].toUpperCase());
      }
    }

    if (!hasIdentification) errors.push("Línea 0010: Falta la división IDENTIFICATION DIVISION.");
    if (!hasProcedure) errors.push("Línea 0050: Falta la división PROCEDURE DIVISION.");

  } else {
    // RPG III / IV Basic parser
    let isFreeForm = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].toUpperCase();
      if (line.includes("**FREE")) {
        isFreeForm = true;
        continue;
      }

      // Look for Dcl-S or specs
      if (isFreeForm) {
        const dclMatch = lines[i].match(/DCL-S\s+([A-Za-z0-9_]+)\s+([A-Za-z0-9_]+)(?:\s+INZ\((.*?)\))?/i);
        if (dclMatch) {
          const varName = dclMatch[1].toUpperCase();
          const vType = dclMatch[2].toUpperCase();
          let inz = dclMatch[3] || "";
          inz = inz.replace(/['"]/g, "");
          variables[varName] = {
            type: vType.includes("INT") || vType.includes("PACKED") || vType.includes("ZONED") ? "DECIMAL" : "CHAR",
            value: isNaN(Number(inz)) || inz === "" ? inz : Number(inz),
            picture: vType
          };
        }
        const fileMatch = lines[i].match(/DCL-F\s+([A-Za-z0-9_]+)/i);
        if (fileMatch) {
          files.push(fileMatch[1].toUpperCase());
        }
      } else {
        // Positional specs (RPG III/IV)
        // F Spec: Columns 6 = 'F'
        if (line[5] === 'F') {
          const fileName = line.substring(6, 16).trim();
          if (fileName) files.push(fileName);
        }
        // D Spec: Columns 6 = 'D'
        if (line[5] === 'D') {
          const varName = line.substring(6, 21).trim();
          if (varName && !varName.startsWith("*")) {
            variables[varName] = {
              type: "CHAR",
              value: "",
              picture: "D Spec"
            };
          }
        }
      }
    }
  }

  return {
    status: errors.length === 0 ? "SUCCESS" : "ERROR",
    errors,
    summary: `Programa emulado exitosamente offline (${type}). Variables detectadas: ${Object.keys(variables).join(", ") || 'Ninguna'}.`,
    variables,
    filesReferenced: files
  };
}

// Local Executor Fallback
function offlineExecute(code: string, type: "COBOL" | "RPG", variables: any, dbFiles: any) {
  const outputs: string[] = [];
  const dbUpdates: any[] = [];
  const currentVars = JSON.parse(JSON.stringify(variables));

  outputs.push(`--- INICIO DE EJECUCIÓN (${type}) ---`);

  const lines = code.split("\n");
  if (type === "COBOL") {
    // Basic COBOL simulation: read lines and emulate basic math/display/inserts
    let displayCount = 0;
    for (const line of lines) {
      const uLine = line.toUpperCase().trim();
      
      // Match DISPLAY "..." or DISPLAY VAR
      const dispMatch = uLine.match(/DISPLAY\s+["']([^"']*)["'](?:\s+([A-Za-z0-9\-]+))?/i) || uLine.match(/DISPLAY\s+([A-Za-z0-9\-]+)/i);
      if (dispMatch) {
        if (dispMatch[1] && !currentVars[dispMatch[1]]) {
          // Displaying literal
          outputs.push(dispMatch[1]);
        } else {
          // Displaying variable
          const varName = dispMatch[1] ? dispMatch[1].toUpperCase() : dispMatch[0].replace("DISPLAY", "").trim().toUpperCase();
          if (currentVars[varName]) {
            outputs.push(`${varName}: ${currentVars[varName].value}`);
          } else {
            outputs.push(varName);
          }
        }
        displayCount++;
      }

      // Emulate basic ADD or MOVE
      // MOVE "ALBERTO" TO USERNAME.
      const moveMatch = uLine.match(/MOVE\s+["']?([^"']*)["']?\s+TO\s+([A-Za-z0-9\-]+)/i);
      if (moveMatch) {
        const val = moveMatch[1].replace(/['"]/g, "");
        const dest = moveMatch[2].toUpperCase();
        if (currentVars[dest]) {
          currentVars[dest].value = isNaN(Number(val)) ? val : Number(val);
          outputs.push(`[SYSTEM] MOVE '${val}' TO variable ${dest}`);
        }
      }

      // Emulate simple DB operations
      // WRITE REGISTRO-CLIENTE
      if (uLine.includes("WRITE") || uLine.includes("INSERT")) {
        const wordMatch = uLine.match(/(?:WRITE|INSERT)\s+([A-Za-z0-9\-]+)/i);
        const tableName = wordMatch ? wordMatch[1].toUpperCase() : "QUSERPF";
        dbUpdates.push({
          type: "INSERT",
          file: tableName,
          data: {
            ID: Math.floor(Math.random() * 900) + 100,
            NAME: currentVars["NOMBRE"]?.value || currentVars["NAME"]?.value || "EMULATED_USER",
            DATETIME: new Date().toISOString().replace('T', ' ').substring(0, 19)
          }
        });
        outputs.push(`[DATABASE] Registro escrito en archivo físico ${tableName}`);
      }
    }

    if (displayCount === 0) {
      outputs.push("El programa se ejecutó sin salidas interactivas (DISPLAY).");
    }
  } else {
    // RPG simulation
    let dsplayCount = 0;
    for (const line of lines) {
      const uLine = line.toUpperCase().trim();
      // DSPLY "HELLO" or DSPLY VAR
      const dspMatch = uLine.match(/DSPLY\s+["']([^"']*)["']/i) || uLine.match(/DSPLY\s+([A-Za-z0-9_]+)/i);
      if (dspMatch) {
        const content = dspMatch[1] || dspMatch[0].replace("DSPLY", "").trim();
        const varName = content.toUpperCase();
        if (currentVars[varName]) {
          outputs.push(`${varName}: ${currentVars[varName].value}`);
        } else {
          outputs.push(content.replace(/['"]/g, ""));
        }
        dsplayCount++;
      }

      // EVAL VAR = VAL
      const evalMatch = uLine.match(/EVAL\s+([A-Za-z0-9_]+)\s*=\s*["']?([^"']*)["']?/i);
      if (evalMatch) {
        const dest = evalMatch[1].toUpperCase();
        const val = evalMatch[2].replace(/['"]/g, "").trim();
        if (currentVars[dest]) {
          currentVars[dest].value = isNaN(Number(val)) ? val : Number(val);
          outputs.push(`[SYSTEM] EVAL ${dest} = '${val}'`);
        }
      }

      // WRITE file
      if (uLine.includes("WRITE")) {
        const writeMatch = uLine.match(/WRITE\s+([A-Za-z0-9_]+)/i);
        const fileName = writeMatch ? writeMatch[1].toUpperCase() : "QRPGPF";
        dbUpdates.push({
          type: "INSERT",
          file: fileName,
          data: {
            ID: Math.floor(Math.random() * 900) + 100,
            VALUE: currentVars["VALOR"]?.value || currentVars["AMOUNT"]?.value || 150.00,
            DATETIME: new Date().toISOString().replace('T', ' ').substring(0, 19)
          }
        });
        outputs.push(`[DATABASE] Registro insertado en DB2 archivo físico: ${fileName}`);
      }
    }

    if (dsplayCount === 0) {
      outputs.push("El programa RPG se ejecutó sin emitir comandos DSPLY.");
    }
  }

  outputs.push(`--- FIN DE EJECUCIÓN CON ÉXITO ---`);

  return {
    success: true,
    outputs,
    updatedVariables: currentVars,
    dbUpdates,
    explanation: `Simulación offline de ejecución completada. Se ejecutó la lógica paso a paso localmente. Para análisis de sintaxis y ejecución cognitiva dinámica completa, configure la clave 'GEMINI_API_KEY' en los Secretos de AI Studio.`
  };
}

// 1. COMPILE ENDPOINT (uses Gemini if available, otherwise mock)
app.post("/api/as400/compile", async (req, res) => {
  const { code, type, name } = req.body;
  if (!code || !type) {
    return res.status(400).json({ error: "Faltan parámetros 'code' o 'type'." });
  }

  const ai = getAIClient();
  if (!ai) {
    // Local deterministic compilation fallback
    const result = offlineCompile(code, type);
    return res.json(result);
  }

  try {
    const prompt = `Actúa como un compilador de iSeries AS/400 de IBM para lenguajes ${type} (COBOL-400 / RPG III o RPG IV / ILE RPG).
Analiza el siguiente código fuente e indica si tiene errores de sintaxis o estructura típicos de este entorno legacy.
Luego, extrae la lista de archivos de base de datos (Physical Files) referenciados y las variables de memoria clave con sus valores iniciales.

Código Fuente a compilar (Miembro: ${name || "MAIN"}):
\`\`\`
${code}
\`\`\`

Devuelve tu respuesta en un formato JSON estructurado válido que contenga exactamente estos campos:
{
  "status": "SUCCESS" o "ERROR",
  "errors": ["Línea X: Descripción del error de compilación", ...],
  "summary": "Resumen técnico de la estructura del código y división de secciones.",
  "variables": {
    "NOMBRE_VAR": {
      "type": "CHAR" o "DECIMAL" o "POINTER",
      "value": "valor inicial o vacío",
      "picture": "ejemplo: PIC X(30) o S9(5)V99 o packed"
    }
  },
  "filesReferenced": ["NOMBRE_ARCHIVO_FISICO", ...]
}
Asegúrate de responder UNICAMENTE con el objeto JSON válido. No incluyas explicaciones adicionales fuera del JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini compiler error:", error);
    // Fallback on failure
    const result = offlineCompile(code, type);
    res.json({
      ...result,
      warning: "Error en el compilador cognitivo Gemini, se utilizó el compilador local de respaldo."
    });
  }
});

// 2. EXECUTE ENDPOINT (interprets the code execution, can interact with DB)
app.post("/api/as400/execute", async (req, res) => {
  const { code, type, variables, dbFiles, memberName } = req.body;
  if (!code || !type) {
    return res.status(400).json({ error: "Faltan parámetros 'code' o 'type' para la ejecución." });
  }

  const ai = getAIClient();
  if (!ai) {
    const result = offlineExecute(code, type, variables || {}, dbFiles || {});
    return res.json(result);
  }

  try {
    const prompt = `Actúa como la máquina virtual de iSeries AS/400 (sistema de ejecución interactivo de trabajos / Batch Job Queue QBATCH).
Debes interpretar y simular la ejecución del siguiente programa ${type} con los archivos físicos DB2 locales simulados.

Código Fuente:
\`\`\`
${code}
\`\`\`

Estado de las Variables actuales del Job:
${JSON.stringify(variables || {}, null, 2)}

Estado actual de los archivos físicos locales de base de datos DB2 simulados (Tablas y registros):
${JSON.stringify(dbFiles || {}, null, 2)}

Simula la ejecución completa paso a paso de este código.
Si el código contiene comandos de visualización interactiva (DISPLAY en COBOL o DSPLY en RPG), genera las líneas correspondientes.
Si el código realiza inserciones, actualizaciones o lecturas de archivos físicos (WRITE, READE, UPDATE, etc.), genera los cambios correspondientes que deben aplicarse a la base de datos simulada.

Devuelve tu respuesta en este formato JSON exacto:
{
  "success": true,
  "outputs": ["Línea de consola 1", "Línea de consola 2", ...],
  "updatedVariables": {
    "VAR_NAME": { "type": "...", "value": "nuevo_valor", "picture": "..." }
  },
  "dbUpdates": [
    {
      "type": "INSERT" o "UPDATE" o "DELETE",
      "file": "NOMBRE_ARCHIVO_FISICO",
      "data": { "columna1": "valor1", "columna2": "valor2" }
    }
  ],
  "explanation": "Explicación didáctica y detallada paso a paso de lo que hizo el código, útil para entrenamiento."
}
Asegúrate de responder UNICAMENTE con el objeto JSON válido.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (error: any) {
    console.error("Gemini executor error:", error);
    const result = offlineExecute(code, type, variables || {}, dbFiles || {});
    res.json({
      ...result,
      warning: "Error en el motor cognitivo de ejecución Gemini, se utilizó el motor local."
    });
  }
});

// 3. EXPLAIN / CODE ASSIST TUTOR
app.post("/api/as400/tutor", async (req, res) => {
  const { question, code, type } = req.body;
  
  const ai = getAIClient();
  if (!ai) {
    return res.json({
      answer: "Hola. Estoy corriendo en modo sin conexión (GEMINI_API_KEY no detectada).\n\nPara hacerme consultas de programación AS/400, explicaciones de sintaxis complejas o que te ayude a crear macros y lógica RPG/COBOL avanzada usando IA, por favor añade tu clave de API en el panel de Secrets de AI Studio.\n\nMientras tanto, puedes usar todas las funciones del emulador 5250, el editor SEU, compilar y ejecutar tus códigos con el motor determinista local."
    });
  }

  try {
    const prompt = `Eres un Ingeniero iSeries AS/400 experto de IBM y un Tutor de sistemas legacy.
El usuario tiene una consulta sobre el desarrollo en RPG / COBOL o sobre comandos CL (Control Language) de AS/400.

Código de referencia (Opcional):
${code ? `\`\`\`${type}\n${code}\n\`\`\`` : "Ninguno proporcionado"}

Pregunta del usuario:
"${question}"

Proporciona una respuesta detallada, didáctica, profesional y clara en Español. Explica conceptos legacy (como especificaciones posicionales en RPG, hojas de cálculo, división de datos en COBOL, DDS de archivos físicos o comandos CL como WRKACTJOB, WRKMBRPDM, etc.) de manera que un desarrollador moderno pueda entenderlo fácilmente.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ answer: response.text });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


// Vite configuration & Middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AS/400 Emulator Server started on http://localhost:${PORT}`);
  });
}

startServer();
