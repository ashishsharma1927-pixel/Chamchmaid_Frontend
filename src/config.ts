import { Platform } from 'react-native';

export const API_URL = __DEV__ 
  ? 'http://192.168.1.8:8001'
  : 'https://chamchmaid.onrender.com';

export const WS_URL = API_URL.replace('http', 'ws');
