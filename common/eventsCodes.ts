const ClientEvents = {
    // common events
    ERROR: 'error',

    // console events
    ROOM_CREATED: 'room_created',
    ROOM_CLOSED: 'room_closed',
    RECONNECTED_TO_ROOM: 'reconnected_to_room',
    UPDATE_PLAYERS: 'update_players',
    DISCONNECTED_USER: 'disconnected_user',

    // controller events
    PLAYER_JOINED: 'player_joined',
    PROMOTE_TO_HOST: 'promote_to_host',
    CONSOLE_DISCONNECTED: 'console_disconnected',
    CONSOLE_RECONNECTED: 'console_reconnected',

    // game events
    CATALOGUE: 'catalogue',
    CATALOGUE_SELECTION: 'catalogue_selection',
    GAME_STARTED: 'game_started',
    GAME_STOPPED: 'game_stopped',
    PLAYER_ACTION: 'player_action',
    GAME_MESSAGE: 'game_message',
    PLAYER_STATE: 'player_state',
} as const;

const ServerEvents = {
    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
    RECONNECT_TO_ROOM: 'reconnect_to_room',
    NAVIGATE_CATALOGUE: 'navigate_catalogue',
    START_GAME: 'start_game',
    STOP_GAME: 'stop_game',
    SEND_ACTION: 'send_action',
    BROADCAST_MESSAGE: 'broadcast_message',
    SEND_PRIVATE_MESSAGE: 'send_private_message',
    SET_PLAYER_ROLE: 'set_player_role',
    SET_PLAYER_STATUS: 'set_player_status',
} as const;

const ErrorCodes = {
    NOT_CONSOLE: 'NOT_CONSOLE',
    NOT_HOST: 'NOT_HOST',
    NOT_IN_ROOM: 'NOT_IN_ROOM',
    INVALID_PAYLOAD: 'INVALID_PAYLOAD',
    NO_GAME_SELECTED: 'NO_GAME_SELECTED',
    GAME_ALREADY_RUNNING: 'GAME_ALREADY_RUNNING',
    NO_GAME_RUNNING: 'NO_GAME_RUNNING',
    NOT_ENOUGH_PLAYERS: 'NOT_ENOUGH_PLAYERS',
    TOO_MANY_PLAYERS: 'TOO_MANY_PLAYERS',
    PLAYER_NOT_FOUND: 'PLAYER_NOT_FOUND',
    PLAYER_DISCONNECTED: 'PLAYER_DISCONNECTED',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const eventsCodes = {
    ClientEvents,
    ServerEvents,
    ErrorCodes,
};

export default eventsCodes;
