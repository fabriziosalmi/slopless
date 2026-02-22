import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs'],
    target: 'node16',
    clean: true,
    minify: true,
    bundle: true,
    outDir: 'dist',
});
