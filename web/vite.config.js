import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages serves the site from /<repo-name>/; CI passes it in VITE_BASE.
export default defineConfig({
  base: process.env.VITE_BASE ?? '/vectes/',
  plugins: [react()],
})
