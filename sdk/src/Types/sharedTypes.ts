import type { GameManifest } from 'common/gameManifest';

/** Loosest messages map: any event name, any data. Used when a game does not declare its own. */
export type MessageMap = Record<string, unknown>;

/** Names usable as event types in a messages map. */
export type EventKey<T> = Extract<keyof T, string>;

/**
 * Argument list for the data of an event declared in a map:
 * `void` or `undefined` means no argument, `unknown` means optional, anything else is required.
 */
export type DataArgs<T> = unknown extends T
    ? [data?: T]
    : [T] extends [void | undefined]
      ? []
      : [data: T];

/** The games the console can launch and the one currently highlighted. */
export interface CatalogueState {
    games: GameManifest[];
    selectedGameId: string | null;
}

/** What the screen decided about one player. Both are `null` until the game sets them. */
export interface PlayerState {
    role: string | null;
    status: string | null;
}

/** Information about how a message reached the controller. */
export interface MessageMeta {
    /** `true` when the message was sent to this player only, `false` when broadcast. */
    isPrivate: boolean;
}
