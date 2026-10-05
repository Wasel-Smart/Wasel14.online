const { TextEncoder, TextDecoder } = require('util');
const { URL, URLSearchParams } = require('url');

if (typeof globalThis.TextEncoder === 'undefined') {
  globalThis.TextEncoder = TextEncoder;
}
if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder;
}
if (typeof globalThis.TextDecoder === 'undefined') {
  globalThis.TextDecoder = TextDecoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder;
}
if (typeof globalThis.URL === 'undefined') {
  globalThis.URL = URL;
}
if (typeof global.URL === 'undefined') {
  global.URL = URL;
}
if (typeof globalThis.URLSearchParams === 'undefined') {
  globalThis.URLSearchParams = URLSearchParams;
}
if (typeof global.URLSearchParams === 'undefined') {
  global.URLSearchParams = URLSearchParams;
}

import '@testing-library/react-native/extend-expect';

process.env.EXPO_PUBLIC_API_URL = 'https://api.wasel14.online';

if (typeof globalThis.crypto !== 'undefined' && !globalThis.crypto.randomUUID) {
  try {
    globalThis.crypto.randomUUID = () => {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    };
  } catch (e) {
    globalThis.crypto = {
      ...globalThis.crypto,
      randomUUID: () => {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0;
          const v = c === 'x' ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      },
    };
  }
}

if (typeof globalThis.fetch === 'undefined') {
  const fetchPolyfill = async () => {
    throw new Error('fetch is not defined');
  };
  globalThis.fetch = fetchPolyfill;
  if (typeof global !== 'undefined') {
    global.fetch = fetchPolyfill;
  }
}

jest.mock('react-native-screens', () => ({
  ...jest.requireActual('react-native-screens'),
  enableScreens: jest.fn(),
  enableFreeze: jest.fn(),
}));

jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn().mockResolvedValue(undefined),
  ImpactFeedbackStyle: { Light: 0, Medium: 1, Heavy: 2 },
}));

jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  withScope: jest.fn(callback => callback({
    setTag: jest.fn(),
    setExtra: jest.fn(),
    captureException: jest.fn(),
  })),
}));

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  getPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  requestPermissionsAsync: jest.fn().mockResolvedValue({ status: 'granted' }),
  getExpoPushTokenAsync: jest.fn().mockResolvedValue({ data: 'token-123' }),
  addPushTokenListener: jest.fn().mockReturnValue({ remove: jest.fn() }),
  setNotificationChannelAsync: jest.fn(),
}));

jest.mock('expo-device', () => ({
  isDevice: true,
  getDeviceNameAsync: jest.fn().mockResolvedValue('TestDevice'),
  osName: 'iOS',
  osVersion: '17.0',
}));

jest.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
  FontAwesome: () => null,
  MaterialIcons: () => null,
}));
