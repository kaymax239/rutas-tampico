import { Suspense } from "react";
import ViajeDesdeQuery from "./ViajeDesdeQuery";

export default function ViajePage() {
  return (
    <Suspense fallback={<div>Cargando viaje...</div>}>
      <ViajeDesdeQuery />
    </Suspense>
  );
}
