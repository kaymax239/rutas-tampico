import { Analytics } from "@vercel/analytics/react";
import "./globals.css";

export const metadata = {
  title: "Rutas Tampico MAFA",
  description: "Rutas en tiempo real",
  verification: {
    google: "YADlmA3i_pMhMYYWXJ5AxQWZWW6WRSaeNpKGW2tbS54",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}