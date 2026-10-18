# Reporte de ajuste a calles (OSRM)

Criterio: `revisar-desvio` si km trazo > 2.5× km línea recta; `revisar-snap-lejano` si algún waypoint quedó a >300 m de una calle.

| Ruta | km recto | km trazo | ratio | snap máx (m) | estado |
|---|---|---|---|---|---|
| Candelario Garza | 4.42 | 6.51 | 1.48 | 29 | ok |
| Serapio Venegas | 4.41 | 8.01 | 1.82 | 24 | ok |
| Haciendas | 3.14 | 5.03 | 1.60 | 19 | ok |
| Niños Héroes | 3.49 | 5.37 | 1.54 | 25 | ok |
| Circuito Norte | 5.11 | 10.46 | 2.05 | 239 | ok |
| Tampico - Madero | 5.95 | 11.53 | 1.94 | 156 | ok |
| Borreguera | 4.46 | 7.38 | 1.66 | 404 | revisar-snap-lejano |
| Tancol | 5.74 | 9.21 | 1.60 | 24 | ok |
| Playa Norte | 8.62 | 23.28 | 2.70 | 1025 | revisar-desvio |
| Águila - Madero | 5.00 | 10.00 | 2.00 | 130 | ok |
| Madero - Borreguera | 8.00 | 15.62 | 1.95 | 27 | ok |
| Tampico - Fovissste - Playa | 8.73 | 22.36 | 2.56 | 957 | revisar-desvio |
| Germinal - Boulevard | 5.15 | 7.53 | 1.46 | 28 | ok |
| Bosque - Boulevard | 5.85 | 7.87 | 1.35 | 16 | ok |
| Tampico - Valle | 5.10 | 7.12 | 1.40 | 50 | ok |
| Tampico - Niños Héroes - Isleta | 7.22 | 11.06 | 1.53 | 37 | ok |
| Madero - Ganadera - Niños Héroes | 6.95 | 15.18 | 2.18 | 28 | ok |
| Ruta 1 - Mirador / Aviación / Boulevard | 1.54 | 2.25 | 1.46 | 28 | ok |
| Ruta 7 - Tampico ↔ Playa Norte por Boulevard | 3.09 | 4.51 | 1.46 | 21 | ok |
| Ruta 8 - Seguro Social ↔ Lomas de Infonavit | 1.76 | 3.19 | 1.81 | 64 | ok |
| Ruta 16 - Ej. Contadero / Germinal / Águila | 2.84 | 4.42 | 1.55 | 17 | ok |
| Ruta 24 - Tampico Tancol / Col. del Bosque | 3.79 | 5.43 | 1.43 | 32 | ok |
| Ruta 35 - Madero Ganadera / Niños Héroes | 3.15 | 5.68 | 1.81 | 13 | ok |
| Ruta 38 - Circuito Norte | 1.99 | 2.52 | 1.27 | 28 | ok |
| Ruta 39 - Playa Sur / Refinería Tampico | 3.59 | 5.63 | 1.57 | 23 | ok |
| Altamira - Tampico | 16.20 | 26.61 | 1.64 | 119 | ok |
| Altamira - Nuevo Tampico | 10.36 | 19.52 | 1.88 | 63 | ok |
| Altamira - Borreguera | 13.61 | 24.48 | 1.80 | 119 | ok |
| Altamira - Centro | 4.32 | 10.99 | 2.54 | 56 | revisar-desvio |
| Altamira - Guadalupe Victoria | 5.69 | 18.54 | 3.26 | 109 | revisar-desvio |
| Ruta 40 - Altamira Centro / Arboledas / Monte Alto | 3.07 | 4.41 | 1.44 | 17 | ok |
| Ruta 41 - Altamira Centro / Laguna Florida | 2.59 | 3.63 | 1.40 | 17 | ok |
| Ruta 42 - Altamira Centro / Miramar / Pedrera | 3.33 | 6.43 | 1.93 | 600 | revisar-snap-lejano |
| Ruta 43 - Monte Alto / Pedrera / Tampico | 7.35 | 15.34 | 2.09 | 66 | ok |
| Ruta 44 - Altamira Centro / Santa Elena / Tampico | 8.03 | 13.58 | 1.69 | 240 | ok |
| Ruta 45 - Altamira Centro / Unidos Avanzamos | 3.48 | 5.07 | 1.46 | 250 | ok |
| Ruta 46 - Altamira Centro / Los Prados / Monte Alto | 3.25 | 4.97 | 1.53 | 155 | ok |
| Ruta 47 - Altamira Centro / Laguna de la Puerta | 3.56 | 2.26 | 0.64 | 1795 | revisar-snap-lejano |
| Ruta 48 - Altamira / Puerto Industrial | 9.96 | 13.31 | 1.34 | 45 | ok |
| Ruta 49 - Monte Alto / Puerto Industrial | 6.81 | 10.79 | 1.58 | 165 | ok |
| Blanco Kinder | 2.88 | 3.26 | 1.13 | 7 | ok |
| Puertas Coloradas | 3.54 | 7.58 | 2.14 | 92 | ok |
| Enrique Cárdenas / UAT | 3.10 | 3.98 | 1.28 | 16 | ok |
| Madero Kehoe | 2.81 | 15.32 | 5.45 | 282 | revisar-desvio |
| Águila Echeverría | 3.02 | 4.13 | 1.37 | 37 | ok |
| Tampico - Las Flores | 3.44 | 5.43 | 1.58 | 16 | ok |
| Altamira Av. Monterrey | 11.91 | 18.22 | 1.53 | 16 | ok |
| Arboledas x Electricistas | 2.95 | 4.27 | 1.45 | 58 | ok |
| Combi Bellavista | 2.58 | 3.44 | 1.34 | 90 | ok |
| Puente Las Piñas | 3.79 | 2.26 | 0.60 | 2017 | revisar-snap-lejano |
