import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  decimal,
  jsonb,
  pgEnum,
  date,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ── Enums ──────────────────────────────────────────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["pharmacist", "clerk", "admin"]);
export const prescriptionStatusEnum = pgEnum("prescription_status", [
  "pending", "reviewing", "approved", "dispensed", "rejected",
]);
export const genderEnum = pgEnum("gender", ["male", "female"]);
export const ocrPipelineEnum = pgEnum("ocr_pipeline", [
  "document-ai+gemini", "claude-vision-fallback",
]);

// ── Stores ─────────────────────────────────────────────────────────────────
export const stores = pgTable("stores", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  address: text("address"),
  phone: varchar("phone", { length: 20 }),
  licenseNumber: varchar("license_number", { length: 50 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Users ──────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").references(() => stores.id).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  role: userRoleEnum("role").notNull().default("clerk"),
  totpSecret: text("totp_secret"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ── Patients ───────────────────────────────────────────────────────────────
export const patients = pgTable("patients", {
  id: uuid("id").primaryKey().defaultRandom(),
  storeId: uuid("store_id").references(() => stores.id).notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  nameKana: varchar("name_kana", { length: 100 }),
  birthDate: date("birth_date"),
  gender: genderEnum("gender"),
  insurerNumber: varchar("insurer_number", { length: 20 }),
  insuredNumber: varchar("insured_number", { length: 20 }),
  insuranceSymbol: varchar("insurance_symbol", { length: 20 }),
  copayRatio: integer("copay_ratio"),
  allergies: text("allergies").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_patients_store_id").on(t.storeId),
]);

// ── Medicines ──────────────────────────────────────────────────────────────
export const medicines = pgTable("medicines", {
  id: uuid("id").primaryKey().defaultRandom(),
  yjCode: varchar("yj_code", { length: 12 }).unique(),
  standardCode: varchar("standard_code", { length: 20 }),
  name: varchar("name", { length: 255 }).notNull(),
  genericName: varchar("generic_name", { length: 255 }),
  manufacturer: varchar("manufacturer", { length: 255 }),
  drugPrice: decimal("drug_price", { precision: 10, scale: 2 }),
  isGeneric: boolean("is_generic").notNull().default(false),
  originalMedicineId: uuid("original_medicine_id"),
  unit: varchar("unit", { length: 20 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Prescriptions ──────────────────────────────────────────────────────────
export const prescriptions = pgTable("prescriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  rxNumber: varchar("rx_number", { length: 30 }).notNull().unique(),
  storeId: uuid("store_id").references(() => stores.id).notNull(),
  patientId: uuid("patient_id").references(() => patients.id),
  scannedById: uuid("scanned_by_id").references(() => users.id).notNull(),
  approvedById: uuid("approved_by_id").references(() => users.id),
  status: prescriptionStatusEnum("status").notNull().default("pending"),
  // 医療機関
  institutionName: varchar("institution_name", { length: 255 }),
  institutionCode: varchar("institution_code", { length: 20 }),
  institutionAddress: text("institution_address"),
  institutionPhone: varchar("institution_phone", { length: 20 }),
  // 処方医
  doctorName: varchar("doctor_name", { length: 100 }),
  doctorDepartment: varchar("doctor_department", { length: 100 }),
  // 処方箋情報
  prescribedDate: date("prescribed_date"),
  expiryDate: date("expiry_date"),
  isGenericSubstitutable: boolean("is_generic_substitutable").default(true),
  dispensingNotes: text("dispensing_notes"),
  refillCount: integer("refill_count").default(0),
  ocrConfidenceAvg: decimal("ocr_confidence_avg", { precision: 5, scale: 2 }),
  ocrPipeline: ocrPipelineEnum("ocr_pipeline"),
  rejectionReason: text("rejection_reason"),
  approvedAt: timestamp("approved_at"),
  dispensedAt: timestamp("dispensed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => [
  index("idx_prescriptions_store_id").on(t.storeId),
  index("idx_prescriptions_patient_id").on(t.patientId),
  index("idx_prescriptions_status").on(t.status),
  index("idx_prescriptions_prescribed_date").on(t.prescribedDate),
]);

// ── Prescription Items ─────────────────────────────────────────────────────
export const prescriptionItems = pgTable("prescription_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  prescriptionId: uuid("prescription_id").references(() => prescriptions.id, { onDelete: "cascade" }).notNull(),
  medicineId: uuid("medicine_id").references(() => medicines.id),
  rawMedicineName: varchar("raw_medicine_name", { length: 255 }).notNull(),
  rpNumber: integer("rp_number").notNull(),
  isGenericName: boolean("is_generic_name").notNull().default(false),
  dosage: varchar("dosage", { length: 100 }),
  administration: varchar("administration", { length: 255 }),
  durationDays: integer("duration_days"),
  totalQuantity: varchar("total_quantity", { length: 50 }),
  isPrn: boolean("is_prn").notNull().default(false),
  notes: text("notes"),
  confidenceScore: decimal("confidence_score", { precision: 5, scale: 2 }),
  sortOrder: integer("sort_order").notNull().default(0),
});

// ── Prescription Images ────────────────────────────────────────────────────
export const prescriptionImages = pgTable("prescription_images", {
  id: uuid("id").primaryKey().defaultRandom(),
  prescriptionId: uuid("prescription_id").references(() => prescriptions.id, { onDelete: "cascade" }).notNull(),
  s3Key: text("s3_key").notNull(),
  s3Bucket: varchar("s3_bucket", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 50 }).notNull(),
  pageNumber: integer("page_number").notNull().default(1),
  fileSizeBytes: integer("file_size_bytes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── OCR Results ────────────────────────────────────────────────────────────
export const ocrResults = pgTable("ocr_results", {
  id: uuid("id").primaryKey().defaultRandom(),
  prescriptionId: uuid("prescription_id").references(() => prescriptions.id, { onDelete: "cascade" }).notNull(),
  rawResponse: jsonb("raw_response"),
  parsedData: jsonb("parsed_data"),
  confidenceScores: jsonb("confidence_scores"),
  pipeline: ocrPipelineEnum("pipeline").notNull(),
  processingTimeMs: integer("processing_time_ms"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ── Audit Logs ─────────────────────────────────────────────────────────────
export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id).notNull(),
  storeId: uuid("store_id").references(() => stores.id).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  resourceType: varchar("resource_type", { length: 50 }).notNull(),
  resourceId: uuid("resource_id"),
  details: jsonb("details"),
  ipAddress: varchar("ip_address", { length: 45 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  index("idx_audit_logs_user_id").on(t.userId),
  index("idx_audit_logs_resource").on(t.resourceType, t.resourceId),
  index("idx_audit_logs_created_at").on(t.createdAt),
]);

// ── Relations ──────────────────────────────────────────────────────────────
export const storesRelations = relations(stores, ({ many }) => ({
  users: many(users),
  patients: many(patients),
  prescriptions: many(prescriptions),
  auditLogs: many(auditLogs),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  store: one(stores, { fields: [users.storeId], references: [stores.id] }),
  scannedPrescriptions: many(prescriptions, { relationName: "scannedBy" }),
  approvedPrescriptions: many(prescriptions, { relationName: "approvedBy" }),
  auditLogs: many(auditLogs),
}));

export const patientsRelations = relations(patients, ({ one, many }) => ({
  store: one(stores, { fields: [patients.storeId], references: [stores.id] }),
  prescriptions: many(prescriptions),
}));

export const prescriptionsRelations = relations(prescriptions, ({ one, many }) => ({
  store: one(stores, { fields: [prescriptions.storeId], references: [stores.id] }),
  patient: one(patients, { fields: [prescriptions.patientId], references: [patients.id] }),
  scannedBy: one(users, { fields: [prescriptions.scannedById], references: [users.id], relationName: "scannedBy" }),
  approvedBy: one(users, { fields: [prescriptions.approvedById], references: [users.id], relationName: "approvedBy" }),
  items: many(prescriptionItems),
  images: many(prescriptionImages),
  ocrResults: many(ocrResults),
}));

export const prescriptionImagesRelations = relations(prescriptionImages, ({ one }) => ({
  prescription: one(prescriptions, { fields: [prescriptionImages.prescriptionId], references: [prescriptions.id] }),
}));

export const ocrResultsRelations = relations(ocrResults, ({ one }) => ({
  prescription: one(prescriptions, { fields: [ocrResults.prescriptionId], references: [prescriptions.id] }),
}));

export const medicinesRelations = relations(medicines, ({ many }) => ({
  prescriptionItems: many(prescriptionItems),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  store: one(stores, { fields: [auditLogs.storeId], references: [stores.id] }),
  user: one(users, { fields: [auditLogs.userId], references: [users.id] }),
}));

export const prescriptionItemsRelations = relations(prescriptionItems, ({ one }) => ({
  prescription: one(prescriptions, { fields: [prescriptionItems.prescriptionId], references: [prescriptions.id] }),
  medicine: one(medicines, { fields: [prescriptionItems.medicineId], references: [medicines.id] }),
}));
