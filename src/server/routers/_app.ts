import { router } from "@/server/trpc";
import { prescriptionRouter } from "./prescription";
import { patientRouter } from "./patient";
import { medicineRouter } from "./medicine";
import { storeRouter } from "./store";

export const appRouter = router({
  prescription: prescriptionRouter,
  patient: patientRouter,
  medicine: medicineRouter,
  store: storeRouter,
});

export type AppRouter = typeof appRouter;
