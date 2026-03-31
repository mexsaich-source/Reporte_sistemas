import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [tailwindcss(), react()],
  server: {
    port: 5173,
    strictPort: true,
    allowedHosts: ['pgp-country-behind-enables.trycloudflare.com'] // <- sin https://
  }
})