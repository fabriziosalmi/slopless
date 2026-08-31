import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/engine/api.ts'],
    format: ['cjs'],
    target: 'node16',
    clean: true,
    dts: true,
    minify: true,
    bundle: true,
    outDir: 'dist',
});
