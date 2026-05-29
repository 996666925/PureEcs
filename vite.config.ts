import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [
    dts(),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'PureEcs',
      formats: ['es'],
      fileName: (format) => `pureecs.mjs`,
    },
    rollupOptions: {
      external: [],
    },
  },
})
