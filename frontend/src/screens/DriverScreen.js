import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Alert, Modal, Linking, ActivityIndicator, Image } from 'react-native';
import { collection, addDoc, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import FaceScanModal from '../components/FaceScanModal';

const TC = 26;

export default function DriverScreen() {
  const { logout, user } = useAuth();
  const { students, markClass, addStudent } = useData();
  const [tab, setTab] = useState('schedule');
  const [admTypeFilter, setAdmTypeFilter] = useState('all');
  const [form, setForm] = useState({ name: '', phone: '', adm: '', slot: '6:00 AM', veh: 'Car (LMV)', tot: '', paid: '', ll: '', lle: '', dl: '', admType: 'both' });
  const [faceDesc, setFaceDesc] = useState(null);
  const [facePhoto, setFacePhoto] = useState(null);
  const [showFaceCapture, setShowFaceCapture] = useState(false);
  const [showFaceScan, setShowFaceScan] = useState(false);
  const [addingStudent, setAddingStudent] = useState(false);

  const handleAdd = async () => {
    if (addingStudent) return; // prevent double-submit
    if (!form.name || !form.phone || !form.tot) { Alert.alert('Error', 'Fill required fields'); return; }
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
      // Active student check passed. Clean up orphan login records (left over
      // from previously soft-deleted students) so the phone can be re-used.
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
      // Auto-set admission date to today (cannot be edited manually)
      const today = new Date().toISOString().slice(0, 10);
      await addStudent({ ...form, phone, adm: today, tot: parseInt(form.tot) || 0, paid: parseInt(form.paid) || 0, faceDescriptor: faceDesc, faceImage: facePhoto, schoolId: user?.schoolId });
      Alert.alert('Success ✅', `${form.name} registered with face!\nLogin phone: ${phone}`);
      setForm({ name: '', phone: '', adm: '', slot: '6:00 AM', veh: 'Car (LMV)', tot: '', paid: '', ll: '', lle: '', dl: '', admType: 'both' });
      setFaceDesc(null);
      setFacePhoto(null);
      setTab('students');
    } catch (e) {
      Alert.alert('Error', 'Failed to add student: ' + e.message);
    } finally {
      setAddingStudent(false);
    }
  };

  const handleFaceScanMatch = async (student) => {
    setShowFaceScan(false);
    const res = await markClass(student.id);
    if (res?.ok) {
      Alert.alert('Attendance Marked! ✅', `${student.name}\nClass ${res.newCls} / ${TC} marked`);
    } else if (res?.reason === 'completed') {
      Alert.alert('Already Completed', `${student.name} has already finished all ${TC} classes.`);
    } else {
      Alert.alert('Could Not Mark', 'Student record not found. Please try again.');
    }
  };

  const TABS = [['schedule', '📅', 'Schedule'], ['scan', '📷', 'Scan'], ['students', '👥', 'Students'], ['fees', '💰', 'Fees'], ['add', '➕', 'Add']];

  return (
    <View style={s.container}>
      <View style={s.hdr}>
        <View style={s.hdrRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={s.av}><Text style={{ fontSize: 19 }}>🧑‍🏫</Text></View>
            <View style={{ marginLeft: 10 }}>
              <Text style={s.un}>{user?.name || user?.email}</Text>
              <Text style={s.ur}>Instructor · {user?.schoolName}</Text>
            </View>
          </View>
          <TouchableOpacity style={s.lout} onPress={logout}><Text style={s.loutT}>Logout</Text></TouchableOpacity>
        </View>
        <View style={s.badge}><Text style={s.badgeT}>🧑‍🏫 Instructor — Full Access</Text></View>
      </View>

      <ScrollView style={s.body} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>

        {/* SCHEDULE */}
        {tab === 'schedule' && (
          <View>
            <View style={s.statsGrid}>
              <View style={s.stat}><Text style={s.statV}>{students.length}</Text><Text style={s.statL}>Today's Classes</Text></View>
              <View style={s.stat}><Text style={s.statV}>{students.length}</Text><Text style={s.statL}>My Students</Text></View>
            </View>
            <Text style={s.sec}>📅 Today's Schedule</Text>
            {students.length === 0 ? (
              <View style={s.card}><Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No students</Text></View>
            ) : (
              <View style={s.card}>
                {[...students].sort((a, b) => a.slot?.localeCompare(b.slot)).map(st => (
                  <View key={st.id} style={s.slotRow}>
                    <View style={s.slotB}><Text style={s.slotBT}>{st.slot}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.slotName}>{st.name}</Text>
                      <Text style={s.slotSub}>{st.veh} · Class {st.cls + 1} · {st.cls}/{TC} done</Text>
                    </View>
                    <TouchableOpacity style={s.markBtn} onPress={() => markClass(st.id)}>
                      <Text style={s.markBtnT}>✅ Mark</Text>
                    </TouchableOpacity>
                  </View>
                ))}
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

            <Text style={s.sec}>👥 Students — Classes Status</Text>
            <View style={s.card}>
              {students.map(st => (
                <View key={st.id} style={s.li}>
                  <View style={[s.la, { backgroundColor: st.faceDescriptor ? '#0f2044' : '#cbd5e1' }]}>
                    <Text style={{ color: '#fff', fontWeight: '900' }}>{st.name?.[0] || '?'}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.ln}>{st.name}</Text>
                    <Text style={s.lm}>{st.veh} · {st.slot}</Text>
                    <View style={s.pb}><View style={[s.pf, { width: Math.round(st.cls / TC * 100) + '%' }]} /></View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#2563eb' }}>{st.cls}/{TC}</Text>
                    {!st.faceDescriptor && <Text style={{ fontSize: 9, color: '#f97316', fontWeight: '700' }}>No Face</Text>}
                  </View>
                </View>
              ))}
              {students.length === 0 && <Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No students</Text>}
            </View>

            {students.filter(s => !s.faceDescriptor).length > 0 && (
              <View style={[s.card, { backgroundColor: '#fff7ed', borderWidth: 1, borderColor: '#fed7aa' }]}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#c2410c', marginBottom: 6 }}>⚠️ Students without face registered:</Text>
                {students.filter(s => !s.faceDescriptor).map(st => (
                  <Text key={st.id} style={{ fontSize: 11, color: '#9a3412', marginBottom: 3 }}>• {st.name}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* STUDENTS */}
        {tab === 'students' && (() => {
          const filteredStudents = students.filter(s => admTypeFilter === 'all' || s.admType === admTypeFilter || (!s.admType && admTypeFilter === 'both'));
          return (
          <View>
            <Text style={s.sec}>👥 My Students</Text>
            <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {[['all', 'All Types'], ['driving', 'Driving Only'], ['license', 'License Only'], ['both', 'Both']].map(([f, l]) => {
                const count = students.filter(s => f === 'all' || s.admType === f || (!s.admType && f === 'both')).length;
                return (
                  <TouchableOpacity key={f} style={[s.chip, admTypeFilter === f && s.chipActive]} onPress={() => setAdmTypeFilter(f)}>
                    <Text style={[s.chipT, admTypeFilter === f && s.chipActiveT]}>{l} ({count})</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {filteredStudents.length === 0 ? (
              <View style={s.card}><Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No students found</Text></View>
            ) : (
              <View style={s.card}>
                {filteredStudents.map(st => (
                  <View key={st.id} style={s.li}>
                    <View style={s.la}><Text style={{ color: '#fff', fontWeight: '900' }}>{st.name?.[0] || '?'}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.ln}>{st.name}</Text>
                      <Text style={s.lm}>{st.veh} · {st.slot}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 3 }}>
                        <Text style={{ fontSize: 11, color: '#64748b' }}>Classes: {st.cls}/{TC}</Text>
                        {!st.faceDescriptor && <Text style={{ fontSize: 9, color: '#f97316', fontWeight: '700' }}>No Face ⚠️</Text>}
                      </View>
                      <View style={s.pb}><View style={[s.pf, { width: Math.round(st.cls / TC * 100) + '%' }]} /></View>
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#2563eb' }}>{st.cls}/{TC}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
          );
        })()}

        {/* FEES */}
        {tab === 'fees' && (
          <View>
            <Text style={s.sec}>💰 Student Fee Status</Text>
            {students.map(st => {
              const b = st.tot - st.paid;
              return (
                <View key={st.id} style={[s.card, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: b > 0 ? '#f97316' : '#10b981' }]}>
                  <View><Text style={{ fontSize: 13, fontWeight: '800' }}>{st.name}</Text><Text style={{ fontSize: 11, color: '#94a3b8' }}>📱 {st.phone}</Text></View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 15, fontWeight: '900', color: b > 0 ? '#f97316' : '#10b981' }}>{b > 0 ? '₹' + b.toLocaleString() + ' due' : 'Paid ✓'}</Text>
                    <Text style={{ fontSize: 10, color: '#94a3b8' }}>Total: ₹{(st.tot || 0).toLocaleString()}</Text>
                  </View>
                </View>
              );
            })}
            {students.length === 0 && <View style={s.card}><Text style={{ color: '#94a3b8', textAlign: 'center', paddingVertical: 20 }}>No students</Text></View>}
            <View style={[s.card, { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a' }]}>
              <Text style={{ fontSize: 12, color: '#92400e', fontWeight: '700' }}>⚠️ Payment collection contact:</Text>
              <TouchableOpacity onPress={() => Linking.openURL('tel:9000300256')}>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f2044', marginTop: 4 }}>📞 9000 300 256</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ADD */}
        {tab === 'add' && (
          <View>
            <View style={s.ibanner}><Text style={{ color: '#1d4ed8', fontSize: 12 }}>📋 New Student — 26 Classes / 45 Days</Text></View>

            {/* Face Capture Section */}
            <View style={s.faceSection}>
              <Text style={s.flbl}>Student Face Photo *</Text>
              {faceDesc ? (
                <View style={{ alignItems: 'center', paddingVertical: 16 }}>
                  {facePhoto ? (
                    <Image source={{ uri: facePhoto }} style={{ width: 110, height: 110, borderRadius: 14, marginBottom: 6 }} />
                  ) : (
                    <Text style={{ fontSize: 40 }}>✅</Text>
                  )}
                  <Text style={{ color: '#10b981', fontWeight: '800', fontSize: 14, marginTop: 6 }}>Face Registered!</Text>
                  <TouchableOpacity onPress={() => { setFaceDesc(null); setFacePhoto(null); }} style={{ marginTop: 8 }}>
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
                <TouchableOpacity key={k} style={[s.chip, form.admType === k && s.chipActive, { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }]} onPress={() => setForm({ ...form, admType: k })}>
                  <Text style={[s.chipT, form.admType === k && s.chipActiveT]}>{l}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Admission date auto-displayed (today) — not editable */}
            <View style={[s.card, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, marginBottom: 12, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }]}>
              <Text style={{ fontSize: 11, fontWeight: '800', color: '#1d4ed8' }}>📅 ADMISSION DATE</Text>
              <Text style={{ fontSize: 13, fontWeight: '900', color: '#0f2044' }}>{new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} (Today)</Text>
            </View>

            {[['name', 'Full Name *', 'default'], ['phone', 'Phone *', 'numeric'], ['tot', 'Total Fee ₹ *', 'numeric'], ['paid', 'Fee Paid ₹', 'numeric'], ['ll', 'LL Number', 'default'], ['lle', 'LL Expiry (YYYY-MM-DD)', 'default'], ['dl', 'DL Number', 'default']].map(([k, ph, kb]) => (
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

      <View style={s.bnav}>
        {TABS.map(([key, icon, label]) => (
          <TouchableOpacity key={key} style={s.nb} onPress={() => setTab(key)}>
            <Text style={[s.ni, tab === key && s.niActive]}>{icon}</Text>
            <Text style={[s.nl, tab === key && s.nlActive]}>{label}</Text>
            {tab === key && <View style={s.nd} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* FACE CAPTURE MODAL (for registration) */}
      <FaceScanModal
        visible={showFaceCapture}
        mode="capture"
        students={students}
        onCapture={(res) => {
          if (res && typeof res === 'object' && !Array.isArray(res)) {
            setFaceDesc(res.descriptor || null);
            setFacePhoto(res.photo || null);
          } else {
            setFaceDesc(res);
            setFacePhoto(null);
          }
          setShowFaceCapture(false);
        }}
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
  badge: { backgroundColor: 'rgba(52,211,153,0.2)', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 99, alignSelf: 'flex-start', marginTop: 10 },
  badgeT: { color: '#34d399', fontSize: 10, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', gap: 9, marginBottom: 4 },
  stat: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 14, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  statV: { fontSize: 22, fontWeight: '900', color: '#0f2044' },
  statL: { fontSize: 10, color: '#94a3b8', marginTop: 3 },
  body: { padding: 14, marginBottom: 60 },
  sec: { fontSize: 10, fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 1, marginTop: 14, marginBottom: 7 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  scanBig: { backgroundColor: '#0f2044', borderRadius: 20, padding: 32, alignItems: 'center', marginBottom: 10 },
  slotRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  slotB: { backgroundColor: '#0f2044', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 5, minWidth: 62, alignItems: 'center' },
  slotBT: { color: '#fff', fontSize: 11, fontWeight: '800' },
  slotName: { fontSize: 13, fontWeight: '700' },
  slotSub: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  markBtn: { backgroundColor: '#10b981', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  markBtnT: { color: '#fff', fontSize: 10, fontWeight: '800' },
  li: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#f8fafc' },
  la: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#0f2044', alignItems: 'center', justifyContent: 'center' },
  ln: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
  lm: { fontSize: 11, color: '#94a3b8', marginTop: 1 },
  pb: { height: 5, backgroundColor: '#f1f5f9', borderRadius: 99, overflow: 'hidden', marginTop: 5 },
  pf: { height: '100%', backgroundColor: '#2563eb', borderRadius: 99 },
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
  chip: { paddingHorizontal: 13, paddingVertical: 6, borderRadius: 99, backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 3, elevation: 1 },
  chipActive: { backgroundColor: '#0f2044', borderColor: '#0f2044' },
  chipT: { fontSize: 11, fontWeight: '800', color: '#64748b' },
  chipActiveT: { color: '#fff' },
});
