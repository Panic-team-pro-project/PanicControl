import { defineConfig } from 'vitest/config';

// Runs the tests of every package together, with one summary.
export default defineConfig({
    test: {
        projects: [
            { test: { name: 'server', root: './server' } },
            { test: { name: 'sdk', root: './sdk' } },
            {
                extends: './client_host/vite.config.ts',
                test: { name: 'client_host', root: './client_host' },
            },
        ],
    },
});
