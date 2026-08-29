export const USER_ROLES = ['CUSTOMER', 'SELLER', 'ADMIN'] as const;
export type UserRole = (typeof USER_ROLES)[number];

export type AuthenticatedUser = {
  id: string;
  firebaseUid: string;
  email: string | null;
  displayName: string | null;
  role: UserRole;
};
