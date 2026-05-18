import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      // Do NOT clean out/main — sdkHost.mjs lives there too (built separately)
      emptyOutDir: false,
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/main/index.ts'),
          ptyHost: resolve(__dirname, 'src/pty-host/pty-host.ts')
          // sdkHost is compiled separately as ESM (.mjs) via tsconfig.sdkhost.json
          // because @anthropic-ai/claude-code is ESM-only
        },
        output: {
          entryFileNames: '[name].js'
        }
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    }
  }
})
