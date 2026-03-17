export interface TextBlock {
  page: number;   // 1-indexed
  x: number;      // normalized 0-1 (left)
  y: number;      // normalized 0-1 (top)
  w: number;      // normalized width
  h: number;      // normalized height
}

export interface PrescriptionOcrResult {
  meta: {
    pipeline: "document-ai+gemini" | "azure-read+gemini-vision-parallel" | "claude-vision-fallback";
    processingTimeMs: number;
    overallConfidence: number;
    textBlocks: TextBlock[];
  };
  institution: {
    name: string | null;
    code: string | null;
    address: string | null;
    phone: string | null;
    confidence: number;
  };
  doctor: {
    name: string | null;
    department: string | null;
    confidence: number;
  };
  patient: {
    name: string | null;
    nameKana: string | null;
    birthDate: string | null;
    gender: "male" | "female" | null;
    insurerNumber: string | null;
    insuredNumber: string | null;
    insuranceSymbol: string | null;
    copayRatio: number | null;
    confidence: number;
  };
  prescription: {
    date: string | null;
    expiryDate: string | null;
    isGenericSubstitutable: boolean;
    dispensingNotes: string | null;
    refillCount: number | null;
  };
  items: PrescriptionItem[];
}

export interface PrescriptionItem {
  rpNumber: number;
  medicineName: string;
  isGenericName: boolean;
  dosage: string;
  administration: string;
  durationDays: number | null;
  totalQuantity: string | null;
  isPrn: boolean;
  notes: string | null;
  confidence: number;
}
