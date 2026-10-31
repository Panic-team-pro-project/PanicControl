export default {
    extends: ['@commitlint/config-conventional'],
    rules: {
        // Keep in sync with the "Scopes" section of docs/COMMIT_RULES.md
        'scope-enum': [
            2,
            'always',
            [
                // Product domains
                'room',
                'player',
                'moderation',
                'protocol',
                'sdk',
                'console',
                'controller',
                'game',
                'web',
                'api',
                // Project-wide
                'deps',
                'docs',
                'adr',
                'docker',
                'release',
            ],
        ],
    },
};
