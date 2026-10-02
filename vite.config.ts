import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { powerApps } from "@microsoft/power-apps-vite/plugin"

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), powerApps()],
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  server: { port: 3000, strictPort: true },
  build: {
    rollupOptions: {
      output: {
        // Libraries change rarely: separate chunks stay cached across app releases.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler|react-router|react-router-dom)[\\/]/.test(id)) return 'vendor-react';
          if (id.includes('@microsoft/power-apps')) return 'vendor-powerapps';
          if (/[\\/]node_modules[\\/](@tanstack|date-fns|lucide-react)[\\/]/.test(id)) return 'vendor-libs';
          return undefined;
        },
      },
    },
  },
});
