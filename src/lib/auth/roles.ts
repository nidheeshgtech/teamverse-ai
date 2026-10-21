export const roles = ["owner", "admin", "member"] as const;
export type Role = (typeof roles)[number];

export const ADMIN_ROLES: readonly Role[] = ["owner", "admin"];

export function isAdminRole(role: Role): boolean {
  return ADMIN_ROLES.includes(role);
}

/** Where a user lands after sign-in: admins get the 3D office dashboard, employees their inbox. */
export function homePathFor(role: Role): string {
  return isAdminRole(role) ? "/office" : "/comms";
}
