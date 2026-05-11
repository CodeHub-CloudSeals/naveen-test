import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const COLORS = ['#2563eb', '#10b981', '#f97316', '#8b5cf6', '#ec4899'];

export default function SuperAdminScreen() {
  const { logout, user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [students, setStudents] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubSchools = onSnapshot(
      query(collection(db, 'driving_school_users'), where('key', '==', 'school')),
      snap => { setSchools(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false)
    );
    const unsubStudents = onSnapshot(
      collection(db, 'driving_school_students'),
      snap => setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    const unsubInstructors = onSnapshot(
      query(collection(db, 'driving_school_users'), where('key', '==', 'driver')),
      snap => setInstructors(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      () => {}
    );
    return () => { unsubSchools(); unsubStudents(); unsubInstructors(); };
  }, []);

  const totalRevenue = students.reduce((a, s) => a + (s.paid || 0), 0);
  const totalPending = students.reduce((a, s) => a + Math.max(0, (s.tot || 0) - (s.paid || 0)), 0);

  const schoolStudentCount = (sid) => students.filter(s => s.schoolId === sid).length;
  const schoolInstructorCount = (sid) => instructors.filter(i => i.schoolId === sid).length;
  const schoolRevenue = (sid) => students.filter(s => s.schoolId === sid).reduce((a, s) => a + (s.paid || 0), 0);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={styles.avatar}><Text style={styles.avatarText}>👑</Text></View>
            <View style={{ marginLeft: 10 }}>
              <Text style={styles.userName}>{user?.name || user?.email}</Text>
              <Text style={styles.userRole}>Platform Owner</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.badge}><Text style={styles.badgeText}>👑 Super Admin — Full Access</Text></View>
        <View style={styles.statsGrid}>
          {[[schools.length, 'Schools'], [students.length, 'Students'], ['₹' + (totalRevenue / 1000).toFixed(1) + 'K', 'Revenue'], [instructors.length, 'Instructors']].map(([v, l]) => (
            <View key={l} style={styles.statCard}>
              <Text style={styles.statVal}>{v}</Text>
              <Text style={styles.statLbl}>{l}</Text>
            </View>
          ))}
        </View>
      </View>

      <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator size="large" color="#2563eb" style={{ marginTop: 40 }} />
        ) : (
          <>
            <Text style={styles.sec}>🏫 All Schools</Text>
            {schools.length === 0 ? (
              <View style={styles.card}><Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No schools yet</Text></View>
            ) : schools.map((sc, i) => {
              const color = COLORS[i % COLORS.length];
              const sid = sc.schoolId || sc.id;
              const sCount = schoolStudentCount(sid);
              const iCount = schoolInstructorCount(sid);
              const rev = schoolRevenue(sid);
              return (
                <View key={sc.id} style={[styles.schoolCard, { borderLeftColor: color }]}>
                  <Text style={styles.schoolName}>{sc.schoolName || sc.name || sc.email}</Text>
                  <Text style={styles.schoolMeta}>👤 {sc.name || sc.email}{sc.subscriptionPlan ? ` · ${sc.subscriptionPlan}` : ''}</Text>
                  {sid && (
                    <View style={[styles.codeTag, { backgroundColor: color + '20' }]}>
                      <Text style={[styles.codeText, { color }]}>{sid}</Text>
                    </View>
                  )}
                  <View style={styles.schoolStats}>
                    {[[sCount, 'Students'], [iCount, 'Instructors'], ['₹' + rev.toLocaleString(), 'Revenue'], [sc.subscriptionPlan || 'None', 'Plan']].map(([v, l]) => (
                      <View key={l} style={styles.schoolStat}>
                        <Text style={styles.schoolStatV}>{v}</Text>
                        <Text style={styles.schoolStatL}>{l}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              );
            })}

            <Text style={styles.sec}>💰 Platform Revenue</Text>
            <View style={styles.card}>
              {[['Total Collected', '₹' + totalRevenue.toLocaleString(), '#10b981'], ['Pending Fees', '₹' + totalPending.toLocaleString(), '#ef4444'], ['Active Schools', schools.length, '#0f172a'], ['Total Students', students.length, '#0f172a']].map(([l, v, c]) => (
                <View key={l} style={styles.infoRow}>
                  <Text style={styles.infoLbl}>{l}</Text>
                  <Text style={[styles.infoVal, { color: c }]}>{v}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  header: { backgroundColor: '#0f2044', padding: 20, paddingTop: 50 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  avatar: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 19 },
  userName: { fontSize: 15, fontWeight: '900', color: '#fff' },
  userRole: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  logoutBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 11 },
  logoutText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badge: { backgroundColor: 'rgba(251,191,36,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, alignSelf: 'flex-start', marginTop: 10 },
  badgeText: { color: '#fbbf24', fontSize: 10, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
  statCard: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.11)', borderRadius: 14, padding: 11 },
  statVal: { fontSize: 20, fontWeight: '900', color: '#fff' },
  statLbl: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  body: { padding: 14 },
  sec: { fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 7 },
  schoolCard: { backgroundColor: '#fff', borderRadius: 17, padding: 13, marginBottom: 9, borderLeftWidth: 4, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  schoolName: { fontSize: 14, fontWeight: '800' },
  schoolMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  codeTag: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 99, alignSelf: 'flex-start', marginTop: 5 },
  codeText: { fontSize: 11, fontWeight: '800' },
  schoolStats: { flexDirection: 'row', gap: 14, marginTop: 9 },
  schoolStat: { alignItems: 'center' },
  schoolStatV: { fontSize: 16, fontWeight: '900', color: '#0f2044' },
  schoolStatL: { fontSize: 10, color: '#94a3b8' },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  infoLbl: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  infoVal: { fontSize: 13, fontWeight: '700' },
});
