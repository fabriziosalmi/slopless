import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/engine/api.ts'],
    format: ['cjs'],
    target: 'node16',
    clean: true,
    dts: true,
    minify: true,
    bundle: true,
    noExternal: ['commander', 'glob', 'ignore', 'minimatch'],   // the Action runs dist/index.js with no npm install
    outDir: 'dist',
});
