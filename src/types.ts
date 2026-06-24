export type ProgramType = "RPG" | "COBOL" | "CL" | "DDS";

export interface SourceMember {
  name: string;
  type: ProgramType;
  srcFile: "QRPGSRC" | "QCBLSRC" | "QCLSRC" | "QDDSSRC";
  code: string;
  compiled: boolean;
  variables?: Record<string, { type: string; value: any; picture?: string }>;
  filesReferenced?: string[];
  lastCompiledDate?: string;
}

export interface DBFile {
  name: string;
  schema: string[]; // e.g., ["ID", "NOMBRE", "DATETIME"]
  records: Record<string, any>[];
}

export interface ActiveJob {
  id: string;
  name: string;
  type: "BATCH" | "INTERACTIVE";
  user: string;
  status: "RUN" | "MSGW" | "OUTQ" | "CND";
  cpu: number;
  function: string;
}

export interface SystemMessage {
  id: string;
  timestamp: string;
  type: "INFO" | "WARNING" | "ERROR";
  sender: string;
  text: string;
}

export interface TutorialMission {
  id: string;
  title: string;
  difficulty: "Básico" | "Intermedio" | "Avanzado";
  description: string;
  language: "RPG" | "COBOL" | "CL";
  objectives: string[];
  templateCode: string;
  srcFile: "QRPGSRC" | "QCBLSRC" | "QCLSRC";
  memberName: string;
  hints: string[];
}
