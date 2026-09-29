/** React Query state layer for the current user's own account settings. */

import { useMutation } from "@tanstack/react-query";
import { changePassword, type ChangePasswordRequest } from "@/lib/me";

export function useChangePassword() {
  return useMutation({
    mutationFn: (body: ChangePasswordRequest) => changePassword(body),
  });
}
