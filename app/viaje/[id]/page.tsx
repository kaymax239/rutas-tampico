import ViajeEnVivo from "../ViajeEnVivo";

type ViajePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return [];
}

export default async function ViajePage({ params }: ViajePageProps) {
  const { id } = await params;

  return <ViajeEnVivo id={id} />;
}