// Authentication types based on the API guide

export interface Role {
  id: string;
  code: string;
  name: string;
  description?: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  name: string;
  phone?: string;
  avatar?: string;
  roles?: Role[];
  permissions?: string[];
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  user: User;
}

export interface RefreshTokenRequest {
  refreshToken?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
}

export interface AuthErrorData {
  code:
    | 'INVALID_CREDENTIALS'
    | 'TOKEN_EXPIRED'
    | 'TOKEN_INVALID'
    | 'NETWORK_ERROR'
    | 'UNAUTHORIZED'
    | 'FORBIDDEN'
    | 'SERVER_ERROR';
  message: string;
  status?: number;
}

export class AuthError extends Error {
  code: AuthErrorData['code'];
  status?: number;

  constructor(code: AuthErrorData['code'], message: string, status?: number) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
    this.status = status;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AuthError);
    }
  }
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenExpiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export type Permission = string;

export interface PermissionCheck {
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  hasAllPermissions: (permissions: Permission[]) => boolean;
  hasRole: (roleCode: string) => boolean;
  hasAnyRole: (roleCodes: string[]) => boolean;
}
