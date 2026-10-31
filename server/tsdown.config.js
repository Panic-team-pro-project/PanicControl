import { defineConfig } from 'tsdown';

export default defineConfig({
    entry: ['src/server.ts'],
    format: 'esm',
    platform: 'node',
    outDir: 'dist',
    dts: false,
    // common ships TypeScript sources: bundle it so Node never has to load a .ts file
    deps: { alwaysBundle: ['common'] },
});
