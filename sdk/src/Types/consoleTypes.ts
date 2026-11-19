export interface PlayerListInfo {
    name: string;
    playerId: string;
    isConnected: boolean;
    isHost: boolean;
    /** Secret of the player, set by the game. Private to the player and the screen: never display it to everyone. */
    role: string | null;
    /** Short state of the player (alive, ready...), set by the game. */
    status: string | null;
}

export interface ConsoleSDKOptions {
    /** URL of the PanicControl server. */
    serverUrl: string;
    /** Logs connection events to the browser console. Off by default. */
    debug?: boolean;
}
