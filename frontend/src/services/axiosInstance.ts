import axios from "axios";

const axiosInstance = axios.create({
  baseURL: "http://localhost:5000/api/v1",
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Attach Access Token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("gradia_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Variables for managing refresh token queue
let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Handle Token Refresh (401 expiry)
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 Unauthorized and not already retried
    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url.includes("/auth/login") &&
      !originalRequest.url.includes("/auth/refresh")
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return axiosInstance(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem("gradia_refresh_token");
      if (!refreshToken) {
        isRefreshing = false;
        window.dispatchEvent(new Event("auth_logout"));
        return Promise.reject(error);
      }

      try {
        const response = await axios.post("/auth/refresh", { refreshToken });
        const { success, data } = response.data;
        if (success && data) {
          const { accessToken, refreshToken: newRefreshToken, user } = data;
          
          localStorage.setItem("gradia_token", accessToken);
          localStorage.setItem("gradia_refresh_token", newRefreshToken);
          if (user) {
            localStorage.setItem("gradia_user", JSON.stringify(user));
          }

          axiosInstance.defaults.headers.common["Authorization"] = `Bearer ${accessToken}`;
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          
          processQueue(null, accessToken);
          isRefreshing = false;
          
          return axiosInstance(originalRequest);
        } else {
          throw new Error("Token refresh response did not return valid data");
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        isRefreshing = false;
        
        // Clear auth details
        localStorage.removeItem("gradia_token");
        localStorage.removeItem("gradia_refresh_token");
        localStorage.removeItem("gradia_user");
        localStorage.removeItem("gradia_school");
        
        window.dispatchEvent(new Event("auth_logout"));
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
export interface ApiResponseWrapper<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: any;
}
