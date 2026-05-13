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

// Build a discriminative descriptor from facial landmarks.
// Requires eyes + nose. Falls back to estimated positions for mouth/cheeks
// when not detected, so the descriptor is generated more often.
const extractDescriptor = (face) => {
  const { bounds, leftEyePosition: lE, rightEyePosition: rE,
          noseBasePosition: nB, leftMouthPosition: lMin, rightMouthPosition: rMin,
          leftCheekPosition: lCin, rightCheekPosition: rCin,
          bottomMouthPosition: bMin } = face;
  if (!bounds) return null;
  const ox = bounds.origin.x, oy = bounds.origin.y;
  const w = bounds.size.width || 1;
  const h = bounds.size.height || 1;
  // Need at least the core landmarks (eyes + nose). Mouth/cheeks can be
  // estimated from the bounding box + eye line.
  if (!lE || !rE || !nB) {
    console.log('[FaceScan] missing core landmarks — descriptor null');
    return null;
  }

  // Estimate missing landmarks geometrically from what we have
  const eyeMidX = (lE.x + rE.x) / 2;
  const eyeMidY = (lE.y + rE.y) / 2;
  const eyeSpan = Math.abs(rE.x - lE.x) || w * 0.3;

  const lM = lMin || { x: nB.x - eyeSpan * 0.4, y: nB.y + h * 0.15 };
  const rM = rMin || { x: nB.x + eyeSpan * 0.4, y: nB.y + h * 0.15 };
  const bM = bMin || { x: (lM.x + rM.x) / 2, y: nB.y + h * 0.22 };
  const lC = lCin || { x: lE.x - eyeSpan * 0.3, y: nB.y };
  const rC = rCin || { x: rE.x + eyeSpan * 0.3, y: nB.y };

  const norm = (pt) => [(pt.x - ox) / w, (pt.y - oy) / h];
  const distNorm = (a, b) => Math.sqrt(((a.x - b.x) / w) ** 2 + ((a.y - b.y) / h) ** 2);
  const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const eyeMid = { x: eyeMidX, y: eyeMidY };
  const mouthMid = mid(lM, rM);

  const eyeDist     = distNorm(lE, rE);
  const mouthWidth  = distNorm(lM, rM);
  const noseToEye   = distNorm(nB, eyeMid);
  const noseToMouth = distNorm(nB, mouthMid);
  const cheekDist   = distNorm(lC, rC);
  const faceAspect  = h / w;
  // Ratios — most discriminative because they're scale-invariant
  const r1 = mouthWidth > 0 ? eyeDist / mouthWidth : 1;
  const r2 = noseToMouth > 0 ? noseToEye / noseToMouth : 1;
  const r3 = cheekDist > 0 ? mouthWidth / cheekDist : 1;
  const r4 = cheekDist > 0 ? eyeDist / cheekDist : 1;
  const eyeY  = (eyeMid.y - oy) / h;
  const noseY = (nB.y - oy) / h;
  const mouthY = (mouthMid.y - oy) / h;

  return [
    ...norm(lE), ...norm(rE), ...norm(nB),
    ...norm(lM), ...norm(rM),
    ...norm(lC), ...norm(rC),
    ...norm(bM),
    eyeDist, mouthWidth, noseToEye, noseToMouth, cheekDist, faceAspect,
    r1, r2, r3, r4,
    eyeY, noseY, mouthY,
  ];
};

const faceDist = (a, b) => {
  if (!a || !b || a.length !== b.length) return Infinity;
  return Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));
};

// Stricter threshold — with the richer descriptor above, distances between
// the same person stay small (~0.05-0.15) while different people typically
// land at 0.25+. 0.20 gives a reasonable safety margin.
const THRESHOLD = 0.20;

export default function FaceScanModal({
  visible,
  mode = 'capture',
  students = [],
  excludeStudentId = null,  // when retaking an existing student, don't flag self as duplicate
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
      Alert.alert(
        'Try Again',
        'Face landmarks not clear. Please:\n• Look directly at the camera\n• Move face into center\n• Improve lighting\n• Keep face fully visible'
      );
      return;
    }

    setBusy(true);

    if (mode === 'capture') {
      // BEFORE saving, check if this face already matches a registered student
      // (prevents accidentally registering the same person twice).
      let dupStudent = null;
      let dupDist = Infinity;
      students.forEach((st) => {
        if (excludeStudentId && st.id === excludeStudentId) return;
        if (!st.faceDescriptor?.length || st.faceDescriptor.length !== desc.length) return;
        const d = faceDist(desc, st.faceDescriptor);
        if (d < dupDist) {
          dupDist = d;
          dupStudent = st;
        }
      });
      console.log('[FaceScan capture] closest existing match:', dupStudent?.name, 'dist=', dupDist.toFixed(3));
      if (dupStudent && dupDist < THRESHOLD) {
        Alert.alert(
          'Already Registered',
          `This face is already registered as:\n\n${dupStudent.name}\n📱 ${dupStudent.phone}\n\nCannot add the same person twice.`
        );
        setBusy(false);
        return;
      }

      // Take a small JPEG snapshot for profile display.
      // Firestore docs are limited to 1 MiB total — keep photo well under that.
      let photo = null;
      try {
        if (cameraRef.current?.takePictureAsync) {
          const pic = await cameraRef.current.takePictureAsync({
            quality: 0.1,              // very heavy JPEG compression
            base64: true,
            skipProcessing: true,
          });
          if (pic?.base64) {
            const sizeKB = pic.base64.length / 1024;
            console.log('[FaceScan] Captured photo base64 size:', Math.round(sizeKB), 'KB');
            // Hard cap: drop photo if it would exceed Firestore doc budget
            if (sizeKB <= 700) {
              photo = 'data:image/jpeg;base64,' + pic.base64;
            } else {
              console.warn('[FaceScan] Photo too large (' + Math.round(sizeKB) + ' KB) — skipping');
            }
          } else {
            console.warn('[FaceScan] takePictureAsync returned no base64');
          }
        } else {
          console.warn('[FaceScan] cameraRef.takePictureAsync not available');
        }
      } catch (e) {
        console.warn('[FaceScan] Photo capture failed:', e?.message || e);
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
      let usableCount = 0;
      let staleCount = 0;

      students.forEach((st) => {
        if (st.faceDescriptor?.length) {
          // Old short descriptors (14 values) are incompatible with new format
          if (st.faceDescriptor.length !== desc.length) {
            staleCount++;
            return;
          }
          usableCount++;
          const d = faceDist(desc, st.faceDescriptor);
          console.log('[FaceScan] dist to', st.name, '=', d.toFixed(3));
          if (d < minDist) {
            minDist = d;
            best = st;
          }
        }
      });

      console.log('[FaceScan] best=', best?.name, 'minDist=', minDist.toFixed(3), 'threshold=', THRESHOLD);

      if (best && minDist < THRESHOLD) {
        setMatchedStudent(best);
        setBusy(false);
      } else {
        const noFaces = usableCount === 0;
        let msg;
        if (noFaces && staleCount > 0) {
          msg = staleCount + ' student(s) have old face data — owner needs to re-capture their photos using "Retake Photo" in the Owner app.';
        } else if (noFaces) {
          msg = 'No students have a face registered.';
        } else {
          msg = 'Face not recognized. Try again with better lighting, or owner can re-capture this student\'s photo.';
        }
        Alert.alert('Not Recognized', msg);
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
            mode: FaceDetector.FaceDetectorMode.accurate,
            detectLandmarks: FaceDetector.FaceDetectorLandmarks.all,
            runClassifications: FaceDetector.FaceDetectorClassifications.none,
            minDetectionInterval: 200,
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
                ? 'Face detected ✓ — Hold still'
                : 'Position face inside the circle'}
            </Text>
          </View>

          {/* Face positioning circle overlay */}
          {!matchedStudent && !done && (
            <View pointerEvents="none" style={ss.frameWrap}>
              <View style={[ss.frameCircle, {
                borderColor:
                  faces.length === 1 ? '#10b981' :
                  faces.length > 1 ? '#f97316' : 'rgba(255,255,255,0.85)',
              }]} />
              <Text style={ss.frameHint}>
                {faces.length === 1
                  ? '✓ Hold still — press the button below'
                  : faces.length > 1
                  ? '⚠ Only one face please'
                  : 'Align your face inside the circle'}
              </Text>
            </View>
          )}

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
  frameWrap: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  frameCircle: {
    width: 280, height: 360, borderRadius: 180,
    borderWidth: 4, borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  frameHint: {
    color: '#fff', fontSize: 13, fontWeight: '700',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 99,
    marginTop: 24,
    overflow: 'hidden',
    textAlign: 'center',
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
