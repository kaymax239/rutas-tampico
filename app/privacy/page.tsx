import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aviso de Privacidad | Rutas Tampico MAFA",
  description:
    "Aviso de privacidad de la aplicación Rutas Tampico MAFA (Kaymax): qué datos recopilamos, cómo los usamos y cómo los compartimos.",
  robots: { index: true, follow: true },
};

// Fecha de última actualización del aviso.
const ULTIMA_ACTUALIZACION = "20 de julio de 2026";

// Correo de contacto de privacidad (mostrado públicamente).
const CORREO_CONTACTO = "victor@kaymaxllc.com";

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 820,
        margin: "0 auto",
        padding: "40px 20px 80px",
        color: "#1f2937",
        lineHeight: 1.65,
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <h1 style={{ fontSize: "2rem", marginBottom: 4 }}>Aviso de Privacidad</h1>
      <p style={{ fontWeight: 600, margin: "0 0 4px" }}>Rutas Tampico MAFA</p>
      <p style={{ color: "#6b7280", marginTop: 0 }}>
        Última actualización: {ULTIMA_ACTUALIZACION}
      </p>

      <section>
        <p>
          Este Aviso de Privacidad describe cómo la aplicación <strong>Rutas
          Tampico MAFA</strong> (en adelante, &quot;la App&quot;), desarrollada
          por <strong>Kaymax</strong>, recopila, usa, almacena y comparte la
          información de sus usuarios. La App ofrece información de transporte
          público en tiempo real para la zona metropolitana de Tampico, Ciudad
          Madero y Altamira, Tamaulipas, México. Al usar la App, aceptas las
          prácticas descritas en este aviso.
        </p>
      </section>

      <h2 style={h2}>1. Responsable del tratamiento</h2>
      <p>
        El responsable del tratamiento de tus datos es <strong>Kaymax</strong>,
        desarrollador de la App. Para cualquier asunto relacionado con tu
        privacidad puedes contactarnos en{" "}
        <a href={`mailto:${CORREO_CONTACTO}`} style={link}>
          {CORREO_CONTACTO}
        </a>
        .
      </p>

      <h2 style={h2}>2. Información que recopilamos</h2>
      <p>Dependiendo de cómo uses la App, podemos recopilar:</p>
      <ul style={ul}>
        <li>
          <strong>Ubicación en tiempo real (GPS).</strong> Si activas el modo
          &quot;Soy Chofer&quot;, transmitimos la ubicación del dispositivo para
          mostrar la posición del transporte en el mapa a otros usuarios. En el
          modo pasajero, la ubicación se utiliza de forma local para mostrarte
          rutas y lugares cercanos; solo se comparte cuando tú activas una
          función que lo requiere (por ejemplo, indicar que esperas una ruta o
          usar &quot;Pasajero Seguro&quot;).
        </li>
        <li>
          <strong>Identificador anónimo.</strong> Generamos un identificador de
          usuario anónimo almacenado en tu dispositivo para distinguir sesiones,
          evitar conteos duplicados y mantener el funcionamiento de la App. No
          está vinculado a tu nombre, correo ni número telefónico.
        </li>
        <li>
          <strong>Datos de uso y presencia.</strong> Registramos información
          como usuarios en línea, rutas consultadas, kilómetros de trayecto
          (para choferes) y eventos de interacción, con el fin de operar y
          mejorar el servicio.
        </li>
        <li>
          <strong>Métricas de anuncios.</strong> Cuando se muestran tarjetas de
          negocios o contenido patrocinado, registramos impresiones y clics de
          forma agregada (una impresión por usuario, por anuncio y por día) para
          medir su alcance. Estas métricas no identifican personalmente al
          usuario.
        </li>
      </ul>
      <p>
        La App <strong>no solicita</strong> datos como nombre, correo
        electrónico, contraseña, contactos, fotos ni información de pago para su
        funcionamiento básico.
      </p>

      <h2 style={h2}>3. Cómo usamos la información</h2>
      <ul style={ul}>
        <li>Mostrar la ubicación de las unidades de transporte en tiempo real.</li>
        <li>Mostrarte rutas, paradas y lugares cercanos a tu ubicación.</li>
        <li>
          Habilitar funciones como &quot;Estoy esperando esta ruta&quot;,
          &quot;Pasajero Seguro&quot; y el botón de emergencia 911.
        </li>
        <li>Contabilizar usuarios en línea y estadísticas de uso.</li>
        <li>Medir el desempeño de anuncios y contenido patrocinado.</li>
        <li>Mantener la seguridad, prevenir abusos y mejorar la App.</li>
      </ul>

      <h2 style={h2}>4. Con quién compartimos la información</h2>
      <p>
        No vendemos tu información personal. Compartimos datos únicamente con los
        siguientes proveedores de servicios, que los procesan por nuestra cuenta:
      </p>
      <ul style={ul}>
        <li>
          <strong>Google Firebase (Firestore).</strong> Almacenamiento en la
          nube de los datos de operación (ubicaciones de choferes, presencia,
          métricas). Consulta la{" "}
          <a href="https://firebase.google.com/support/privacy" style={link} target="_blank" rel="noopener noreferrer">
            política de privacidad de Firebase
          </a>
          .
        </li>
        <li>
          <strong>Google Maps / Google Places.</strong> Para mostrar el mapa y
          los lugares cercanos. Consulta la{" "}
          <a href="https://policies.google.com/privacy" style={link} target="_blank" rel="noopener noreferrer">
            política de privacidad de Google
          </a>
          .
        </li>
      </ul>
      <p>
        También podemos divulgar información si la ley lo exige o para proteger
        los derechos, la seguridad o la integridad de los usuarios y del público.
      </p>

      <h2 style={h2}>5. Permisos de ubicación</h2>
      <p>
        La App requiere permiso de ubicación para funcionar. Puedes conceder o
        revocar este permiso en cualquier momento desde la configuración de tu
        dispositivo (Ajustes &rarr; Aplicaciones &rarr; Rutas Tampico MAFA &rarr;
        Permisos). Si revocas el permiso de ubicación, algunas funciones dejarán
        de estar disponibles.
      </p>

      <h2 style={h2}>6. Botón de emergencia (911)</h2>
      <p>
        La App incluye un acceso directo al número de emergencias 911. Al usarlo,
        se inicia una llamada a través de tu operador telefónico; Kaymax no
        gestiona ni almacena el contenido de dichas llamadas.
      </p>

      <h2 style={h2}>7. Conservación de datos</h2>
      <p>
        Conservamos los datos operativos únicamente durante el tiempo necesario
        para prestar el servicio y cumplir con fines estadísticos y legales. Los
        datos de ubicación en tiempo real son transitorios y se actualizan de
        forma continua mientras la función está activa.
      </p>

      <h2 style={h2}>8. Seguridad</h2>
      <p>
        Aplicamos medidas técnicas y organizativas razonables para proteger la
        información, incluidas reglas de acceso por colección con validación en
        nuestra base de datos. Ningún sistema es completamente seguro, por lo que
        no podemos garantizar seguridad absoluta.
      </p>

      <h2 style={h2}>9. Menores de edad</h2>
      <p>
        La App está dirigida al público general y no recopila de forma
        intencionada datos personales identificables de menores. Si consideras
        que un menor nos ha proporcionado información, contáctanos para
        eliminarla.
      </p>

      <h2 style={h2}>10. Tus derechos</h2>
      <p>
        Puedes solicitar información sobre los datos que tratamos, así como su
        eliminación, escribiéndonos a{" "}
        <a href={`mailto:${CORREO_CONTACTO}`} style={link}>
          {CORREO_CONTACTO}
        </a>
        . Como el identificador es anónimo, es posible que te solicitemos datos
        adicionales para localizar la información asociada a tu dispositivo.
      </p>

      <h2 style={h2}>11. Cambios a este aviso</h2>
      <p>
        Podemos actualizar este Aviso de Privacidad ocasionalmente. Publicaremos
        la versión vigente en esta misma página, indicando la fecha de última
        actualización.
      </p>

      <h2 style={h2}>12. Contacto</h2>
      <p>
        Si tienes preguntas sobre este aviso o sobre el tratamiento de tus datos,
        contáctanos en{" "}
        <a href={`mailto:${CORREO_CONTACTO}`} style={link}>
          {CORREO_CONTACTO}
        </a>
        .
      </p>
    </main>
  );
}

const h2: React.CSSProperties = {
  fontSize: "1.25rem",
  marginTop: 32,
  marginBottom: 8,
};

const ul: React.CSSProperties = {
  paddingLeft: 20,
  margin: "8px 0",
};

const link: React.CSSProperties = {
  color: "#2563eb",
  textDecoration: "underline",
};
