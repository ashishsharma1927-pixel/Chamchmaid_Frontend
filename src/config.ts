import { Platform } from 'react-native';

export const API_URL = Platform.OS === 'web' 
    ? 'http://127.0.0.1:8001' 
    : 'http://192.168.1.8:8001'; 
// Use http://10.0.2.2:8001 for Android Emulator
// Use http://127.0.0.1:8001 for iOS Simulator / Web
// Use your local IP (e.g. http://192.168.1.8:8001) for physical devices

export const WS_URL = API_URL.replace('http', 'ws');
