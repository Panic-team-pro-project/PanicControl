// Runtime configuration, read from the environment. See .env.example for each variable.

const DEFAULT_SERVER_PORT = 3000;

export const SERVER_URL =
    import.meta.env.VITE_SERVER_URL ||
    `${window.location.protocol}//${window.location.hostname}:${DEFAULT_SERVER_PORT}`;

export const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL || window.location.origin;

// Turns on the SDK debug logs (connections, refused requests) in the browser console.
export const SDK_DEBUG = import.meta.env.VITE_SDK_DEBUG === 'true';
