"use client";

import { useSearchParams } from "next/navigation";
import ViajeEnVivo from "./ViajeEnVivo";

export default function ViajeDesdeQuery() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  return <ViajeEnVivo id={id} />;
}
