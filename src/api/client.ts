import axios from 'axios';
import * as SecureStore from '../utils/storage';
import { API_URL } from '../config';

const client = axios.create({
    baseURL: API_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add interceptor to inject token
client.interceptors.request.use(
    async (config) => {
        const token = await SecureStore.getItemAsync('access_token');
        if (token && config.headers) {
            if (typeof config.headers.set === 'function') {
                config.headers.set('Authorization', `Bearer ${token}`);
            } else {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor to automatically refresh token if it ever expires (401)
let isRefreshing = false;
let failedQueue: Array<{
    resolve: (token: string) => void;
    reject: (error: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach((prom) => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token!);
        }
    });
    failedQueue = [];
};

client.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        const url = originalRequest?.url || '';

        // If error is 401 and request was not already retried and is not auth endpoint
        if (
            error.response?.status === 401 &&
            originalRequest &&
            !originalRequest._retry &&
            !url.includes('/api/token/refresh/') &&
            !url.includes('/api/login/') &&
            !url.includes('/api/signup/') &&
            !url.includes('/api/verify/')
        ) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                    .then((token) => {
                        if (typeof originalRequest.headers.set === 'function') {
                            originalRequest.headers.set('Authorization', `Bearer ${token}`);
                        } else {
                            originalRequest.headers.Authorization = `Bearer ${token}`;
                        }
                        return client(originalRequest);
                    })
                    .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            const refreshToken = await SecureStore.getItemAsync('refresh_token');
            if (!refreshToken) {
                isRefreshing = false;
                return Promise.reject(error);
            }

            try {
                const response = await axios.post(`${API_URL}/api/token/refresh/`, {
                    refresh: refreshToken,
                });
                const newAccessToken = response.data?.access;
                if (newAccessToken) {
                    await SecureStore.setItemAsync('access_token', newAccessToken);
                    if (response.data.refresh) {
                        await SecureStore.setItemAsync('refresh_token', response.data.refresh);
                    }
                    if (client.defaults.headers.common) {
                        if (typeof (client.defaults.headers.common as any).set === 'function') {
                            (client.defaults.headers.common as any).set('Authorization', `Bearer ${newAccessToken}`);
                        } else {
                            client.defaults.headers.common['Authorization'] = `Bearer ${newAccessToken}`;
                        }
                    }
                    processQueue(null, newAccessToken);
                    if (typeof originalRequest.headers.set === 'function') {
                        originalRequest.headers.set('Authorization', `Bearer ${newAccessToken}`);
                    } else {
                        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    }
                    return client(originalRequest);
                }
            } catch (refreshErr) {
                processQueue(refreshErr, null);
                return Promise.reject(refreshErr);
            } finally {
                isRefreshing = false;
            }
        }
        return Promise.reject(error);
    }
);

export default client;

