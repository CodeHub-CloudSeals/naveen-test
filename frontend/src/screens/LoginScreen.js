import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView, StatusBar, TextInput, Alert, ActivityIndicator, ScrollView } from 'react-native';
import { collection, addDoc, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const ROLES = [
  { key: 'school',  icon: '🏫', label: 'School Owner', color: '#2563eb', hint: 'Manage your driving school' },
  { key: 'driver',  icon: '🧑‍🏫', label: 'Instructor',   color: '#10b981', hint: 'Driving instructor / trainer' },
  { key: 'student', icon: '🎓', label: 'Student',      color: '#8b5cf6', hint: 'Taking driving classes' },
];

export default function LoginScreen() {
  const { login, loginDirect } = useAuth();
  const [role, setRole]       = useState(null);
  const [mode, setMode]       = useState('login');
  const [phone, setPhone]     = useState('');
  const [loading, setLoading] = useState(false);
  const [reg, setReg]         = useState({ name: '', phone: '', schoolName: '' });

  const selectedRole = ROLES.find(r => r.key === role);

  const handleLogin = async () => {
    const sanitized = phone.replace(/\D/g, '').slice(-10);
    if (sanitized.length !== 10) {
      Alert.alert('Invalid Phone', 'Please enter a 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      await login(sanitized, role);
    } catch (e) {
      console.error("Login catch block:", e);
      const errMsg = (e && e.message) ? String(e.message) : '';

      if (errMsg === 'not-found') {
        Alert.alert('Login Failed', `No account found for ${sanitized} as ${selectedRole?.label || 'selected role'}.\n\nPlease ensure you selected the correct role and entered the registered phone number.`);
      } else if (errMsg.indexOf('wrong-role:') === 0) {
        const actual = errMsg.split(':')[1];
        const roleName = ROLES.find(r => r.key === actual)?.label || actual;
        Alert.alert('Wrong Role Selected', `This phone number is registered as "${roleName}", not "${selectedRole?.label || 'selected role'}".\n\nPlease go back and select ${roleName} to login.`);
      } else {
        Alert.alert('Login Error', errMsg || 'An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    const sanitizedPhone = reg.phone.replace(/\D/g, '').slice(-10);
    if (!reg.name || sanitizedPhone.length !== 10 || !reg.schoolName) {
      Alert.alert('Error', 'Please fill all fields (Phone must be 10 digits)'); return;
    }
    const existing = await getDocs(query(collection(db, 'driving_school_users'), where('phone', '==', sanitizedPhone), where('key', '==', 'school')));
    if (!existing.empty) {
      Alert.alert('Already Exists', 'Account already exists with this phone. Please login instead.'); return;
    }
    setLoading(true);
    try {
      const schoolId = 'SC-' + Date.now().toString(36).toUpperCase().slice(-6);
      const docRef = await addDoc(collection(db, 'driving_school_users'), {
        key: 'school',
        name: reg.name.trim(),
        phone: sanitizedPhone,
        schoolName: reg.schoolName.trim(),
        schoolId,
        subscriptionPlan: null,
      });
      loginDirect({ id: docRef.id, key: 'school', name: reg.name.trim(), phone: sanitizedPhone, schoolName: reg.schoolName.trim(), schoolId, subscriptionPlan: null });
    } catch (e) {
      Alert.alert('Error', 'Registration failed: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => { setRole(null); setPhone(''); setMode('login'); setReg({ name: '', phone: '', schoolName: '' }); };

  return (
    <View style={s.bg}>
      <StatusBar barStyle="light-content" />
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={s.logo}>
            <Text style={s.logoIcon}>🚗</Text>
            <Text style={s.logoName}>Driving School</Text>
            <Text style={s.logoSub}>
              {!role ? 'Who are you? Please select' : mode === 'register' ? 'Register your school' : 'Enter your phone number'}
            </Text>
          </View>

          {!role ? (
            <View style={s.roles}>
              {ROLES.map(r => (
                <TouchableOpacity key={r.key} style={[s.roleCard, { borderColor: r.color }]} onPress={() => setRole(r.key)}>
                  <Text style={s.roleIcon}>{r.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.roleLabel, { color: r.color }]}>{r.label}</Text>
                    <Text style={s.roleHint}>{r.hint}</Text>
                  </View>
                  <Text style={{ color: r.color, fontSize: 20 }}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : mode === 'register' ? (
            <View style={s.form}>
              <View style={[s.roleTag, { backgroundColor: '#2563eb22', borderColor: '#2563eb' }]}>
                <Text style={{ fontSize: 16 }}>🏫</Text>
                <Text style={[s.roleTagT, { color: '#2563eb' }]}>Register New School</Text>
              </View>

              {[['name', 'Your Name (Owner) *', 'default'], ['phone', 'Phone Number * (Used for login)', 'numeric'], ['schoolName', 'School Name *', 'default']].map(([k, ph, kb]) => (
                <View key={k} style={{ marginBottom: 12 }}>
                  <Text style={s.lbl}>{ph}</Text>
                  <TextInput
                    style={s.inp}
                    placeholder={ph}
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={reg[k]}
                    onChangeText={v => setReg({ ...reg, [k]: v })}
                    keyboardType={kb}
                    maxLength={k === 'phone' ? 10 : undefined}
                  />
                </View>
              ))}

              <TouchableOpacity style={[s.btn, { backgroundColor: '#2563eb' }, loading && { opacity: 0.7 }]} onPress={handleRegister} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>✅ Register & Login</Text>}
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setMode('login')} style={s.back}>
                <Text style={s.backT}>Already have an account? Login</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={goBack} style={s.back}>
                <Text style={s.backT}>← Go Back</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={s.form}>
              <View style={[s.roleTag, { backgroundColor: selectedRole.color + '22', borderColor: selectedRole.color }]}>
                <Text style={{ fontSize: 16 }}>{selectedRole.icon}</Text>
                <Text style={[s.roleTagT, { color: selectedRole.color }]}>{selectedRole.label} Login</Text>
              </View>

              <Text style={s.lbl}>Phone Number</Text>
              <TextInput
                style={s.inp}
                placeholder="10-digit phone number"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={phone}
                onChangeText={setPhone}
                keyboardType="numeric"
                maxLength={10}
              />

              <TouchableOpacity style={[s.btn, { backgroundColor: selectedRole.color }, loading && { opacity: 0.7 }]} onPress={handleLogin} disabled={loading}>
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={s.btnT}>Login →</Text>}
              </TouchableOpacity>

              {role === 'school' && (
                <TouchableOpacity onPress={() => setMode('register')} style={s.back}>
                  <Text style={[s.backT, { color: '#60a5fa' }]}>+ Register New School</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={goBack} style={s.back}>
                <Text style={s.backT}>← Go Back</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  bg:       { flex: 1, backgroundColor: '#0f2044' },
  safe:     { flex: 1 },
  scroll:   { padding: 24, justifyContent: 'center', flexGrow: 1 },
  logo:     { alignItems: 'center', marginBottom: 36 },
  logoIcon: { fontSize: 56 },
  logoName: { fontSize: 32, fontWeight: '900', color: '#fff', marginTop: 8, letterSpacing: -0.5 },
  logoSub:  { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 4 },
  roles:    { gap: 12 },
  roleCard: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1.5 },
  roleIcon: { fontSize: 28 },
  roleLabel:{ fontSize: 17, fontWeight: '900' },
  roleHint: { fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 2 },
  form:     { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  roleTag:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 99, alignSelf: 'flex-start', borderWidth: 1, marginBottom: 14 },
  roleTagT: { fontSize: 13, fontWeight: '800' },
  lbl:      { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  inp:      { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 14, fontSize: 16, color: '#fff', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', letterSpacing: 1 },
  btn:      { borderRadius: 14, padding: 16, alignItems: 'center', marginTop: 20 },
  btnT:     { color: '#fff', fontSize: 16, fontWeight: '900' },
  back:     { alignItems: 'center', marginTop: 14 },
  backT:    { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
});
