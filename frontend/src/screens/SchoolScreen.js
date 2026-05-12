import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, ActivityIndicator } from 'react-native';
import { collection, addDoc, onSnapshot, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import FaceScanModal from '../components/FaceScanModal';

const TC = 26;
const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function SchoolScreen() {
  const { logout, user } = useAuth();
  const { students, payments = [], markClass, collectPayment, deleteStudent, addStudent } = useData();
  const [tab, setTab] = useState('home');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [admTypeFilter, setAdmTypeFilter] = useState('all');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [payModal, setPayModal] = useState(null);
  const [payAmt, setPayAmt] = useState('');
  const [form, setForm] = useState({ name: '', rel: '', phone: '', dob: '', gender: 'M', cardNo: '', addr: '', adm: '', slot: '6:00 AM', veh: 'Car (LMV)', ll: '', lle: '', dl: '', test: '', tot: '', paid: '', admType: 'both' });
  const [faceDesc, setFaceDesc] = useState(null);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [showFaceScan, setShowFaceScan] = useState(false);
  const [drivers, setDrivers] = useState([]);
  const [driverForm, setDriverForm] = useState({ name: '', phone: '', email: '' });
  const [addingDriver, setAddingDriver] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);

  useEffect(() => {
    if (!user?.schoolId) return;
    const q = query(collection(db, 'driving_school_users'), where('schoolId', '==', user.schoolId), where('key', '==', 'driver'));
    const unsub = onSnapshot(q, snap => setDrivers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [user?.schoolId]);

  const tot = students.reduce((a, s) => a + (s.tot || 0), 0);
  const col = students.reduce((a, s) => a + (s.paid || 0), 0);
  const pen = tot - col;

  let filtered = students.filter(s => s.name?.toLowerCase().includes(search.toLowerCase()) || s.phone?.includes(search));
  if (filter === 'balance') filtered = filtered.filter(s => s.paid < s.tot);
  if (filter === 'complete') filtered = filtered.filter(s => s.cls >= TC);
  if (admTypeFilter !== 'all') {
    filtered = filtered.filter(s => s.admType === admTypeFilter || (!s.admType && admTypeFilter === 'both'));
  }

  const handleAdd = async () => {
    if (addingStudent) return; // prevent double-submit
    if (!form.name || !form.phone || !form.adm || !form.tot) {
      Alert.alert('Error', 'Fill: Name, Phone, Admission, Total Fee'); return;
    }
    if (!faceDesc) { Alert.alert('Face Required', 'Please capture student face (press 📷 Capture Face)'); return; }

    const phone = form.phone.replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) { Alert.alert('Invalid Phone', 'Phone must be 10 digits'); return; }

    // Duplicate check — same phone already exists in this school?
    const dup = students.find(st => (st.phone || '').replace(/\D/g, '').slice(-10) === phone);
    if (dup) {
      Alert.alert('Duplicate Student', `A student with phone ${phone} already exists: ${dup.name}`);
      return;
    }

    setAddingStudent(true);
    try {
      // Active student check passed (students list filters out soft-deleted).
      // Clean up any orphan login records left over from previously-deleted students
      // with the same phone — so the phone can be re-used.
      const existing = await getDocs(query(
        collection(db, 'driving_school_users'),
        where('phone', '==', phone),
        where('schoolId', '==', user?.schoolId),
        where('key', '==', 'student')
      ));
      for (const d of existing.docs) {
        await deleteDoc(doc(db, 'driving_school_users', d.id));
      }

      await addDoc(collection(db, 'driving_school_users'), {
        name: form.name, phone,
        key: 'student', schoolId: user?.schoolId, schoolName: user?.schoolName,
      });
      await addStudent({ ...form, phone, tot: parseInt(form.tot) || 0, paid: parseInt(form.paid) || 0, faceDescriptor: faceDesc, schoolId: user?.schoolId });
      Alert.alert('Success ✅', `${form.name} registered!\nLogin phone: ${phone}`);
      setForm({ name: '', rel: '', phone: '', dob: '', gender: 'M', cardNo: '', addr: '', adm: '', slot: '6:00 AM', veh: 'Car (LMV)', ll: '', lle: '', dl: '', test: '', tot: '', paid: '', admType: 'both' });
      setFaceDesc(null);
      setTab('students');
    } catch (e) {
      Alert.alert('Error', 'Failed to add student: ' + e.message);
    } finally {
      setAddingStudent(false);
    }
  };

  const handleFaceScanMatch = (student) => {
    markClass(student.id);
    setShowFaceScan(false);
    Alert.alert('Attendance Marked! ✅', `${student.name}\nClass ${student.cls + 1} / 26 marked`);
  };

  const handleAddDriver = async () => {
    if (!driverForm.name || !driverForm.phone) {
      Alert.alert('Error', 'Please enter Name and Phone'); return;
    }
    setAddingDriver(true);
    try {
      await addDoc(collection(db, 'driving_school_users'), {
        name: driverForm.name, phone: driverForm.phone.trim(),
        email: driverForm.email?.trim().toLowerCase() || '',
        key: 'driver', schoolId: user?.schoolId, schoolName: user?.schoolName,
      });
      Alert.alert('Instructor Added! ✅', `${driverForm.name} added.\nLogin phone: ${driverForm.phone}`);
      setDriverForm({ name: '', phone: '', email: '' });
    } catch { Alert.alert('Error', 'Failed to add instructor'); }
    finally { setAddingDriver(false); }
  };

  const TABS = [['home', '🏠', 'Home'], ['scan', '📷', 'Scan'], ['students', '👥', 'Students'], ['licenses', '🪪', 'Licenses'], ['revenue', '💰', 'Revenue'], ['staff', '🧑‍🏫', 'Staff'], ['add', '➕', 'Add']];

  // Revenue calculations
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const thisMonthPayments = payments.filter(p => p.collectedAt && p.collectedAt >= monthStart);
  const monthCollected = thisMonthPayments.reduce((a, p) => a + (p.amount || 0), 0);
  const monthPending = pen; // pen calculated above = total outstanding across all students
  const clearedStudents = students.filter(st => (st.paid || 0) >= (st.tot || 0) && (st.tot || 0) > 0);
  const pendingStudents = students.filter(st => (st.paid || 0) < (st.tot || 0));
  const recentPayments = [...payments].sort((a, b) => (b.collectedAt || '').localeCompare(a.collectedAt || '')).slice(0, 15);

  const llrStudents = students.filter(st => st.ll && st.ll.trim() !== '');
  const dlStudents = students.filter(st => st.dl && st.dl.trim() !== '');

  return (
    <View style={s.container}>
      {/* HEADER */}
      <View style={s.hdr}>
        <View style={s.hdrRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={s.av}><Text style={{ fontSize: 19 }}>🏫</Text></View>
            <View style={{ marginLeft: 10 }}>
              <Text style={s.un}>{user?.name || user?.email}</Text>
              <Text style={s.ur}>{user?.schoolName || user?.email}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.lout} onPress={logout}><Text style={s.loutT}>Logout</Text></TouchableOpacity>
        </View>
        <View style={s.badge}><Text style={s.badgeT}>🏫 School Owner{user?.schoolId ? ` — ${user.schoolId}` : ''}</Text></View>
        <View style={s.statsGrid}>
          {[[students.length, 'Students'], [drivers.length, 'Instructors'], ['₹' + col.toLocaleString(), 'Collected'], ['₹' + pen.toLocaleString(), 'Pending']].map(([v, l]) => (
            <View key={l} style={s.stat}><Text style={s.statV}>{v}</Text><Text style={s.statL}>{l}</Text></View>
          ))}
        </View>
      </View>

      {/* CONTENT */}
      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* HOME */}
        {tab === 'home' && (
          <View>
            <Text style={s.sec}>📅 Today's Classes</Text>
            {students.length === 0 ? (
              <View style={s.card}><Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No students yet. Register in the Add tab.</Text></View>
            ) : (
              <View style={s.card}>
                {[...students].sort((a, b) => a.slot?.localeCompare(b.slot)).map(st => (
                  <View key={st.id} style={s.slotRow}>
                    <View style={s.slotB}><Text style={s.slotBT}>{st.slot}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.slotName}>{st.name}</Text>
                      <Text style={s.slotSub}>{st.veh} · {st.cls}/{TC} classes</Text>
                    </View>
                    {!st.faceDescriptor && <Text style={{ fontSize: 10, color: '#f97316' }}>No face</Text>}
                  </View>
                ))}
              </View>
            )}
            <Text style={s.sec}>⚠️ Alerts</Text>
            {students.filter(st => st.paid < st.tot).map(st => (
              <View key={st.id} style={s.alertBox}>
                <Text style={{ fontSize: 18 }}>💸</Text>
                <View><Text style={s.alertTitle}>{st.name}</Text><Text style={s.alertMsg}>₹{(st.tot - st.paid).toLocaleString()} balance pending</Text></View>
              </View>
            ))}
            {students.filter(st => st.paid < st.tot).length === 0 && (
              <View style={[s.card, { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' }]}>
                <Text style={{ color: '#16a34a', fontWeight: '700', textAlign: 'center' }}>✅ All fees cleared!</Text>
              </View>
            )}
          </View>
        )}

        {/* FACE SCAN TAB */}
        {tab === 'scan' && (
          <View>
            <Text style={s.sec}>📷 Face Scan Attendance</Text>
            <TouchableOpacity style={s.scanBig} onPress={() => setShowFaceScan(true)}>
              <Text style={{ fontSize: 50, marginBottom: 12 }}>📷</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Open Camera — Face Scan</Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 6 }}>Show student face to view their details</Text>
            </TouchableOpacity>

            <Text style={s.sec}>✅ Today's Attendance Summary</Text>
            <View style={s.card}>
              {students.map(st => (
                <View key={st.id} style={s.slotRow}>
                  <View style={[s.la, { backgroundColor: st.faceDescriptor ? '#0f2044' : '#cbd5e1' }]}>
                    <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{st.name?.[0] || '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.slotName}>{st.name}</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>Classes: {st.cls}/{TC}</Text>
                      {!st.faceDescriptor && <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99 }}><Text style={{ fontSize: 9, color: '#ea580c', fontWeight: '700' }}>No Face</Text></View>}
                    </View>
                  </View>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: st.cls >= TC ? '#10b981' : '#2563eb' }}>{st.cls}/{TC}</Text>
                </View>
              ))}
              {students.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No students</Text>}
            </View>

            {students.filter(s => !s.faceDescriptor).length > 0 && (
              <View style={[s.card, { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' }]}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#c2410c', marginBottom: 8 }}>⚠️ Students without face registered:</Text>
                {students.filter(s => !s.faceDescriptor).map(st => (
                  <Text key={st.id} style={{ fontSize: 12, color: '#9a3412', marginBottom: 4 }}>• {st.name} — Capture face in the Add tab</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* STUDENTS */}
        {tab === 'students' && (
          <View>
            <View style={s.searchWrap}>
              <Text style={s.searchIcon}>🔍</Text>
              <TextInput style={s.searchInput} placeholder="Search student..." value={search} onChangeText={setSearch} />
            </View>
            <View style={s.chips}>
              {[['all', 'All'], ['balance', 'Balance Due'], ['complete', 'Done']].map(([f, l]) => (
                <TouchableOpacity key={f} style={[s.chip, filter === f && s.chipActive]} onPress={() => setFilter(f)}>
                  <Text style={[s.chipT, filter === f && s.chipActiveT]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={s.chips}>
              {[['all', 'All Types'], ['driving', 'Driving Only'], ['license', 'License Only'], ['both', 'Both']].map(([f, l]) => {
                const count = students.filter(s => f === 'all' || s.admType === f || (!s.admType && f === 'both')).length;
                return (
                  <TouchableOpacity key={f} style={[s.chip, admTypeFilter === f && s.chipActive]} onPress={() => setAdmTypeFilter(f)}>
                    <Text style={[s.chipT, admTypeFilter === f && s.chipActiveT]}>{l} ({count})</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {filtered.map(st => {
              const b = st.tot - st.paid, pct = Math.round(st.cls / TC * 100);
              return (
                <View key={st.id} style={[s.stCard, b > 0 ? s.warn : st.cls >= TC ? s.done : {}]}>
                  <View style={s.stRow}>
                    <View>
                      <Text style={s.stName}>{st.name} <Text style={s.stNo}>#{st.cardNo}</Text></Text>
                      <Text style={s.stMeta}>📱 {st.phone} · {st.veh}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      {b > 0 ? <View style={s.tagR}><Text style={s.tagRT}>₹{b.toLocaleString()} due</Text></View>
                        : <View style={s.tagG}><Text style={s.tagGT}>Paid ✓</Text></View>}
                      {st.cls >= TC && <View style={s.tagB}><Text style={s.tagBT}>Done</Text></View>}
                      {!st.faceDescriptor && <View style={{ backgroundColor: '#fff7ed', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99, marginTop: 3 }}><Text style={{ fontSize: 9, color: '#ea580c', fontWeight: '700' }}>No Face</Text></View>}
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                    <Text style={{ fontSize: 11, color: '#64748b', fontWeight: '700' }}>Classes Taken: {st.cls}/{TC}</Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8' }}>{pct}%</Text>
                  </View>
                  <View style={s.pb}><View style={[s.pf, { width: pct + '%' }]} /></View>
                  <View style={s.btnRow}>
                    <TouchableOpacity style={s.btnG} onPress={() => markClass(st.id)}><Text style={s.btnT}>✅ +1</Text></TouchableOpacity>
                    <TouchableOpacity style={s.btnO} onPress={() => { setPayModal(st); setPayAmt(''); }}><Text style={s.btnT}>💰 Pay</Text></TouchableOpacity>
                    <TouchableOpacity style={s.btnB} onPress={() => setSelectedStudent(st)}><Text style={s.btnT}>👁 View</Text></TouchableOpacity>
                  </View>
                </View>
              );
            })}
            {filtered.length === 0 && <View style={s.card}><Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No students found</Text></View>}
          </View>
        )}

        {/* LICENSES */}
        {tab === 'licenses' && (
          <View>
            <View style={s.statsGrid}>
              <View style={s.stat}><Text style={s.statV}>{llrStudents.length}</Text><Text style={s.statL}>LLR Issued</Text></View>
              <View style={s.stat}><Text style={s.statV}>{dlStudents.length}</Text><Text style={s.statL}>DL Issued</Text></View>
            </View>

            <Text style={s.sec}>📝 LLR Issued List</Text>
            <View style={s.card}>
              {llrStudents.map(st => (
                <View key={st.id} style={s.slotRow}>
                  <View style={s.la}><Text style={{ color: '#fff', fontWeight: '900' }}>{st.name?.[0] || '?'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.slotName}>{st.name}</Text>
                    <Text style={s.slotSub}>📱 {st.phone}</Text>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#0f172a' }}>LL No: {st.ll}</Text>
                      <Text style={{ fontSize: 11, color: '#ef4444' }}>Exp: {st.lle || '—'}</Text>
                    </View>
                  </View>
                </View>
              ))}
              {llrStudents.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 10 }}>No LLRs issued yet</Text>}
            </View>

            <Text style={s.sec}>🪪 Driving License (DL) List</Text>
            <View style={s.card}>
              {dlStudents.map(st => (
                <View key={st.id} style={s.slotRow}>
                  <View style={[s.la, { backgroundColor: '#10b981' }]}><Text style={{ color: '#fff', fontWeight: '900' }}>{st.name?.[0] || '?'}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.slotName}>{st.name}</Text>
                    <Text style={s.slotSub}>📱 {st.phone}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: '#0f172a', marginTop: 4 }}>DL No: {st.dl}</Text>
                  </View>
                </View>
              ))}
              {dlStudents.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 10 }}>No DLs issued yet</Text>}
            </View>
          </View>
        )}

        {/* REVENUE */}
        {tab === 'revenue' && (
          <View>
            {/* This month summary */}
            <Text style={s.sec}>📅 This Month ({now.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })})</Text>
            <View style={{ flexDirection: 'row', gap: 9, marginBottom: 10 }}>
              <View style={[s.card, { flex: 1, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#10b981' }]}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#10b981' }}>₹{monthCollected.toLocaleString()}</Text>
                <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>COLLECTED THIS MONTH</Text>
              </View>
              <View style={[s.card, { flex: 1, alignItems: 'center', borderLeftWidth: 4, borderLeftColor: monthPending > 0 ? '#ef4444' : '#10b981' }]}>
                <Text style={{ fontSize: 20, fontWeight: '900', color: monthPending > 0 ? '#ef4444' : '#10b981' }}>₹{monthPending.toLocaleString()}</Text>
                <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>STILL PENDING</Text>
              </View>
            </View>

            {/* Overall summary */}
            <Text style={s.sec}>💰 Overall Summary</Text>
            <View style={s.card}>
              {[['Total Fees', '₹' + tot.toLocaleString(), '#0f172a'], ['Collected (All-time)', '₹' + col.toLocaleString(), '#10b981'], ['Pending', '₹' + pen.toLocaleString(), pen > 0 ? '#ef4444' : '#10b981']].map(([l, v, c]) => (
                <View key={l} style={s.ir}><Text style={s.il}>{l}</Text><Text style={[s.iv, { color: c }]}>{v}</Text></View>
              ))}
            </View>

            {/* Cleared students */}
            <Text style={s.sec}>✅ Cleared ({clearedStudents.length})</Text>
            {clearedStudents.length === 0 ? (
              <View style={s.card}><Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 12 }}>No students cleared yet</Text></View>
            ) : (
              clearedStudents.map(st => (
                <View key={st.id} style={[s.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#10b981' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800' }}>{st.name}</Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>📱 {st.phone}</Text>
                  </View>
                  <Text style={{ fontSize: 14, fontWeight: '900', color: '#10b981' }}>₹{(st.tot || 0).toLocaleString()} ✓</Text>
                </View>
              ))
            )}

            {/* Pending students */}
            <Text style={s.sec}>🔴 Pending ({pendingStudents.length})</Text>
            {pendingStudents.length === 0 ? (
              <View style={[s.card, { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' }]}>
                <Text style={{ color: '#16a34a', fontWeight: '700', textAlign: 'center' }}>✅ All fees cleared!</Text>
              </View>
            ) : (
              pendingStudents.map(st => (
                <View key={st.id} style={[s.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: '#ef4444' }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800' }}>{st.name}</Text>
                    <Text style={{ fontSize: 11, color: '#94a3b8' }}>📱 {st.phone}</Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>Paid: ₹{(st.paid || 0).toLocaleString()} / ₹{(st.tot || 0).toLocaleString()}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#ef4444' }}>₹{((st.tot || 0) - (st.paid || 0)).toLocaleString()}</Text>
                    <TouchableOpacity style={[s.btnG, { marginTop: 5 }]} onPress={() => { setPayModal(st); setPayAmt(''); }}><Text style={s.btnT}>💰 Collect</Text></TouchableOpacity>
                  </View>
                </View>
              ))
            )}

            {/* Recent payment history */}
            <Text style={s.sec}>📋 Recent Payments (Who Collected)</Text>
            {recentPayments.length === 0 ? (
              <View style={s.card}><Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 12 }}>No payments recorded yet</Text></View>
            ) : (
              <View style={s.card}>
                {recentPayments.map(p => (
                  <View key={p.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700' }}>{p.studentName} {p.cleared && <Text style={{ color: '#10b981', fontSize: 11 }}>✓ cleared</Text>}</Text>
                      <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>
                        by {p.collectorName}{p.collectorRole ? ` (${p.collectorRole})` : ''}
                      </Text>
                      <Text style={{ fontSize: 10, color: '#94a3b8', marginTop: 1 }}>
                        {p.collectedAt ? new Date(p.collectedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                      </Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#10b981' }}>+₹{(p.amount || 0).toLocaleString()}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {/* STAFF */}
        {tab === 'staff' && (
          <View>
            <Text style={s.sec}>🧑‍🏫 Instructors ({drivers.length})</Text>
            {drivers.map(d => (
              <View key={d.id} style={[s.card, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}>
                <View style={s.la}>
                  <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13 }}>{d.name?.[0] || '?'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800' }}>{d.name}</Text>
                  <Text style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>📧 {d.email}</Text>
                  {d.phone ? <Text style={{ fontSize: 11, color: '#94a3b8' }}>📱 {d.phone}</Text> : null}
                </View>
              </View>
            ))}
            {drivers.length === 0 && (
              <View style={s.card}><Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No instructors yet. Add below.</Text></View>
            )}
            <Text style={s.sec}>➕ Add Instructor</Text>
            <View style={s.card}>
              {[['name', 'Full Name *', 'default'], ['phone', 'Phone * (Used for login)', 'numeric'], ['email', 'Email (optional)', 'email-address']].map(([k, ph, kb]) => (
                <View key={k} style={s.fld}>
                  <Text style={s.flbl}>{ph}</Text>
                  <TextInput style={s.finp} placeholder={ph} keyboardType={kb} autoCapitalize="none" value={driverForm[k]} onChangeText={v => setDriverForm({ ...driverForm, [k]: v })} />
                </View>
              ))}
              <TouchableOpacity style={[s.btnFull, addingDriver && { opacity: 0.7 }]} onPress={handleAddDriver} disabled={addingDriver}>
                {addingDriver ? <ActivityIndicator color="#fff" /> : <Text style={s.btnFullT}>✅ Add Instructor</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ADD */}
        {tab === 'add' && (
          <View>
            <View style={s.ibanner}><Text style={{ color: '#1d4ed8', fontSize: 12 }}>📋 Student Card — {TC} Classes / 45 Days</Text></View>

            {/* Face Capture Section */}
            <View style={s.faceSection}>
              <Text style={s.flbl}>Student Face Photo *</Text>
              {faceDesc ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  <Text style={{ fontSize: 40 }}>✅</Text>
                  <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 14, marginTop: 6 }}>Face Registered!</Text>
                  <TouchableOpacity onPress={() => setFaceDesc(null)} style={{ marginTop: 8 }}>
                    <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: '700' }}>Retake</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.faceBtn} onPress={() => setShowFaceCapture(true)}>
                  <Text style={{ fontSize: 36 }}>📷</Text>
                  <Text style={{ color: '#2563eb', fontWeight: '800', marginTop: 8 }}>Capture Face</Text>
                  <Text style={{ color: '#94a3b8', fontSize: 11, marginTop: 4 }}>Required for attendance</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Admission Type Selection */}
            <Text style={s.flbl}>Admission Type *</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {[['driving', 'Driving Only'], ['license', 'License Only'], ['both', 'Both']].map(([k, l]) => (
                <TouchableOpacity key={k} style={[s.chip, form.admType === k && s.chipActive, { flex: 1, alignItems: 'center' }]} onPress={() => setForm({ ...form, admType: k })}>
                  <Text style={[s.chipT, form.admType === k && s.chipActiveT]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {[['name', 'Full Name *', 'default'], ['phone', 'Phone * (Used for login)', 'numeric'], ['rel', 'S/o D/o W/o', 'default'], ['addr', 'Address', 'default'], ['adm', 'Admission Date (YYYY-MM-DD)', 'default'], ['cardNo', 'Card No.', 'default'], ['tot', 'Total Fee ₹ *', 'numeric'], ['paid', 'Fee Paid ₹', 'numeric'], ['ll', 'LL Number', 'default'], ['lle', 'LL Expiry (YYYY-MM-DD)', 'default'], ['dl', 'DL Number', 'default']].map(([k, ph, kb]) => (
              <View key={k} style={s.fld}>
                <Text style={s.flbl}>{ph}</Text>
                <TextInput style={s.finp} placeholder={ph} keyboardType={kb} value={form[k]} onChangeText={v => setForm({ ...form, [k]: v })} />
              </View>
            ))}
            <TouchableOpacity style={[s.btnFull, addingStudent && { opacity: 0.7 }]} onPress={handleAdd} disabled={addingStudent}>
              {addingStudent ? <ActivityIndicator color="#fff" /> : <Text style={s.btnFullT}>✅ Register Student</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* BOTTOM NAV */}
      <View style={s.bnav}>
        {TABS.map(([key, icon, label]) => (
          <TouchableOpacity key={key} style={s.nb} onPress={() => setTab(key)}>
            <Text style={[s.ni, tab === key && s.niActive]}>{icon}</Text>
            <Text style={[s.nl, tab === key && s.nlActive]}>{label}</Text>
            {tab === key && <View style={s.nd} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* STUDENT DETAIL MODAL */}
      <Modal visible={!!selectedStudent} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelectedStudent(null)}>
        {selectedStudent && (
          <ScrollView style={{ padding: 20, paddingTop: 40 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', marginBottom: 16 }}>{selectedStudent.name}</Text>
            {[['Card No.', '#' + selectedStudent.cardNo], ['Phone', selectedStudent.phone], ['Vehicle', selectedStudent.veh], ['Slot', selectedStudent.slot], ['Admission', fmt(selectedStudent.adm)], ['LL No.', selectedStudent.ll || '—'], ['LL Expiry', fmt(selectedStudent.lle)], ['Classes Taken', selectedStudent.cls + ' / 26'], ['Classes Remaining', (26 - selectedStudent.cls) + ' remaining'], ['Total Fee', '₹' + (selectedStudent.tot || 0).toLocaleString()], ['Paid', '₹' + (selectedStudent.paid || 0).toLocaleString()], ['Balance', '₹' + ((selectedStudent.tot || 0) - (selectedStudent.paid || 0)).toLocaleString()], ['Face Registered', selectedStudent.faceDescriptor ? 'Yes ✅' : 'No ❌']].map(([l, v]) => (
              <View key={l} style={s.ir}><Text style={s.il}>{l}</Text><Text style={[s.iv, l === 'Classes Taken' && { color: '#2563eb', fontSize: 15 }]}>{v}</Text></View>
            ))}
            <TouchableOpacity style={[s.btnFull, { backgroundColor: '#ef4444', marginTop: 16 }]} onPress={() => { Alert.alert('Delete?', '', [{ text: 'Cancel' }, { text: 'Delete', onPress: () => { deleteStudent(selectedStudent.id); setSelectedStudent(null); } }]); }}>
              <Text style={s.btnFullT}>🗑 Delete Student</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btnFull, { backgroundColor: '#64748b', marginTop: 8 }]} onPress={() => setSelectedStudent(null)}>
              <Text style={s.btnFullT}>Close</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal visible={!!payModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setPayModal(null)}>
        {payModal && (
          <View style={{ padding: 20, paddingTop: 40 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', marginBottom: 4 }}>💰 Collect Payment</Text>
            <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 4 }}>{payModal.name}</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#ef4444', marginBottom: 16 }}>Balance: ₹{((payModal.tot || 0) - (payModal.paid || 0)).toLocaleString()}</Text>
            <Text style={s.flbl}>Amount Received (₹)</Text>
            <TextInput style={[s.finp, { fontSize: 18, fontWeight: '800' }]} placeholder="Enter amount" keyboardType="numeric" value={payAmt} onChangeText={setPayAmt} autoFocus />
            <View style={{ flexDirection: 'row', gap: 9, marginTop: 16 }}>
              <TouchableOpacity style={[s.btnFull, { backgroundColor: '#64748b', flex: 1 }]} onPress={() => setPayModal(null)}><Text style={s.btnFullT}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[s.btnFull, { backgroundColor: '#10b981', flex: 1 }]} onPress={() => { const a = parseInt(payAmt); if (!a || a <= 0) { Alert.alert('Error', 'Please enter a valid amount'); return; } collectPayment(payModal.id, a, user); setPayModal(null); }}>
                <Text style={s.btnFullT}>✅ Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </Modal>

      {/* FACE CAPTURE MODAL (for registration) */}
      <FaceScanModal
        visible={showFaceCapture}
        mode="capture"
        onCapture={(desc) => { setFaceDesc(desc); setShowFaceCapture(false); }}
        onClose={() => setShowFaceCapture(false)}
      />

      {/* FACE SCAN MODAL (for attendance) */}
      <FaceScanModal
        visible={showFaceScan}
        mode="scan"
        students={students}
        onMatch={handleFaceScanMatch}
        onClose={() => setShowFaceScan(false)}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f1f5f9' },
  hdr: { backgroundColor: '#0f2044', padding: 18, paddingTop: 50 },
  hdrRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  av: { width: 42, height: 42, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  un: { fontSize: 15, fontWeight: '900', color: '#fff' },
  ur: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  lout: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 11 },
  loutT: { color: '#fff', fontSize: 11, fontWeight: '700' },
  badge: { backgroundColor: 'rgba(96,165,250,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, alignSelf: 'flex-start', marginTop: 10 },
  badgeT: { color: '#60a5fa', fontSize: 10, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginTop: 14 },
  stat: { flex: 1, minWidth: '45%', backgroundColor: 'rgba(255,255,255,0.11)', borderRadius: 14, padding: 11 },
  statV: { fontSize: 18, fontWeight: '900', color: '#fff' },
  statL: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  body: { padding: 14, marginBottom: 60 },
  sec: { fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 7 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  scanBig: { backgroundColor: '#0f2044', borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 10 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  slotB: { backgroundColor: '#0f2044', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5, minWidth: 62, alignItems: 'center' },
  slotBT: { color: '#fff', fontSize: 11, fontWeight: '800' },
  slotName: { fontSize: 13, fontWeight: '700' },
  slotSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  alertBox: { flexDirection: 'row', gap: 10, backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 15, padding: 12, marginBottom: 9, alignItems: 'flex-start' },
  alertTitle: { fontSize: 12, fontWeight: '800', color: '#92400e' },
  alertMsg: { fontSize: 11, color: '#b45309', marginTop: 1 },
  searchWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 15, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 11, paddingLeft: 10 },
  searchIcon: { fontSize: 15, color: '#94a3b8' },
  searchInput: { flex: 1, padding: 11, fontSize: 13 },
  chips: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 99, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  chipActive: { backgroundColor: '#0f2044' },
  chipT: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  chipActiveT: { color: '#fff' },
  stCard: { backgroundColor: '#fff', borderRadius: 18, padding: 13, marginBottom: 9, borderLeftWidth: 4, borderLeftColor: '#2563eb', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  warn: { borderLeftColor: '#f97316' },
  done: { borderLeftColor: '#10b981' },
  stRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 7 },
  stName: { fontSize: 14, fontWeight: '800', color: '#0f172a' },
  stNo: { fontSize: 11, color: '#94a3b8', fontWeight: '500' },
  stMeta: { fontSize: 11, color: '#64748b', marginTop: 2 },
  pb: { height: 5, backgroundColor: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginBottom: 9 },
  pf: { height: '100%', backgroundColor: '#2563eb', borderRadius: 99 },
  btnRow: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end' },
  btnG: { backgroundColor: '#10b981', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7 },
  btnO: { backgroundColor: '#f97316', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7 },
  btnB: { backgroundColor: '#2563eb', borderRadius: 11, paddingHorizontal: 11, paddingVertical: 7 },
  btnT: { color: '#fff', fontSize: 11, fontWeight: '800' },
  tagG: { backgroundColor: '#dcfce7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  tagGT: { color: '#16a34a', fontSize: 10, fontWeight: '800' },
  tagR: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  tagRT: { color: '#dc2626', fontSize: 10, fontWeight: '800' },
  tagB: { backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  tagBT: { color: '#1d4ed8', fontSize: 10, fontWeight: '800' },
  la: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#0f2044', alignItems: 'center', justifyContent: 'center' },
  ir: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  il: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  iv: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  ibanner: { backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe', borderRadius: 13, padding: 10, marginBottom: 12 },
  faceSection: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 14, borderWidth: 2, borderColor: '#bfdbfe', alignItems: 'center' },
  faceBtn: { alignItems: 'center', paddingVertical: 20, paddingHorizontal: 40 },
  fld: { marginBottom: 12 },
  flbl: { fontSize: 10, fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 },
  finp: { backgroundColor: '#f8fafc', borderWidth: 1.5, borderColor: '#e2e8f0', borderRadius: 11, padding: 9, fontSize: 13 },
  btnFull: { backgroundColor: '#0f2044', borderRadius: 16, padding: 14, alignItems: 'center', marginTop: 6 },
  btnFullT: { color: '#fff', fontSize: 14, fontWeight: '900' },
  bnav: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e2e8f0', flexDirection: 'row', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 4, elevation: 8 },
  nb: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, gap: 3 },
  ni: { fontSize: 20, opacity: 0.28 },
  niActive: { opacity: 1 },
  nl: { fontSize: 10, fontWeight: '700', color: '#94a3b8' },
  nlActive: { color: '#0f2044' },
  nd: { width: 15, height: 2.5, backgroundColor: '#0f2044', borderRadius: 99 },
});
