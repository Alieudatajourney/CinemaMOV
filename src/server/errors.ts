export type ErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "SEAT_UNAVAILABLE"
  | "HOLD_EXPIRED"
  | "LIMIT"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "SCREENING_CLOSED";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  SEAT_UNAVAILABLE: 409,
  HOLD_EXPIRED: 410,
  LIMIT: 400,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  SCREENING_CLOSED: 409,
};

export class ServiceError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
  get status() {
    return STATUS[this.code];
  }
}

export function fail(code: ErrorCode, message: string, details?: Record<string, unknown>): never {
  throw new ServiceError(code, message, details);
}
