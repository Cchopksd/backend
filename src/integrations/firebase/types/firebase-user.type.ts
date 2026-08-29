export type FirebaseUser = {
  uid: string;
  email?: string;
  emailVerified?: boolean;
  displayName?: string;
};

export type VerifiedFirebaseToken = FirebaseUser & {
  signInProvider?: string;
};
