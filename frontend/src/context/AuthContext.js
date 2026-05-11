import React, { createContext, useState, useContext, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { db } from '../firebase';

const AuthContext = createContext();
const SESSION_KEY = 'driving_school_session';

const saveSession = async (u) => { try { await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(u)); } catch {} };
const loadSession = async () => { try { const s = await AsyncStorage.getItem(SESSION_KEY); return s ? JSON.parse(s) : null; } catch { return null; } };
const clearSession = async () => { try { await AsyncStorage.removeItem(SESSION_KEY); } catch {} };

export const AuthProvider = ({ children }) => {
  const [user, setUser]           = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    loadSession().then(saved => {
      if (saved) setUser(saved);
      setAuthLoading(false);
    });
  }, []);

  // role: 'school' | 'driver' | 'student'
  // identifier: phone number entered by user
  const login = async (phone, role) => {
    try {
      const q = query(
        collection(db, 'driving_school_users'),
        where('phone', '==', phone.trim()),
        where('key', '==', role)
      );
      const snap = await getDocs(q);
      if (snap.empty) throw new Error('not-found');
      const userData = { id: snap.docs[0].id, ...snap.docs[0].data() };

      // Default plan if missing for testing
      if (userData.key === 'school' && !userData.subscriptionPlan) {
        userData.subscriptionPlan = 'trial';
      }

      setUser(userData);
      await saveSession(userData);
      return userData;
    } catch (e) {
      console.error("Login Error:", e);
      throw e;
    }
  };

  const refreshUser = async () => {
    if (!user?.id) return;
    try {
      const snap = await getDoc(doc(db, 'driving_school_users', user.id));
      if (snap.exists()) {
        const updated = { id: snap.id, ...snap.data() };
        setUser(updated);
        saveSession(updated);
      }
    } catch {}
  };

  const loginDirect = (userData) => {
    setUser(userData);
    saveSession(userData);
  };

  const logout = () => {
    setUser(null);
    clearSession();
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, login, loginDirect, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
