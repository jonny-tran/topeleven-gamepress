/**
 * Standard API response envelope applied to every tRPC procedure.
 * Matches the format used across the platform:
 * {
 *   statusCode: number,
 *   message: string,
 *   data: T,
 *   timestamp: string,
 *   path: string, // tRPC procedure path, e.g. "team.createBulk"
 *   noChange?: boolean, // only set when mutation produced no actual change
 * }
 */

export interface ApiResponseEnvelope<T> {
  statusCode: number;
  message: string;
  data: T;
  timestamp: string;
  path: string;
  noChange?: boolean;
}

export type ApiResponse<T> = ApiResponseEnvelope<T>;
