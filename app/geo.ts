// GPS: usa el plugin nativo de Capacitor en iOS/Android y navigator.geolocation en web.
import { Capacitor } from "@capacitor/core";
import { Geolocation } from "@capacitor/geolocation";

export type Coords = { coords: { latitude: number; longitude: number; accuracy?: number } };
export type GeoError = { code: number; message: string }; // code 1 = permiso denegado

const nativo = () => Capacitor.isNativePlatform();
const opts = (timeout: number) => ({ enableHighAccuracy: true, timeout, maximumAge: 0 });

function aGeoError(e: unknown): GeoError {
  const msg = e instanceof Error ? e.message : String(e);
  return { code: /denied|permission|permiso/i.test(msg) ? 1 : 2, message: msg };
}

async function asegurarPermiso() {
  const st = await Geolocation.checkPermissions();
  if (st.location === "granted" || st.coarseLocation === "granted") return;
  const r = await Geolocation.requestPermissions();
  if (r.location !== "granted" && r.coarseLocation !== "granted") throw new Error("permission denied");
}

export function gpsDisponible() {
  return nativo() || (typeof navigator !== "undefined" && !!navigator.geolocation);
}

export async function obtenerPosicion(timeout = 10000): Promise<Coords> {
  if (nativo()) {
    try { await asegurarPermiso(); return await Geolocation.getCurrentPosition(opts(timeout)); }
    catch (e) { throw aGeoError(e); }
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject({ code: 2, message: "Geolocalizacion no disponible" }); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, opts(timeout));
  });
}

/** Inicia seguimiento; devuelve función para detenerlo. */
export function seguirPosicion(onPos: (p: Coords) => void, onErr: (e: GeoError) => void, timeout = 15000): () => void {
  if (nativo()) {
    let id: string | null = null; let cancelado = false;
    (async () => {
      try {
        await asegurarPermiso();
        id = await Geolocation.watchPosition(opts(timeout), (pos, err) => {
          if (err) onErr(aGeoError(err)); else if (pos) onPos(pos);
        });
        if (cancelado && id) void Geolocation.clearWatch({ id });
      } catch (e) { onErr(aGeoError(e)); }
    })();
    return () => { cancelado = true; if (id) void Geolocation.clearWatch({ id }); };
  }
  const wid = navigator.geolocation.watchPosition(onPos, (e) => onErr({ code: e.code, message: e.message }), opts(timeout));
  return () => navigator.geolocation.clearWatch(wid);
}
