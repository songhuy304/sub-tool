import axios, { AxiosError } from 'axios';
import { API_URL } from '@/config/app.config';
import { clearAdminApiKey, getAdminApiKey } from '@/lib/admin-auth';

export const adminAxios = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 60_000
});

adminAxios.interceptors.request.use((config) => {
  const key = getAdminApiKey();
  if (key) {
    config.headers['X-Admin-Key'] = key;
  }
  return config;
});

adminAxios.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ detail?: string; error?: string; message?: string }>) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      clearAdminApiKey();
      if (!window.location.pathname.startsWith('/admin/login')) {
        window.location.href = '/admin/login';
      }
    }
    return Promise.reject(error);
  }
);

export function getAdminErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    const data = error.response?.data as
      | { detail?: string; error?: string; message?: string }
      | undefined;

    if (status === 401) return 'Sai hoặc thiếu Admin API Key.';
    if (status === 503) return 'Server chưa cấu hình ADMIN_API_KEY.';
    if (status === 404) return data?.error || data?.detail || 'Không tìm thấy.';
    if (status === 400) return data?.error || data?.detail || 'Yêu cầu không hợp lệ.';
    if (status === 500) return data?.error || data?.detail || 'Lỗi server (kiểm tra TOKEN_SETS).';

    return (
      data?.detail ||
      data?.error ||
      data?.message ||
      error.message ||
      'Không thể kết nối API.'
    );
  }

  if (error instanceof Error) return error.message;
  return 'Đã xảy ra lỗi không xác định.';
}
