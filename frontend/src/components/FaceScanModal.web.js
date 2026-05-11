import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';

export default function FaceScanModal({ visible, onClose }) {
  if (!visible) return null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={st.center}>
        <Text style={{ fontSize: 50, marginBottom: 16 }}>📱</Text>
        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0f2044', marginBottom: 8, textAlign: 'center' }}>
          Face Scan — Mobile App Only
        </Text>
        <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', marginBottom: 32, paddingHorizontal: 24 }}>
          Face recognition works only in the Android/iOS app. Camera is not available in the web browser.
        </Text>
        <TouchableOpacity style={st.btn} onPress={onClose}>
          <Text style={st.btnT}>Close</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff', padding: 24 },
  btn: { backgroundColor: '#0f2044', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 40 },
  btnT: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
