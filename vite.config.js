import { defineConfig } from 'vite'

export default defineConfig({
  // Project Pages URL is /jarvis-portfolio/ — without this, the build emits
  // root-absolute /assets/... paths that 404 on the live site (no JS/CSS,
  // white unstyled page, loader stuck). Keep this base for any project Pages URL.
  base: '/jarvis-portfolio/',
  server: { port: 5173 },
  preview: { port: 4173 },
})
