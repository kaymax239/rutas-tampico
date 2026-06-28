// Registra una impresión de anuncio en Firestore, deduplicada por
// usuario + anuncio + día (1 por día). Sin datos personales ni login.

import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/app/firebase";

// Fecha local en formato YYYY-MM-DD (hora local del usuario, no UTC), para que
// el "día" coincida con la zona horaria de quien ve el anuncio.
function fechaLocalYMD(): string {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

// Registra UNA impresión por usuario por día por anuncio. Idempotente: el ID de
// documento es determinístico, así que repetir la escritura no crea duplicados.
// La identidad del usuario se recibe por parámetro (la misma que usan los clics),
// para compartir ID y mantener esta utilidad pura y segura en SSR.
export async function registrarImpresion(
  anuncioId: string,
  userId: string
): Promise<void> {
  // En SSR/build no hay navegador: no hace nada.
  if (typeof window === "undefined") return;

  // Sin ID de usuario no se puede deduplicar; se omite.
  if (!userId) return;

  const fecha = fechaLocalYMD();
  // ID determinístico: mismo usuario+anuncio+día => mismo documento.
  const idDoc = `${anuncioId}_${userId}_${fecha}`;

  try {
    await setDoc(
      doc(db, "impresiones", idDoc),
      {
        anuncioId,
        userId,
        fecha,
        timestamp: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error) {
    // No lanza: una impresión fallida no debe romper la UI.
    console.error("[impresion] error:", error);
  }
}

export default registrarImpresion;
