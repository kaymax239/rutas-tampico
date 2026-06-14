import ViajeClient from "./ViajeClient";

export const dynamicParams = false;

export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return [{ id: "__placeholder__" }];
}

export default function ViajePage() {
  return <ViajeClient />;
}