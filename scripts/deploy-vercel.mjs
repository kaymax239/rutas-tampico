import { spawnSync } from "node:child_process";

if (!process.env.VERCEL_TOKEN) {
  console.error(
    "Falta VERCEL_TOKEN. Configura el token en el entorno antes de ejecutar npm run deploy:vercel."
  );
  process.exit(1);
}

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(
  npxCommand,
  [
    "--yes",
    "vercel@latest",
    "--prod",
    "--yes",
    "--token",
    process.env.VERCEL_TOKEN,
  ],
  {
    stdio: "inherit",
    shell: process.platform === "win32",
  }
);

process.exit(result.status ?? 1);
