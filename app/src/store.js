import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { api, setToken, loadPersisted, getBaseUrl, getToken } from './api';
import { makeT } from './i18n';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState(null);
  const [lang, setLangState] = useState('ko');
  const [activeCheckin, setActiveCheckin] = useState(null);
  const socketRef = useRef(null);

  const t = useMemo(() => makeT(lang), [lang]);

  const refreshMe = async () => {
    try {
      const { user: u, active_checkin } = await api('/api/auth/me');
      setUser(u);
      setActiveCheckin(active_checkin);
      setLangState(u.language || 'ko');
      return u;
    } catch (e) {
      if (e.code === 'AUTH_INVALID' || e.code === 'AUTH_REQUIRED') {
        await setToken(null);
        setUser(null);
      }
      return null;
    }
  };

  useEffect(() => {
    (async () => {
      const { token } = await loadPersisted();
      if (token) await refreshMe();
      setReady(true);
    })();
  }, []);

  // socket lifecycle
  useEffect(() => {
    if (user && !socketRef.current) {
      const s = io(getBaseUrl(), { auth: { token: getToken() }, transports: ['websocket', 'polling'] });
      socketRef.current = s;
    }
    if (!user && socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    return () => {};
  }, [user]);

  const login = async (email, password) => {
    const { token, user: u } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    await setToken(token);
    setUser(u);
    setLangState(u.language || 'ko');
    await refreshMe();
  };

  const register = async (payload) => {
    const { token, user: u } = await api('/api/auth/register', { method: 'POST', body: payload });
    await setToken(token);
    setUser(u);
    setLangState(u.language || 'ko');
  };

  const logout = async () => {
    await setToken(null);
    setUser(null);
    setActiveCheckin(null);
  };

  const setLang = async (l) => {
    setLangState(l);
    if (user) {
      try {
        const { user: u } = await api('/api/auth/me', { method: 'PATCH', body: { language: l } });
        setUser(u);
      } catch (e) {}
    }
  };

  const value = {
    ready, user, setUser, lang, setLang, t,
    activeCheckin, setActiveCheckin, refreshMe,
    login, register, logout,
    socket: () => socketRef.current,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
