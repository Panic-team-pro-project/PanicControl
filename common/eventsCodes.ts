const ClientEvents = {
    // common events
    ERROR: 'error',

    // console events
    ROOM_CREATED: 'room_created',
    ROOM_CLOSED: 'room_closed',
    RECONNECTED_TO_ROOM: 'reconnected_to_room',
    UPDATE_PLAYERS: 'update_players',
    GAME_INFO: 'game_info',
    DISCONNECTED_USER: 'disconnected_user',

    // controller events
    PLAYER_JOINED: 'player_joined',
    PROMOTE_TO_HOST: 'promote_to_host',
    CONSOLE_DISCONNECTED: 'console_disconnected',
    CONSOLE_RECONNECTED: 'console_reconnected',
} as const;

const ServerEvents = {
    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
    RECONNECT_TO_ROOM: 'reconnect_to_room',
} as const;

const eventsCodes = {
    ClientEvents,
    ServerEvents
};

export default eventsCodes;