import apiClient from '../api/client';
import type { LoginCredentials, AuthResponse, User } from '../types';
export const authService = {
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const response = await apiClient.post<AuthResponse>('/api/auth/login', credentials);
    return response.data;
  },
  async getProfile(): Promise<User> {
    const response = await apiClient.get<User>('/api/auth/me');
    return response.data;
  },
  logout() {
    localStorage.removeItem('access_token');
    window.location.href = '/login';
  },
};
