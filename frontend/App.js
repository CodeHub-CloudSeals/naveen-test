import React from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { DataProvider } from './src/context/DataContext';
import LoginScreen from './src/screens/LoginScreen';
import PaymentScreen from './src/screens/PaymentScreen';
import SchoolScreen from './src/screens/SchoolScreen';
import DriverScreen from './src/screens/DriverScreen';
import StudentScreen from './src/screens/StudentScreen';

function AppContent() {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingIcon}>🚗</Text>
        <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 16 }} />
        <Text style={styles.loadingText}>Driving School Loading...</Text>
        <Text style={styles.loadingSubText}>Connecting to Firebase...</Text>
      </View>
    );
  }

  if (!user) return <LoginScreen />;

  // School owner must select a subscription plan first
  if (user.key === 'school' && !user.subscriptionPlan) return <PaymentScreen />;

  // schoolId filter: others see their school only
  const schoolId = user.schoolId || undefined;

  return (
    <DataProvider schoolId={schoolId}>
      <AppNavigator user={user} />
    </DataProvider>
  );
}

function AppNavigator({ user }) {
  try {
    if (user.key === 'school')     return <SchoolScreen />;
    if (user.key === 'driver')     return <DriverScreen />;
    if (user.key === 'student')    return <StudentScreen />;
  } catch (e) {
    return (
      <View style={styles.loading}>
        <Text style={{ color: '#fff', fontSize: 16 }}>Screen Error: {e.message}</Text>
      </View>
    );
  }
  return (
    <View style={styles.loading}>
      <Text style={{ color: '#fff', fontSize: 16 }}>Access denied — admin ని contact చేయండి</Text>
    </View>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: '#0f2044', alignItems: 'center', justifyContent: 'center' },
  loadingIcon: { fontSize: 64 },
  loadingText: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: 12 },
  loadingSubText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, marginTop: 6 },
});
