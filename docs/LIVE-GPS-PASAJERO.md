# Cambio: el pasajero también pinta el camión

Antes, el botón GPS solo escribía a Firestore `autobuses` si el modo era **chofer**.

Ahora, si hay ruta seleccionada y el usuario activa GPS, **chofer o pasajero** escribe:

- `nombre`: `Chofer · {ruta}` o `Pasajero · {ruta}`
- `ruta`, `rol`, `lat`, `lng`, `fecha`

Sigue el mismo throttle: cada 12 s o 35 m.
Los puntos caducan a 45 s (ya estaba en el mapa).

Código en `app/Mapa.tsx` → `obtenerMiUbicacion`.
