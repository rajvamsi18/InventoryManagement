import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: './',
  plugins: [react(), VitePWA({ registerType: 'autoUpdate', manifest: { name: 'Stockroom Grocery Inventory', short_name: 'Stockroom', display: 'standalone', theme_color: '#1c6546', background_color: '#f6f4ed', icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }] } })],
})
