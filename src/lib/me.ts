/**
 * Current-user account service (`/v1/me`). Separate from the tenant
 * organization service so global account settings (password) never get
 * conflated with membership administration.
 */

import { api } from "./api";

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ChangePasswordResponse {
  message: string;
}

/** `POST /v1/me/change-password` — self-service password change for any session. */
export async function changePassword(body: ChangePasswordRequest): Promise<ChangePasswordResponse> {
  const { data } = await api.post<ChangePasswordResponse>("/v1/me/change-password", body);
  return data;
}
