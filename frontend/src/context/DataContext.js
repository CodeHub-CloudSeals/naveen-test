import React, { createContext, useState, useContext, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
const DataContext = createContext();
export const DataProvider = ({ children, schoolId }) => {
  const [students, setStudents] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    // Force loading=false after 5 seconds even if Firebase hangs
    const timeout = setTimeout(() => setLoading(false), 5000);
    const col = collection(db, 'driving_school_students');
    const q = schoolId ? query(col, where('schoolId', '==', schoolId)) : col;
    const unsub = onSnapshot(q,
      (snap) => {
        clearTimeout(timeout);
        // Filter out soft-deleted students — they stay in DB as history but
        // should not appear in the active list.
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(s => !s.deleted);
        setStudents(list);
        setLoading(false);
      },
      ()      => { clearTimeout(timeout); setStudents([]); setLoading(false); }
    );
    return () => { clearTimeout(timeout); unsub(); };
  }, [schoolId]);

  // Subscribe to payment history for revenue tracking
  useEffect(() => {
    const payCol = collection(db, 'driving_school_payments');
    const payQ = schoolId ? query(payCol, where('schoolId', '==', schoolId)) : payCol;
    const unsub = onSnapshot(payQ,
      (snap) => setPayments(snap.docs.map(d => ({ id: d.id, ...d.data() }))),
      ()      => setPayments([])
    );
    return () => unsub();
  }, [schoolId]);
  const addStudent = async (s) => {
    // Try to save to Firestore. If it fails (e.g., doc too large because the
    // face photo pushed past the 1 MiB limit), retry without the photo so the
    // student record still gets created. Re-throw so the caller can show an
    // error if everything fails.
    try {
      await addDoc(collection(db, 'driving_school_students'), { ...s, cls: 0 });
    } catch (e1) {
      console.warn('addStudent: full save failed, retrying without photo:', e1?.message || e1);
      try {
        const { faceImage, ...rest } = s;
        await addDoc(collection(db, 'driving_school_students'), { ...rest, cls: 0 });
      } catch (e2) {
        console.warn('addStudent: minimal save failed:', e2?.message || e2);
        throw e2;
      }
    }
  };
  const markClass = async (id) => {
    const s = students.find(x => x.id === id);
    if (!s || s.cls >= 26) return;
    try { await updateDoc(doc(db, 'driving_school_students', id), { cls: s.cls + 1 }); }
    catch { setStudents(p => p.map(x => x.id === id ? { ...x, cls: x.cls + 1 } : x)); }
  };
  const collectPayment = async (id, amount, collector = null) => {
    const s = students.find(x => x.id === id);
    if (!s) return;
    const paid = Math.min(s.tot, (s.paid || 0) + amount);
    const actualPaid = paid - (s.paid || 0); // amount actually applied (capped at total)
    try {
      await updateDoc(doc(db, 'driving_school_students', id), { paid });
      // Log payment history so revenue tab can show who-collected-when
      await addDoc(collection(db, 'driving_school_payments'), {
        studentId: id,
        studentName: s.name || '',
        studentPhone: s.phone || '',
        amount: actualPaid,
        collectedAt: new Date().toISOString(),
        collectorId: collector?.id || '',
        collectorName: collector?.name || 'Unknown',
        collectorRole: collector?.key || '',
        schoolId: s.schoolId || schoolId || '',
        cleared: paid >= (s.tot || 0),
      });
    } catch {
      setStudents(p => p.map(x => x.id === id ? { ...x, paid } : x));
    }
  };
  const deleteStudent = async (id) => {
    // Soft-delete: keep the student doc as DB history, but mark it deleted
    // so it disappears from the active list. Also hard-delete the matching
    // login record from driving_school_users so the phone is freed up and
    // the student can re-register if needed.
    const student = students.find(x => x.id === id);
    try {
      await updateDoc(doc(db, 'driving_school_students', id), {
        deleted: true,
        deletedAt: new Date().toISOString(),
      });
      if (student?.phone) {
        const normPhone = String(student.phone).replace(/\D/g, '').slice(-10);
        const userQ = query(
          collection(db, 'driving_school_users'),
          where('phone', '==', normPhone),
          where('key', '==', 'student')
        );
        const snap = await getDocs(userQ);
        for (const d of snap.docs) {
          const data = d.data();
          if (!schoolId || data.schoolId === schoolId) {
            await deleteDoc(doc(db, 'driving_school_users', d.id));
          }
        }
      }
    } catch {
      // Offline fallback — just remove locally
      setStudents(p => p.filter(x => x.id !== id));
    }
  };
  const updateStudentFace = async (id, faceDescriptor) => {
    try { await updateDoc(doc(db, 'driving_school_students', id), { faceDescriptor }); }
    catch { setStudents(p => p.map(x => x.id === id ? { ...x, faceDescriptor } : x)); }
  };
  // Update both face descriptor and image for an existing student
  const updateStudentPhoto = async (id, { descriptor, photo }) => {
    const patch = {};
    if (descriptor) patch.faceDescriptor = descriptor;
    if (photo) patch.faceImage = photo;
    if (!Object.keys(patch).length) return;
    try {
      await updateDoc(doc(db, 'driving_school_students', id), patch);
    } catch (e1) {
      // If too big (photo), retry with descriptor only
      if (patch.faceImage && patch.faceDescriptor) {
        try {
          await updateDoc(doc(db, 'driving_school_students', id), { faceDescriptor: patch.faceDescriptor });
        } catch (e2) {
          console.warn('updateStudentPhoto failed:', e2?.message || e2);
          throw e2;
        }
      } else {
        throw e1;
      }
    }
  };
  return (
    <DataContext.Provider value={{ students, payments, loading, addStudent, updateStudentFace, updateStudentPhoto, markClass, collectPayment, deleteStudent }}>
      {children}
    </DataContext.Provider>
  );
};
export const useData = () => useContext(DataContext);
