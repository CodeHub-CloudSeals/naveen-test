import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert, Modal,
  ActivityIndicator, ScrollView,
} from 'react-native';
import { Camera, CameraType, useCameraPermissions } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';

const extractDescriptor = (face) => {
  const { bounds } = face;
  if (!bounds) return null;
  const ox = bounds.origin.x, oy = bounds.origin.y;
  const w = bounds.size.width || 1, h = bounds.size.height || 1;
  const n = (pt) => pt ? [(pt.x - ox) / w, (pt.y - oy) / h] : [0.5, 0.5];
  return [
    ...n(face.leftEyePosition),
    ...n(face.rightEyePosition),
    ...n(face.noseBasePosition),
    ...n(face.leftMouthPosition),
    ...n(face.rightMouthPosition),
    ...n(face.leftCheekPosition),
    ...n(face.rightCheekPosition),
  ];
};

const faceDist = (a, b) => {
  if (!a || !b || a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
};

const THRESHOLD = 0.55;

export default function FaceScanModal({ visible, mode = 'capture', students = [], onCapture, onMatch, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [faces, setFaces] = useState([]);
  const [busy, setBusy] = useState(false);
  const [matched, setMatched] = useState(null);
  const [done, setDone] = useState(false);
  const camRef = useRef(null);
  const lastDesc = useRef(null);

  useEffect(() => {
    if (visible) {
      if (!permission?.granted) requestPermission();
      setFaces([]); setBusy(false); setMatched(null); setDone(false);
      lastDesc.current = null;
    }
  }, [visible]);

  const onFacesDetected = ({ faces: f }) => {
    const det = f || [];
    setFaces(det);
    if (det.length > 0) lastDesc.current = extractDescriptor(det[0]);
  };

  const handleAction = () => {
    if (busy) return;
    if (faces.length === 0) { Alert.alert('No Face', 'Please position your face in front of the camera'); return; }
    if (faces.length > 1) { Alert.alert('Multiple Faces', 'Please show only one face'); return; }
    const desc = lastDesc.current;
    if (!desc) { Alert.alert('Error', 'Face not detected. Please try again.'); return; }
    setBusy(true);

    if (mode === 'capture') {
      setDone(true);
      onCapture(desc);
      setBusy(false);
    } else {
      let best = null, minDist = Infinity;
      students.forEach(st => {
        if (st.faceDescriptor?.length) {
          const d = faceDist(desc, st.faceDescriptor);
          if (d < minDist) { minDist = d; best = st; }
        }
      });
      if (best && minDist < THRESHOLD) {
        setMatched(best);
        setBusy(false);
      } else {
        const noFaces = students.filter(s => s.faceDescriptor?.length).length === 0;
        Alert.alert(
          'Not Recognized',
          noFaces
            ? 'No students have a face registered. Capture face when adding a student.'
            : 'Face not recognized. Try again with better lighting.'
        );
        setBusy(false);
      }
    }
  };

  if (!visible) return null;

  if (permission && !permission.granted) return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={ss.center}>
        <Text style={{ fontSize: 40, marginBottom: 12 }}>🚫</Text>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#ef4444', textAlign: 'center', marginBottom: 24 }}>Camera permission denied</Text>
        <TouchableOpacity style={[ss.btn, { marginBottom: 10 }]} onPress={requestPermission}><Text style={ss.btnT}>Allow Permission</Text></TouchableOpacity>
        <TouchableOpacity style={[ss.btn, { backgroundColor: '#64748b' }]} onPress={onClose}><Text style={ss.btnT}>Close</Text></TouchableOpacity>
      </View>
    </Modal>
  );

  if (!permission) return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={ss.center}><ActivityIndicator size="large" color="#0f2044" /></View>
    </Modal>
  );

  if (done) return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={ss.center}>
        <Text style={{ fontSize: 60, marginBottom: 16 }}>✅</Text>
        <Text style={{ fontSize: 20, fontWeight: '900', color: '#10b981', marginBottom: 8 }}>Face Captured!</Text>
        <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 32 }}>Student face data saved.</Text>
        <TouchableOpacity style={[ss.btn, { backgroundColor: '#10b981' }]} onPress={onClose}><Text style={ss.btnT}>Done</Text></TouchableOpacity>
      </View>
    </Modal>
  );

  if (matched) return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <ScrollView contentContainerStyle={[ss.center, { padding: 24, paddingTop: 60 }]}>
        <Text style={{ fontSize: 50, marginBottom: 12 }}>🎯</Text>
        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0f2044', marginBottom: 4 }}>{matched.name}</Text>
        <Text style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>#{matched.cardNo || '—'} · {matched.veh}</Text>

        <View style={ss.card}>
          {[
            ['Phone', matched.phone],
            ['Vehicle', matched.veh],
            ['Slot', matched.slot],
            ['Classes Taken', `${matched.cls} / 26`],
            ['Classes Remaining', `${26 - matched.cls} remaining`],
            ['Total Fee', `₹${(matched.tot || 0).toLocaleString()}`],
            ['Paid', `₹${(matched.paid || 0).toLocaleString()}`],
            ['Balance', `₹${((matched.tot || 0) - (matched.paid || 0)).toLocaleString()}`],
          ].map(([l, v]) => (
            <View key={l} style={ss.row}>
              <Text style={ss.lbl}>{l}</Text>
              <Text style={[ss.val,
                l === 'Classes Taken' && { color: '#2563eb', fontSize: 16, fontWeight: '900' },
                l === 'Balance' && (matched.tot > matched.paid) && { color: '#ef4444' }
              ]}>{v}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={[ss.btn, { backgroundColor: '#10b981', width: '100%', marginBottom: 10 }]} onPress={() => { onMatch(matched); setMatched(null); setBusy(false); }}>
          <Text style={ss.btnT}>✅ Mark Attendance (+1 Class)</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[ss.btn, { backgroundColor: '#64748b', width: '100%', marginBottom: 8 }]} onPress={() => { setMatched(null); setBusy(false); }}>
          <Text style={ss.btnT}>Scan Again</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose}>
          <Text style={{ color: '#94a3b8', fontSize: 13, fontWeight: '700', paddingVertical: 10 }}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );

  const faceOk = faces.length === 1;
  const multiface = faces.length > 1;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Camera
          ref={camRef}
          style={{ flex: 1 }}
          type={CameraType.front}
          onFacesDetected={onFacesDetected}
          faceDetectorSettings={{
            mode: FaceDetector.FaceDetectorMode.accurate,
            detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
            runClassifications: FaceDetector.FaceDetectorClassifications.none,
            minDetectionInterval: 200,
            tracking: true,
          }}
        >
          <View style={ss.topBar}>
            <TouchableOpacity onPress={onClose} style={ss.closeBtn}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
            <Text style={ss.topTitle}>
              {mode === 'capture' ? '📷 Face Register' : '📷 Face Attendance'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={ss.statusBar}>
            <View style={[ss.dot, { backgroundColor: faceOk ? '#10b981' : multiface ? '#f97316' : '#ef4444' }]} />
            <Text style={ss.statusTxt}>
              {multiface ? 'Multiple faces — show only one' : faceOk ? 'Face detected ✓' : 'Position face in front of camera...'}
            </Text>
          </View>

          <View style={ss.bottomBar}>
            <Text style={ss.hintTxt}>
              {mode === 'capture' ? 'Show face clearly and press Capture' : 'Face the camera and press Scan'}
            </Text>
            <TouchableOpacity
              style={[ss.captureBtn, (!faceOk || busy) && ss.captureBtnOff]}
              onPress={handleAction}
              disabled={!faceOk || busy}
            >
              {busy
                ? <ActivityIndicator color="#fff" size="large" />
                : <Text style={{ fontSize: 32 }}>{mode === 'scan' ? '🔍' : '📷'}</Text>
              }
            </TouchableOpacity>
            <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 10 }}>
              {mode === 'scan' ? 'Student will be identified' : 'Face data will be saved'}
            </Text>
          </View>
        </Camera>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 50, backgroundColor: 'rgba(0,0,0,0.6)' },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  statusBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.45)', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 24, paddingBottom: 50, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center' },
  hintTxt: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 20, textAlign: 'center' },
  captureBtn: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#2563eb', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)' },
  captureBtnOff: { backgroundColor: '#475569', borderColor: 'rgba(255,255,255,0.2)' },
  btn: { backgroundColor: '#0f2044', borderRadius: 16, padding: 16, alignItems: 'center' },
  btnT: { color: '#fff', fontSize: 15, fontWeight: '800' },
  card: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 16, width: '100%', marginBottom: 24 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  lbl: { fontSize: 11, color: '#94a3b8', fontWeight: '600' },
  val: { fontSize: 13, fontWeight: '700', color: '#0f172a' },
});
