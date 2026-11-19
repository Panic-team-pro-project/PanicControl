import type { ErrorCode } from 'common';

/**
 * Error codes an SDK request can fail with: the server's codes plus two codes raised locally.
 * - `'TIMEOUT'`: the server did not answer in time.
 * - `'BAD_RESPONSE'`: the server answered, but the answer is not a valid acknowledgement.
 */
export type SdkErrorCode = ErrorCode | 'TIMEOUT' | 'BAD_RESPONSE';

/** Thrown (as a rejected promise) when the server refuses a request or does not answer in time. */
export class PanicControlError extends Error {
    /** Machine-readable reason, safe to switch on. `message` is meant for logs, not for players. */
    readonly code: SdkErrorCode;

    constructor(code: SdkErrorCode, message: string) {
        super(message);
        this.name = 'PanicControlError';
        this.code = code;
    }
}
