import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Ensures assets are resolved with relative paths in Tauri desktop Webview
  server: {
    port: 5173,
    strictPort: true,
  },
})
