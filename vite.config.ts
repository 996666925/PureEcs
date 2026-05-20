import { defineConfig } from 'vite'
import dts from 'vite-plugin-dts'

export default defineConfig({
  plugins: [dts()],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'PureEcs',
      formats: ['es', 'cjs'],
      fileName: (format) => `pureecs.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: [],
    },
  },
})
