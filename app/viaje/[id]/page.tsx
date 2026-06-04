import ViajeClient from "./ViajeClient";

export const dynamicParams = false;

export function generateStaticParams() {
  return [];
}

export default function ViajePage() {
  return <ViajeClient />;
}