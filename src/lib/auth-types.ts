/** DTO matching the backend auth API responses */

export interface LoginRequest {
  identifier: string;
  password: string;
  rememberMe: boolean;
}

export interface UserDto {
  id: string;
  email: string;
  username: string;
  fullName: string;
}

export interface OrganizationDto {
  id: string;
  code: string;
  name: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresIn: number;
  accessTokenExpiresAt: string;
  user: UserDto;
  organization: OrganizationDto;
  permissions: string[];
}

export interface MeResponse {
  id: string;
  email: string;
  username: string;
  fullName: string;
  organization: OrganizationDto;
  permissions: string[];
  accessTokenExpiresAt: string;
}

export interface AuthState {
  user: UserDto | null;
  organization: OrganizationDto | null;
  permissions: string[];
  accessToken: string | null;
  accessTokenExpiresAt: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
