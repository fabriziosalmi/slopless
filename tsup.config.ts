import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts', 'src/engine/api.ts'],
    format: ['cjs'],
    target: 'node16',
    clean: true,
    dts: true,
    minify: true,
    bundle: true,
    // Everything ships inside the bundle: the Action runs dist/index.js with no
    // npm install, and a published package with no dependencies has no install
    // surface to attack. `npm run verify:bundle` proves it stays that way.
    noExternal: [/.*/],
    outDir: 'dist',
});
