import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    server: {
        port: 5173,
        strictPort: true,
        open: true,
        host: true,
    },
    build: {
        outDir: 'dist',

        // ===== Memory & CPU savings =====

        // Disable sourcemaps in production (saves ~30% memory + time during build)
        // Set to true if you need stack traces from production errors
        sourcemap: false,

        // Use esbuild for minification (much faster + less RAM than terser)
        minify: 'esbuild',

        // Don't generate gzip/brotli size reports (saves the "computing gzip size..." phase)
        reportCompressedSize: false,

        // Cap parallel file operations during build
        // Default is unlimited; capping prevents disk + memory thrashing
        rollupOptions: {
            maxParallelFileOps: 5,
            // Mute the harmless "use client" warnings from MUI
            onwarn(warning, warn) {
                if (warning.code === 'MODULE_LEVEL_DIRECTIVE') return
                warn(warning)
            },
        },

        // Set a higher chunk size warning limit (default 500 KB triggers noise)
        chunkSizeWarningLimit: 1000,
    },
})
