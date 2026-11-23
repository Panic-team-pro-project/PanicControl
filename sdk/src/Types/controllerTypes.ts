export interface ControllerSDKOptions {
    /** URL of the PanicControl server. */
    serverUrl: string;
    /** Identity kept from a previous session, to find one's place again after a reload. */
    playerId?: string;
    /** Logs connection events to the browser console. Off by default. */
    debug?: boolean;
}
