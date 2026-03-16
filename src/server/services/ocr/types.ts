export interface PrescriptionOcrResult {
  meta: {
    pipeline: "document-ai+gemini" | "claude-vision-fallback";
    processingTimeMs: number;
    overallConfidence: number;
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
