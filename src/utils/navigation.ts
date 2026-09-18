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

/**
 * Resets navigation stack and enters authenticated tabs.
 * Dismisses any modal/auth screens so pressing back will never return to login/landing.
 */
export const resetToApp = () => {
    try {
        if (router.canDismiss()) {
            router.dismissAll();
        }
    } catch (e) {}
    
    setTimeout(() => {
        router.replace('/(tabs)');
    }, 10);
};

/**
 * Resets navigation stack and returns to login screen.
 * Dismisses any modal/tab/profile screens so pressing back will never return to authenticated screens.
 */
export const resetToAuth = () => {
    try {
        if (router.canDismiss()) {
            router.dismissAll();
        }
    } catch (e) {}
    
    setTimeout(() => {
        router.replace('/login');
    }, 10);
};
