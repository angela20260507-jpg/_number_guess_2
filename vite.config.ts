import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: "/_number_guess_2/",
  plugins: [react(), tailwindcss()],
});
