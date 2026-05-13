import React, { createContext, useState, useContext, useEffect } from 'react';
import { collection, query, where, getDocs, getDoc, doc, updateDoc } from 'firebase/firestore';
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
    if (!phone || typeof phone !== 'string') throw new Error('Invalid phone input');
    const trimmedPhone = phone.replace(/\D/g, '').slice(-10);

    // Check if Firebase functions exist
    if (typeof collection !== 'function') throw new Error('Firebase collection is not a function');
    if (typeof query !== 'function') throw new Error('Firebase query is not a function');
    if (typeof getDocs !== 'function') throw new Error('Firebase getDocs is not a function');
    if (!db) throw new Error('Database not initialized');

    try {
      const q = query(
        collection(db, 'driving_school_users'),
        where('phone', '==', trimmedPhone),
        where('key', '==', role)
      );
      const snap = await getDocs(q);

      if (snap.empty) {
        // Diagnostic check: find ANY role for this phone
        const qAny = query(collection(db, 'driving_school_users'), where('phone', '==', trimmedPhone));
        const snapAny = await getDocs(qAny);
        if (!snapAny.empty) {
          const actualRole = snapAny.docs[0].data().key;
          throw new Error(`wrong-role:${actualRole}`);
        }
        throw new Error('not-found');
      }

      const firstDoc = snap.docs[0];
      if (!firstDoc || typeof firstDoc.data !== 'function') throw new Error('Invalid document data function');

      const userData = { id: firstDoc.id, ...firstDoc.data() };

      // Default plan if missing for testing
      if (userData.key === 'school' && !userData.subscriptionPlan) {
        userData.subscriptionPlan = 'trial';
      }

      setUser(userData);

      // Safe save session
      try {
        if (AsyncStorage && typeof AsyncStorage.setItem === 'function') {
          await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(userData));
        }
      } catch (err) {
        console.warn("AsyncStorage Error:", err);
      }

      return userData;
    } catch (e) {
      console.error("Detailed Login Error:", e);
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

  // Update a field on the logged-in user's document (used for settings like UPI ID)
  const updateUserProfile = async (patch) => {
    if (!user?.id) throw new Error('Not logged in');
    await updateDoc(doc(db, 'driving_school_users', user.id), patch);
    const updated = { ...user, ...patch };
    setUser(updated);
    saveSession(updated);
    return updated;
  };

  return (
    <AuthContext.Provider value={{ user, authLoading, login, loginDirect, logout, refreshUser, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
