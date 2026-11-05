/**
 * Password recovery (public endpoints, no bearer token).
 *
 *  - `POST /v1/auth/forgot-password` always answers 200 with a generic message,
 *    whether or not the account exists, so the UI must not hint either way.
 *  - The e-mailed link is `{frontend}/reset-password?token=...`. The token is
 *    single use and only the newest one is valid.
 *  - `POST /v1/auth/reset-password` revokes every session of the user, so the
 *    user must sign in again everywhere.
 */

import { api } from "./api";

export interface MessageResponse {
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

/** Server-provided message for service errors (the envelope's `message`), else a fallback. */
export function errorMessage(error: unknown, fallback: string): string {
  const message = (error as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return message || fallback;
}

export async function requestPasswordReset(email: string): Promise<MessageResponse> {
  const { data } = await api.post<MessageResponse>(
    "/v1/auth/forgot-password",
    { email },
    { skipAuth: true },
  );
  return data;
}

export async function resetPassword(body: ResetPasswordRequest): Promise<MessageResponse> {
  const { data } = await api.post<MessageResponse>("/v1/auth/reset-password", body, {
    skipAuth: true,
  });
  return data;
}
