import { router } from 'expo-router';

/**
 * Safely navigates back if possible, otherwise routes to the provided fallback.
 * Prevents the "GO_BACK was not handled by any navigator" error.
 */
export const safeBack = (fallbackRoute: any = '/') => {
    if (router.canGoBack()) {
        router.back();
    } else {
        router.replace(fallbackRoute);
    }
};
