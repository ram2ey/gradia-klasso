import axiosInstance from "./axiosInstance";

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: any;
}

/**
 * Standard utility wrapper for API requests.
 * Uses axiosInstance internally for automatic JWT token injection and refresh.
 */
export async function apiRequest<T = any>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<{ success: boolean; data?: T; error?: string; meta?: any }> {
  try {
    const response = await axiosInstance({
      url: endpoint,
      method: options.method || "GET",
      data: options.body,
      headers: options.headers,
    });
    return response.data;
  } catch (error: any) {
    if (error.response && error.response.data) {
      return error.response.data;
    }
    return {
      success: false,
      error: error.message || "Network request failed",
    };
  }
}
export default apiRequest;
