import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';

const PLANS = [
  {
    key: 'free',
    label: 'Free',
    price: '₹0',
    period: 'Forever',
    color: '#10b981',
    features: ['Up to 10 Students', 'Attendance Marking', 'Fee Tracking', 'Face Scan Attendance', 'Basic Reports'],
    limit: 'Up to 10 students',
  },
  {
    key: 'premium',
    label: 'Premium',
    price: '₹999',
    period: 'per month',
    color: '#f59e0b',
    features: ['Unlimited Students', 'All Free Features', 'Multiple Instructors', 'Advanced Reports', 'Priority Support'],
    limit: 'Unlimited students',
    badge: '⭐ Popular',
  },
];

export default function PaymentScreen() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(null);

  const selectPlan = async (plan) => {
    setLoading(plan.key);
    try {
      await updateDoc(doc(db, 'driving_school_users', user.id), {
        subscriptionPlan: plan.key,
        subscriptionDate: new Date().toISOString(),
      });
      await refreshUser();
    } catch (e) {
      Alert.alert('Error', 'Failed to select plan. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <View style={s.bg}>
      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        <View style={s.header}>
          <Text style={s.headerIcon}>🏫</Text>
          <Text style={s.headerTitle}>Select a Plan</Text>
          <Text style={s.headerSub}>Welcome, {user?.name || user?.email}</Text>
          <Text style={s.headerNote}>Choose a suitable plan for your school</Text>
        </View>

        {PLANS.map(plan => (
          <View key={plan.key} style={[s.card, { borderColor: plan.color }]}>
            {plan.badge && (
              <View style={[s.badge, { backgroundColor: plan.color }]}>
                <Text style={s.badgeT}>{plan.badge}</Text>
              </View>
            )}
            <View style={s.planTop}>
              <View>
                <Text style={[s.planName, { color: plan.color }]}>{plan.label}</Text>
                <Text style={s.planLimit}>{plan.limit}</Text>
              </View>
              <View style={s.priceBox}>
                <Text style={[s.price, { color: plan.color }]}>{plan.price}</Text>
                <Text style={s.period}>{plan.period}</Text>
              </View>
            </View>

            <View style={s.divider} />

            {plan.features.map(f => (
              <View key={f} style={s.feature}>
                <Text style={[s.featureDot, { color: plan.color }]}>✓</Text>
                <Text style={s.featureText}>{f}</Text>
              </View>
            ))}

            <TouchableOpacity
              style={[s.btn, { backgroundColor: plan.color }, loading && { opacity: 0.7 }]}
              onPress={() => selectPlan(plan)}
              disabled={!!loading}
            >
              {loading === plan.key
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.btnT}>
                    {plan.key === 'free' ? '✅ Start with Free' : '⭐ Select Premium'}
                  </Text>
              }
            </TouchableOpacity>
          </View>
        ))}

        <Text style={s.foot}>You can change the plan later in settings</Text>
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  bg: { flex: 1, backgroundColor: '#0f2044' },
  scroll: { padding: 20, paddingTop: 60, paddingBottom: 40 },
  header: { alignItems: 'center', marginBottom: 28 },
  headerIcon: { fontSize: 48, marginBottom: 8 },
  headerTitle: { fontSize: 24, fontWeight: '900', color: '#fff', marginBottom: 4 },
  headerSub: { fontSize: 14, color: '#60a5fa', marginBottom: 4, fontWeight: '700' },
  headerNote: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
  card: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 2 },
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, marginBottom: 12 },
  badgeT: { color: '#fff', fontSize: 11, fontWeight: '800' },
  planTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  planName: { fontSize: 20, fontWeight: '900' },
  planLimit: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  priceBox: { alignItems: 'flex-end' },
  price: { fontSize: 28, fontWeight: '900' },
  period: { fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 14 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  featureDot: { fontSize: 14, fontWeight: '900', width: 18 },
  featureText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  btn: { borderRadius: 14, padding: 15, alignItems: 'center', marginTop: 16 },
  btnT: { color: '#fff', fontSize: 15, fontWeight: '900' },
  foot: { textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 8 },
});
