export interface SsoLoginParams {
  login_id: string;
  login_tid: string;
}

export interface BusinessSsoUser {
  login_id: string;
  email: string;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface SsoLoginResult {
  userId: string;
  email: string;
  isNewUser: boolean;
  redirectTo: string;
}
