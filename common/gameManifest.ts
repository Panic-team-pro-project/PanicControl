export const CONTROLLER_COMPONENTS = [
    'button',
    'dpad',
    'joystick',
    'touch',
    'text',
    'choice',
    'drawing',
    'motion',
] as const;

export const ACCESSIBILITY_FEATURES = [
    'colorBlind',
    'textSize',
    'slowDown',
    'textToSpeech',
    'subtitles',
    'noFlashing',
    'noVibration',
] as const;

export type ControllerComponent = (typeof CONTROLLER_COMPONENTS)[number];
export type AccessibilityFeature = (typeof ACCESSIBILITY_FEATURES)[number];

/**
 * Pages of a game, as paths relative to the game folder (e.g. `screen.html` or
 * `dist/screen.html`). Loaded by the platform in a later version.
 */
export interface GameEntry {
    /** Page shown on the shared screen. */
    screen: string;
    /** Page shown on each phone. */
    controller: string;
}

export interface GameManifest {
    id: string;
    name: string;
    version: string;
    minPlayers: number;
    maxPlayers: number;
    durationMinutes: number;
    controllerComponents: ControllerComponent[];
    accessibilityFeatures: AccessibilityFeature[];
    entry: GameEntry;
    description?: string;
}

export const DIRECTIONS = ['up', 'down', 'left', 'right'] as const;
export type Direction = (typeof DIRECTIONS)[number];
