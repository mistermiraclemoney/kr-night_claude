import AsyncStorage from '@react-native-async-storage/async-storage';

// 배포 후 Railway 주소로 교체하세요. 예: https://krnight-production.up.railway.app
// 앱 첫 화면에서도 변경 가능합니다.
export const DEFAULT_API_URL = 'http://localhost:8080';

let baseUrl = DEFAULT_API_URL;
let authToken = null;

export const setBaseUrl = async (url) => {
  baseUrl = url.replace(/\/$/, '');
  await AsyncStorage.setItem('krnight_api_url', baseUrl);
};
export const getBaseUrl = () => baseUrl;

export const loadPersisted = async () => {
  const [url, token] = await Promise.all([
    AsyncStorage.getItem('krnight_api_url'),
    AsyncStorage.getItem('krnight_token'),
  ]);
  if (url) baseUrl = url;
  if (token) authToken = token;
  return { url: baseUrl, token: authToken };
};

export const setToken = async (token) => {
  authToken = token;
  if (token) await AsyncStorage.setItem('krnight_token', token);
  else await AsyncStorage.removeItem('krnight_token');
};
export const getToken = () => authToken;

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(baseUrl + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* empty */ }
  if (!res.ok) {
    const err = new Error((data && data.error) || `HTTP_${res.status}`);
    err.code = data && data.error;
    err.data = data;
    throw err;
  }
  return data;
}
