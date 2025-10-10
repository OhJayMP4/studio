// This represents the top-level user profile stored in the /users collection
export type UserProfile = {
  uid: string;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
};
