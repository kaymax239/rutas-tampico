export const metadata = {
  title: "Política de Privacidad – KAYMAX Rutas Tampico",
  description: "Política de privacidad de KAYMAX Rutas Tampico.",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#e5e7eb",
        padding: "32px 16px",
      }}
    >
      <article
        style={{
          width: "100%",
          maxWidth: 860,
          margin: "0 auto",
          background: "#111827",
          border: "1px solid rgba(148,163,184,.25)",
          borderRadius: 24,
          padding: "clamp(24px, 5vw, 44px)",
          boxShadow: "0 18px 50px rgba(0,0,0,.35)",
          lineHeight: 1.7,
        }}
      >
        <p
          style={{
            color: "#93c5fd",
            fontSize: 14,
            fontWeight: 800,
            letterSpacing: ".08em",
            margin: "0 0 10px",
            textTransform: "uppercase",
          }}
        >
          KAYMAX Rutas Tampico
        </p>

        <h1
          style={{
            color: "white",
            fontSize: "clamp(30px, 7vw, 46px)",
            lineHeight: 1.1,
            margin: "0 0 18px",
          }}
        >
          Política de Privacidad
        </h1>

        <p style={{ color: "#cbd5e1", marginBottom: 28 }}>
          Esta política describe cómo KAYMAX Rutas Tampico maneja la información
          relacionada con el uso de la aplicación.
        </p>

        <section style={{ display: "grid", gap: 22 }}>
          <div>
            <h2 style={{ color: "white", fontSize: 22, marginBottom: 8 }}>
              Uso de ubicación
            </h2>
            <p>
              La aplicación puede usar la ubicación del dispositivo para mostrar
              rutas, ubicar al usuario en el mapa y habilitar funciones de
              seguridad relacionadas con el viaje.
            </p>
          </div>

          <div>
            <h2 style={{ color: "white", fontSize: 22, marginBottom: 8 }}>
              Uso de datos
            </h2>
            <p>
              Los datos se usan únicamente para el funcionamiento de la
              aplicación, incluyendo la visualización de rutas, sugerencias,
              usuarios en línea y funciones de seguridad.
            </p>
          </div>

          <div>
            <h2 style={{ color: "white", fontSize: 22, marginBottom: 8 }}>
              Venta de información
            </h2>
            <p>
              KAYMAX Rutas Tampico no vende información personal de los usuarios.
            </p>
          </div>

          <div>
            <h2 style={{ color: "white", fontSize: 22, marginBottom: 8 }}>
              Control del usuario
            </h2>
            <p>
              El usuario puede dejar de usar la aplicación en cualquier momento.
              También puede negar o retirar permisos del dispositivo desde la
              configuración de Android.
            </p>
          </div>

          <div>
            <h2 style={{ color: "white", fontSize: 22, marginBottom: 8 }}>
              Contacto
            </h2>
            <p>
              Para preguntas relacionadas con esta política de privacidad,
              escribe a{" "}
              <a
                href="mailto:victor_cadena@yahoo.com"
                style={{ color: "#60a5fa", fontWeight: 800 }}
              >
                victor_cadena@yahoo.com
              </a>
              .
            </p>
          </div>
        </section>

        <p
          style={{
            borderTop: "1px solid rgba(148,163,184,.25)",
            color: "#94a3b8",
            fontSize: 14,
            marginTop: 32,
            paddingTop: 18,
          }}
        >
          Última actualización: 11 de junio de 2026.
        </p>
      </article>
    </main>
  );
}
