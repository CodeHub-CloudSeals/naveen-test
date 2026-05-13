// UPI deep link payment helpers.
// `upi://pay?...` is the universal scheme — when opened, Android shows a chooser
// of all installed UPI apps (GPay, PhonePe, Paytm, BHIM, Amazon Pay, etc.).
//
// We also expose explicit app-specific helpers so the UI can offer one-tap
// buttons for popular apps in addition to the generic chooser.

import { Linking, Alert } from 'react-native';

const safe = (s) => encodeURIComponent(String(s || '').trim());

/**
 * Build a generic UPI deep link.
 * @param {Object} p - { upiId, payeeName, amount, note }
 * @returns {string} upi://pay?... link
 */
export const buildUpiLink = ({ upiId, payeeName, amount, note }) => {
  const params = [
    `pa=${safe(upiId)}`,
    `pn=${safe(payeeName || 'Driving School')}`,
    `am=${safe(amount)}`,
    `cu=INR`,
    `tn=${safe(note || 'Driving School Fee')}`,
  ].join('&');
  return `upi://pay?${params}`;
};

const baseQuery = (p) => [
  `pa=${safe(p.upiId)}`,
  `pn=${safe(p.payeeName || 'Driving School')}`,
  `am=${safe(p.amount)}`,
  `cu=INR`,
  `tn=${safe(p.note || 'Driving School Fee')}`,
].join('&');

// App-specific deep links — fall back to upi:// if the specific app is not installed.
export const buildAppLinks = (p) => ({
  generic:  `upi://pay?${baseQuery(p)}`,
  gpay:     `tez://upi/pay?${baseQuery(p)}`,
  phonepe:  `phonepe://pay?${baseQuery(p)}`,
  paytm:    `paytmmp://pay?${baseQuery(p)}`,
  bhim:     `bhim://upi/pay?${baseQuery(p)}`,
});

/**
 * Open a UPI link. Falls back to the generic chooser on failure.
 */
export const openUpi = async ({ upiId, payeeName, amount, note }, preferredApp = 'generic') => {
  if (!upiId) {
    Alert.alert('UPI Not Set Up', 'School owner has not added a UPI ID yet. Please contact the school.');
    return false;
  }
  if (!amount || amount <= 0) {
    Alert.alert('Invalid Amount', 'Amount must be greater than 0.');
    return false;
  }
  const links = buildAppLinks({ upiId, payeeName, amount, note });
  const tryOrder = [preferredApp, 'generic', 'gpay', 'phonepe', 'paytm', 'bhim'];
  for (const k of tryOrder) {
    const url = links[k];
    if (!url) continue;
    try {
      const can = await Linking.canOpenURL(url);
      if (can) {
        await Linking.openURL(url);
        return true;
      }
    } catch {}
  }
  // Last resort — directly try the generic upi:// URL (some Android builds
  // return canOpenURL=false but actually open fine when invoked)
  try {
    await Linking.openURL(links.generic);
    return true;
  } catch (e) {
    Alert.alert(
      'No UPI App Found',
      'Please install a UPI app like Google Pay, PhonePe, Paytm or BHIM to make a payment.'
    );
    return false;
  }
};
