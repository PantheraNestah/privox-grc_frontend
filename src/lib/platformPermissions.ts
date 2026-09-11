/**
 * Platform-admin permission codes.
 *
 * These are the `platform.*` authorities carried in a platform token's
 * `permissions` claim (mapped 1:1 from the backend, no prefix). Used to gate
 * platform navigation items and action buttons.
 */

export const PLATFORM_PERMISSIONS = {
  organizationView: "platform.organization.view",
  organizationCreate: "platform.organization.create",
  organizationApprove: "platform.organization.approve",
  organizationReject: "platform.organization.reject",
  organizationSuspend: "platform.organization.suspend",
  organizationDeactivate: "platform.organization.deactivate",
  moduleAssign: "platform.module.assign",
  orgNodeManage: "platform.orgnode.manage",
  userInvite: "user.invite",
} as const;

export type PlatformPermission =
  (typeof PLATFORM_PERMISSIONS)[keyof typeof PLATFORM_PERMISSIONS];

export function canPlatform(
  permissions: readonly string[] | null | undefined,
  permission: PlatformPermission,
): boolean {
  return !!permissions?.includes(permission);
}

export function canAnyPlatform(
  permissions: readonly string[] | null | undefined,
  required: readonly PlatformPermission[],
): boolean {
  return required.some((permission) => canPlatform(permissions, permission));
}
