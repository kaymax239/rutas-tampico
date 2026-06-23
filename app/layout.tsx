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
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;0,800;1,500&display=swap"
        />
        {children}
        <Analytics />
      </body>
    </html>
  );
}