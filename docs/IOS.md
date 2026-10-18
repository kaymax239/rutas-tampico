# Rutas Tampico en iPhone (Capacitor 8 + Codemagic)

El proyecto iOS ya está generado en `ios/` (bundle id `com.rutastampico.mafa`, nombre "Rutas Tampico",
permisos de ubicación en español). Usa Swift Package Manager (no CocoaPods). Falta lo que sólo tú puedes hacer:

## 1. Cuenta Apple Developer (US$99/año)
- https://developer.apple.com/programs/enroll/
- **Persona física**: rápido; en la tienda aparece tu nombre.
- **Empresa (Kaymax LLC)**: necesitas número **D-U-N-S** (gratis, días a ~2 semanas) y sitio web de la empresa.

## 2. Registrar el Bundle ID y la app
1. developer.apple.com → Certificates, IDs & Profiles → Identifiers → **+** → App IDs → `com.rutastampico.mafa`.
2. App Store Connect (appstoreconnect.apple.com) → Apps → **+ Nueva app**: plataforma iOS, nombre "Rutas Tampico",
   idioma Español (México), bundle id `com.rutastampico.mafa`, SKU `rutas-tampico`.
3. Copia el **Apple ID** numérico de la app (App Information) → va en `APP_STORE_APPLE_ID` de `codemagic.yaml`.

## 3. API key de App Store Connect
App Store Connect → Usuarios y acceso → Integraciones → **App Store Connect API** → generar clave con rol **App Manager**.
Guarda: **Issuer ID**, **Key ID** y el archivo **.p8** (sólo se descarga una vez).

## 4. Codemagic (plan gratis ~500 min/mes macOS)
1. https://codemagic.io → entra con GitHub → **Add application** → repo `kaymax239/rutas-tampico` → tipo *Capacitor / codemagic.yaml*.
2. Teams → Integrations → **Developer Portal / App Store Connect** → sube Issuer ID, Key ID y .p8; ponle un nombre
   y escríbelo en `codemagic.yaml` en lugar de `<NOMBRE_DE_TU_API_KEY>`.
3. Reemplaza los demás placeholders (`APP_STORE_APPLE_ID`, correo). Crea el grupo de variables `app_store` (puede quedar vacío) o quítalo.
4. Lanza el workflow **ios-capacitor**. Al terminar, el build aparece en **TestFlight**.

## 5. Antes de enviar a revisión
- Prueba en tu iPhone con TestFlight (GPS, mapa, rutas, viaje).
- Ficha: capturas de iPhone 6.7" y 6.5", descripción, URL de privacidad
  `https://rutas-tampico-mafa.vercel.app/privacy`, URL de soporte.
- Cuestionario de privacidad: **Ubicación precisa** (funcionalidad de la app, no vinculada a identidad, sin rastreo).
- Riesgo **guía 4.2** (funcionalidad mínima): la app empaqueta la web dentro y usa GPS nativo; en las notas para
  el revisor explica las funciones (rutas por zona, camiones en tiempo real, modo chofer, registro de viajes).

## Desarrollo local (Mac)
```
npm ci && npm run build && npx cap sync ios && npx cap open ios
```
Nota: el CLI de Capacitor 8 requiere Node ≥ 22.
