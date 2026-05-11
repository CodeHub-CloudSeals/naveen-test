import React, { createContext, useState, useContext, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../firebase';

const DataContext = createContext();

export const DataProvider = ({ children, schoolId }) => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const col = collection(db, 'driving_school_students');
    const q = schoolId ? query(col, where('schoolId', '==', schoolId)) : col;

    const unsub = onSnapshot(q,
      (snap) => { setStudents(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      ()      => { setStudents([]); setLoading(false); }
    );
    return () => unsub();
  }, [schoolId]);

  const addStudent = async (s) => {
    try { await addDoc(collection(db, 'driving_school_students'), { ...s, cls: 0 }); }
    catch { setStudents(p => [...p, { ...s, id: Date.now().toString(), cls: 0 }]); }
  };

  const updateStudentFace = async (id, faceDescriptor) => {
    try { await updateDoc(doc(db, 'driving_school_students', id), { faceDescriptor }); }
    catch { setStudents(p => p.map(x => x.id === id ? { ...x, faceDescriptor } : x)); }
  };

  const markClass = async (id) => {
    const s = students.find(x => x.id === id);
    if (!s || s.cls >= 26) return;
    try { await updateDoc(doc(db, 'driving_school_students', id), { cls: s.cls + 1 }); }
    catch { setStudents(p => p.map(x => x.id === id ? { ...x, cls: x.cls + 1 } : x)); }
  };

  const collectPayment = async (id, amount) => {
    const s = students.find(x => x.id === id);
    if (!s) return;
    const paid = Math.min(s.tot, s.paid + amount);
    try { await updateDoc(doc(db, 'driving_school_students', id), { paid }); }
    catch { setStudents(p => p.map(x => x.id === id ? { ...x, paid } : x)); }
  };

  const deleteStudent = async (id) => {
    try { await deleteDoc(doc(db, 'driving_school_students', id)); }
    catch { setStudents(p => p.filter(x => x.id !== id)); }
  };

  return (
    <DataContext.Provider value={{ students, loading, addStudent, updateStudentFace, markClass, collectPayment, deleteStudent }}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => useContext(DataContext);
