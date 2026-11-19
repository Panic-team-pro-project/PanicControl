import { MAX_MESSAGE_BYTES } from '../config.js';

export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };

const TYPE_PATTERN = /^[A-Za-z0-9_.:-]+$/;

export function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function checkMessageType(type: unknown): Checked<string> {
    if (typeof type !== 'string' || type.length < 1 || type.length > 64) {
        return { ok: false, reason: 'type must be a string of 1 to 64 characters' };
    }
    if (!TYPE_PATTERN.test(type)) {
        return { ok: false, reason: 'type contains forbidden characters' };
    }
    return { ok: true, value: type };
}

export function checkMessageData(
    data: unknown,
    maxBytes: number = MAX_MESSAGE_BYTES,
): Checked<unknown> {
    if (data === undefined) {
        return { ok: true, value: undefined };
    }

    let json: string | undefined;
    try {
        json = JSON.stringify(data);
    } catch {
        return { ok: false, reason: 'data is not serialisable' };
    }
    if (json === undefined) {
        return { ok: false, reason: 'data is not serialisable' };
    }
    if (Buffer.byteLength(json) > maxBytes) {
        return { ok: false, reason: `data is larger than ${maxBytes} bytes` };
    }
    return { ok: true, value: data };
}

export function checkLabel(label: unknown): Checked<string | null> {
    if (label === null) {
        return { ok: true, value: null };
    }
    if (typeof label !== 'string') {
        return { ok: false, reason: 'label must be a string or null' };
    }
    const trimmed = label.trim();
    if (trimmed.length < 1 || trimmed.length > 50) {
        return { ok: false, reason: 'label must be 1 to 50 characters' };
    }
    return { ok: true, value: trimmed };
}
