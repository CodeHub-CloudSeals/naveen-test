import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
} from 'react-native';

import { Camera } from 'expo-camera';
import * as FaceDetector from 'expo-face-detector';

const extractDescriptor = (face) => {
  const { bounds } = face;
  if (!bounds) return null;
  const ox = bounds.origin.x;
  const oy = bounds.origin.y;
  const w = bounds.size.width || 1;
  const h = bounds.size.height || 1;
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

export default function FaceScanModal({
  visible,
  mode = 'capture',
  students = [],
  onCapture,
  onMatch,
  onClose,
}) {
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [faces, setFaces] = useState([]);
  const [busy, setBusy] = useState(false);
  const [matchedStudent, setMatchedStudent] = useState(null);
  const [done, setDone] = useState(false);

  const lastDesc = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    if (visible) {
      if (!permission?.granted) requestPermission();
      setFaces([]);
      setBusy(false);
      setMatchedStudent(null);
      setDone(false);
      lastDesc.current = null;
    }
  }, [visible]);

  const onFacesDetected = ({ faces: detectedFaces }) => {
    const det = detectedFaces || [];
    setFaces(det);
    if (det.length > 0) lastDesc.current = extractDescriptor(det[0]);
  };

  const handleAction = async () => {
    if (busy) return;

    if (faces.length === 0) {
      Alert.alert('No Face', 'Please position your face in front of the camera');
      return;
    }
    if (faces.length > 1) {
      Alert.alert('Multiple Faces', 'Please show only one face');
      return;
    }

    const desc = lastDesc.current;
    if (!desc) {
      Alert.alert('Error', 'Face not detected. Please try again.');
      return;
    }

    setBusy(true);

    if (mode === 'capture') {
      // Take a small JPEG snapshot for profile display.
      // Firestore docs are limited to 1 MiB total — keep photo well under that.
      let photo = null;
      try {
        if (cameraRef.current?.takePictureAsync) {
          const pic = await cameraRef.current.takePictureAsync({
            quality: 0.15,             // heavy JPEG compression
            base64: true,
            skipProcessing: true,
            pictureSize: '480x640',    // hint to use small resolution
          });
          if (pic?.base64) {
            // Hard cap: drop photo if it would exceed Firestore doc budget
            // 700 KB base64 ≈ 525 KB binary — safe with descriptor + other fields
            const sizeKB = pic.base64.length / 1024;
            console.log('Captured photo base64 size:', Math.round(sizeKB), 'KB');
            if (sizeKB <= 700) {
              photo = 'data:image/jpeg;base64,' + pic.base64;
            } else {
              console.warn('Photo too large (' + Math.round(sizeKB) + ' KB) — skipping');
            }
          }
        }
      } catch (e) {
        console.warn('Photo capture failed:', e?.message || e);
      }
      setDone(true);
      setBusy(false);
      if (typeof onCapture === 'function') {
        // Backward compatible: pass an object so callers can destructure
        onCapture({ descriptor: desc, photo });
      }
    } else {
      let best = null;
      let minDist = Infinity;

      students.forEach((st) => {
        if (st.faceDescriptor?.length) {
          const d = faceDist(desc, st.faceDescriptor);
          if (d < minDist) {
            minDist = d;
            best = st;
          }
        }
      });

      if (best && minDist < THRESHOLD) {
        setMatchedStudent(best);
        setBusy(false);
      } else {
        const noFaces = students.filter((s) => s.faceDescriptor?.length).length === 0;
        Alert.alert(
          'Not Recognized',
          noFaces
            ? 'No students have a face registered.'
            : 'Face not recognized. Try again with better lighting.'
        );
        setBusy(false);
      }
    }
  };

  const handleConfirmMatch = () => {
    if (typeof onMatch === 'function') {
      onMatch(matchedStudent);
    }
    setMatchedStudent(null);
  };

  const handleRetry = () => {
    setMatchedStudent(null);
    setFaces([]);
    lastDesc.current = null;
  };

  if (!visible) return null;

  if (!permission) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={ss.center}>
          <ActivityIndicator size="large" color="#0f2044" />
        </View>
      </Modal>
    );
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={ss.center}>
          <Text style={{ fontSize: 40, marginBottom: 12 }}>🚫</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#ef4444', textAlign: 'center', marginBottom: 24 }}>
            Camera permission denied
          </Text>
          <TouchableOpacity style={[ss.btn, { marginBottom: 10 }]} onPress={requestPermission}>
            <Text style={ss.btnT}>Allow Permission</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[ss.btn, { backgroundColor: '#64748b' }]} onPress={onClose}>
            <Text style={ss.btnT}>Close</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
        <Camera
          ref={cameraRef}
          style={{ flex: 1 }}
          type={Camera.Constants?.Type?.front ?? 'front'}
          onFacesDetected={onFacesDetected}
          faceDetectorSettings={{
            mode: FaceDetector.FaceDetectorMode.fast,
            detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
            runClassifications: FaceDetector.FaceDetectorClassifications.none,
            minDetectionInterval: 250,
            tracking: true,
          }}
        >
          {/* Top bar */}
          <View style={ss.topBar}>
            <TouchableOpacity onPress={onClose} style={ss.closeBtn}>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
            <Text style={ss.topTitle}>
              {mode === 'capture' ? '📷 Face Register' : '📷 Face Attendance'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {/* Status bar */}
          <View style={ss.statusBar}>
            <View style={[ss.dot, {
              backgroundColor:
                faces.length === 1 ? '#10b981' :
                faces.length > 1 ? '#f97316' : '#ef4444',
            }]} />
            <Text style={ss.statusTxt}>
              {faces.length > 1
                ? 'Multiple faces detected'
                : faces.length === 1
                ? 'Face detected ✓'
                : 'Position face in front of camera'}
            </Text>
          </View>

          {/* Matched student confirmation overlay */}
          {matchedStudent && (
            <View style={ss.matchOverlay}>
              <Text style={{ fontSize: 48, marginBottom: 10 }}>✅</Text>
              <Text style={{ color: '#fff', fontSize: 22, fontWeight: '900', marginBottom: 4 }}>
                {matchedStudent.name}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, marginBottom: 6 }}>
                📱 {matchedStudent.phone}
              </Text>
              <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginBottom: 24 }}>
                Classes: {matchedStudent.cls} / 26
              </Text>
              <TouchableOpacity style={ss.confirmBtn} onPress={handleConfirmMatch}>
                <Text style={{ color: '#fff', fontSize: 15, fontWeight: '900' }}>
                  ✅ Mark Attendance
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ss.confirmBtn, { backgroundColor: '#64748b', marginTop: 10 }]} onPress={handleRetry}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>🔄 Retry</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Capture done overlay */}
          {done && mode === 'capture' && (
            <View style={ss.matchOverlay}>
              <Text style={{ fontSize: 56, marginBottom: 12 }}>✅</Text>
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: '900' }}>Face Registered!</Text>
            </View>
          )}

          {/* Bottom capture button */}
          {!matchedStudent && !done && (
            <View style={ss.bottomBar}>
              <TouchableOpacity
                style={[ss.captureBtn, (faces.length !== 1 || busy) && ss.captureBtnOff]}
                onPress={handleAction}
                disabled={faces.length !== 1 || busy}
              >
                {busy
                  ? <ActivityIndicator color="#fff" size="large" />
                  : <Text style={{ fontSize: 32 }}>{mode === 'scan' ? '🔍' : '📷'}</Text>
                }
              </TouchableOpacity>
            </View>
          )}
        </Camera>
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  topBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 50, backgroundColor: 'rgba(0,0,0,0.6)',
  },
  closeBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { color: '#fff', fontSize: 14, fontWeight: '800' },
  statusBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, backgroundColor: 'rgba(0,0,0,0.45)', gap: 8,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  statusTxt: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 24, paddingBottom: 50, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center',
  },
  captureBtn: {
    width: 84, height: 84, borderRadius: 42, backgroundColor: '#2563eb',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)',
  },
  captureBtnOff: { backgroundColor: '#475569', borderColor: 'rgba(255,255,255,0.2)' },
  matchOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center',
    padding: 32,
  },
  confirmBtn: {
    backgroundColor: '#10b981', borderRadius: 16,
    paddingVertical: 14, paddingHorizontal: 40, alignItems: 'center', width: '100%',
  },
  btn: { backgroundColor: '#0f2044', borderRadius: 16, padding: 16, alignItems: 'center', width: 200 },
  btnT: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
