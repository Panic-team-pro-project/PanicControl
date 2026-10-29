const ClientEvents = {
    // common events
    ERROR: 'error',

    // console events
    ROOM_CREATED: 'room_created',
    ROOM_CLOSED: 'room_closed',
    UPDATE_PLAYERS: 'update_players',
    GAME_INFO: 'game_info',
    DISCONNECTED_USER: 'disconnected_user',

    // controller events
    PLAYER_JOINED: 'player_joined',
} as const;

const ServerEvents = {
    CREATE_ROOM: 'create_room',
    JOIN_ROOM: 'join_room',
} as const;

const eventsCodes = {
    ClientEvents,
    ServerEvents
};

export default eventsCodes;