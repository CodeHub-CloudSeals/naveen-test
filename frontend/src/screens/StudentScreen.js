import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { openUpi } from '../utils/payment';

const TC = 26;
const fmt = d => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function StudentScreen() {
  const { logout, user } = useAuth();
  const { students } = useData();
  const [tab, setTab] = useState('home');
  const [schoolOwner, setSchoolOwner] = useState(null);
  const s = students.find(st => st.phone === user?.phone) || null;

  // Fetch school owner's UPI ID (for payments)
  useEffect(() => {
    if (!user?.schoolId) return;
    (async () => {
      try {
        const q = query(
          collection(db, 'driving_school_users'),
          where('schoolId', '==', user.schoolId),
          where('key', '==', 'school')
        );
        const snap = await getDocs(q);
        if (!snap.empty) setSchoolOwner({ id: snap.docs[0].id, ...snap.docs[0].data() });
      } catch (e) {
        console.warn('Failed to fetch school owner UPI:', e?.message);
      }
    })();
  }, [user?.schoolId]);
  if (!s) return (
    <View style={{ flex: 1, backgroundColor: '#0f2044', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 16, marginBottom: 8 }}>Your student record was not found.</Text>
      <Text style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Please contact your school owner.</Text>
      <TouchableOpacity onPress={logout} style={{ marginTop: 20, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>Logout</Text>
      </TouchableOpacity>
    </View>
  );

  const pct = Math.round(s.cls / TC * 100);
  const bal = s.tot - s.paid;
  const dl = new Date(s.adm); dl.setDate(dl.getDate() + 45);
  const daysLeft = Math.max(0, Math.ceil((dl - new Date()) / 86400000));

  const TABS = [['home','🏠','Home'],['classes','📅','Classes'],['fees','💰','Fees'],['license','🪪','License']];

  return (
    <View style={st.container}>
      <View style={st.hdr}>
        <View style={st.hdrRow}>
          <View style={{flexDirection:'row',alignItems:'center'}}>
            <View style={st.av}><Text style={{fontSize:18,fontWeight:'900',color:'#fff'}}>{s.name[0]}</Text></View>
            <View style={{marginLeft:10}}>
              <Text style={st.un}>{s.name}</Text>
              <Text style={st.ur}>{user?.schoolName || ''}{s.cardNo ? ` · Card #${s.cardNo}` : ''}</Text>
            </View>
          </View>
          <TouchableOpacity style={st.lout} onPress={logout}><Text style={st.loutT}>Logout</Text></TouchableOpacity>
        </View>
        <View style={st.badge}><Text style={st.badgeT}>🎓 Student — Personal Data Only</Text></View>
      </View>

      <ScrollView style={st.body} contentContainerStyle={{paddingBottom:120}} showsVerticalScrollIndicator={false}>
        {/* HOME */}
        {tab==='home' && (
          <View>
            {bal>0&&<View style={st.alertW}><Text style={{fontSize:18}}>💸</Text><View><Text style={st.alertT}>Balance Pending</Text><Text style={st.alertM}>₹{bal.toLocaleString()} due. Pay within 5 days.</Text></View></View>}
            <View style={st.hero}>
              <Text style={{fontSize:12,color:'rgba(255,255,255,0.7)',marginBottom:7}}>Classes Completed</Text>
              <Text style={{fontSize:50,fontWeight:'900',color:'#fff',lineHeight:54}}>{s.cls}<Text style={{fontSize:20,opacity:0.5}}>/{TC}</Text></Text>
              <View style={st.progBg}><View style={[st.progFill,{width:pct+'%'}]}/></View>
              <Text style={{fontSize:11,color:'rgba(255,255,255,0.6)',marginTop:7}}>{TC-s.cls} remaining · {daysLeft} days left</Text>
            </View>
            <Text style={st.sec}>📋 My Details</Text>
            <View style={st.card}>
              {[['Name',s.name],['Vehicle',s.veh],['Slot',s.slot],['Admission',fmt(s.adm)],['Deadline',fmt(dl.toISOString().split('T')[0])]].map(([l,v])=>(
                <View key={l} style={st.ir}><Text style={st.il}>{l}</Text><Text style={st.iv}>{v}</Text></View>
              ))}
            </View>
          </View>
        )}

        {/* CLASSES */}
        {tab==='classes' && (
          <View>
            <View style={st.ringWrap}>
              <View style={[st.ring,{background:'conic-gradient(#10b981 '+pct*3.6+'deg, #e2e8f0 '+pct*3.6+'deg)'}]}>
                <View style={st.ringInner}>
                  <Text style={st.ringNum}>{s.cls}</Text>
                  <Text style={st.ringLbl}>Done</Text>
                </View>
              </View>
              <Text style={st.ringSub}>{s.cls} of {TC} completed ({pct}%)</Text>
            </View>
            <Text style={st.sec}>📅 Class History</Text>
            <View style={st.card}>
              {Array.from({length:TC},(_,i)=>{
                const done=i<s.cls;
                const d=new Date(new Date(s.adm).getTime()+Math.floor(i*1.5)*86400000);
                return (
                  <View key={i} style={st.clsRow}>
                    <View style={[st.clsNum,done&&st.clsNumDone]}><Text style={{color:done?'#fff':'#94a3b8',fontSize:12,fontWeight:'900'}}>{i+1}</Text></View>
                    <View style={{flex:1}}>
                      <Text style={{fontSize:13,fontWeight:'700'}}>{done?'Class '+(i+1)+' Completed':'Class '+(i+1)+' Pending'}</Text>
                      <Text style={{fontSize:11,color:'#94a3b8'}}>{done?fmt(d.toISOString().split('T')[0])+' · '+s.slot:'Not yet'}</Text>
                    </View>
                    <Text style={{fontSize:18}}>{done?'✅':'⏳'}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* FEES */}
        {tab==='fees' && (
          <View>
            <Text style={st.sec}>💰 My Fees</Text>
            <View style={st.card}>
              <View style={{alignItems:'center',paddingVertical:14}}>
                <View style={{width:90,height:90,borderRadius:45,backgroundColor:'#f0fdf4',alignItems:'center',justifyContent:'center',marginBottom:10}}>
                  <Text style={{fontSize:20,fontWeight:'900',color:'#0f2044'}}>{Math.round(s.paid/s.tot*100)}%</Text>
                  <Text style={{fontSize:10,color:'#94a3b8'}}>Paid</Text>
                </View>
              </View>
              <View style={{flexDirection:'row',gap:9,marginBottom:12}}>
                <View style={{flex:1,backgroundColor:'#f0fdf4',borderRadius:13,padding:12,alignItems:'center'}}>
                  <Text style={{fontSize:18,fontWeight:'900',color:'#16a34a'}}>₹{s.paid.toLocaleString()}</Text>
                  <Text style={{fontSize:10,color:'#16a34a',fontWeight:'600'}}>Paid ✓</Text>
                </View>
                <View style={{flex:1,backgroundColor:bal>0?'#fff1f2':'#f0fdf4',borderRadius:13,padding:12,alignItems:'center'}}>
                  <Text style={{fontSize:18,fontWeight:'900',color:bal>0?'#dc2626':'#16a34a'}}>₹{bal.toLocaleString()}</Text>
                  <Text style={{fontSize:10,color:bal>0?'#dc2626':'#16a34a',fontWeight:'600'}}>{bal>0?'Balance Due':'All Clear ✓'}</Text>
                </View>
              </View>
              {[['Total Fee','₹'+s.tot.toLocaleString()],['Paid','₹'+s.paid.toLocaleString()],['Balance','₹'+bal.toLocaleString()]].map(([l,v])=>(
                <View key={l} style={st.ir}><Text style={st.il}>{l}</Text><Text style={st.iv}>{v}</Text></View>
              ))}
            </View>

            {/* PAY NOW SECTION */}
            {bal > 0 && (
              <View>
                <Text style={st.sec}>💳 Pay ₹{bal.toLocaleString()} Now</Text>
                {schoolOwner?.upiId ? (
                  <View style={st.card}>
                    <Text style={{fontSize:11,color:'#64748b',marginBottom:8}}>
                      Pay to: <Text style={{fontWeight:'800',color:'#0f2044'}}>{schoolOwner.upiName || schoolOwner.schoolName || 'Driving School'}</Text>
                    </Text>
                    <Text style={{fontSize:11,color:'#64748b',marginBottom:12}}>
                      UPI ID: <Text style={{fontWeight:'800',color:'#0f2044'}}>{schoolOwner.upiId}</Text>
                    </Text>

                    {/* Full balance button — opens UPI app chooser */}
                    <TouchableOpacity
                      style={{backgroundColor:'#10b981',padding:14,borderRadius:14,alignItems:'center',marginBottom:8}}
                      onPress={() => openUpi({
                        upiId: schoolOwner.upiId,
                        payeeName: schoolOwner.upiName || schoolOwner.schoolName,
                        amount: bal,
                        note: `Fee for ${s.name} (${s.phone})`,
                      })}
                    >
                      <Text style={{color:'#fff',fontSize:15,fontWeight:'900'}}>💰 Pay ₹{bal.toLocaleString()} via UPI</Text>
                      <Text style={{color:'rgba(255,255,255,0.85)',fontSize:11,marginTop:3}}>GPay / PhonePe / Paytm / BHIM</Text>
                    </TouchableOpacity>

                    {/* App-specific shortcuts */}
                    <Text style={{fontSize:10,color:'#94a3b8',fontWeight:'700',textAlign:'center',marginTop:6,marginBottom:8,textTransform:'uppercase',letterSpacing:1}}>or pay with</Text>
                    <View style={{flexDirection:'row',gap:8,flexWrap:'wrap'}}>
                      {[
                        { key: 'gpay',    label: '🟢 Google Pay', bg: '#1a73e8' },
                        { key: 'phonepe', label: '🟣 PhonePe',    bg: '#5f259f' },
                        { key: 'paytm',   label: '🔵 Paytm',      bg: '#00baf2' },
                        { key: 'bhim',    label: '🟠 BHIM',       bg: '#ea580c' },
                      ].map(app => (
                        <TouchableOpacity
                          key={app.key}
                          style={{flex:1,minWidth:'45%',backgroundColor:app.bg,paddingVertical:11,borderRadius:11,alignItems:'center'}}
                          onPress={() => openUpi({
                            upiId: schoolOwner.upiId,
                            payeeName: schoolOwner.upiName || schoolOwner.schoolName,
                            amount: bal,
                            note: `Fee for ${s.name}`,
                          }, app.key)}
                        >
                          <Text style={{color:'#fff',fontSize:12,fontWeight:'800'}}>{app.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={{fontSize:10,color:'#94a3b8',marginTop:12,textAlign:'center'}}>
                      After payment, your school owner will confirm and update your fee status.
                    </Text>
                  </View>
                ) : (
                  <View style={[st.card, {backgroundColor:'#fff7ed',borderWidth:1,borderColor:'#fed7aa'}]}>
                    <Text style={{fontSize:13,color:'#9a3412',fontWeight:'700',marginBottom:6}}>⚠️ Online payment not available yet</Text>
                    <Text style={{fontSize:11,color:'#9a3412'}}>School owner has not added their UPI ID. Please pay in person or contact support.</Text>
                  </View>
                )}
              </View>
            )}

            <TouchableOpacity style={st.card} onPress={()=>Linking.openURL('https://wa.me/919000300256?text=Hello+Driving School+Support!')}>
              <Text style={{fontSize:13,fontWeight:'800',color:'#0f2044'}}>💬 Chat with Support on WhatsApp</Text>
              <Text style={{fontSize:11,color:'#64748b',marginTop:4}}>📞 9000 300 256 · Available 9AM-6PM</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* LICENSE */}
        {tab==='license' && (
          <View>
            <View style={[st.licCard,{backgroundColor:'#0f2044'}]}>
              <Text style={st.licT}>🪪 Learning Licence</Text>
              {[['LL Number',s.ll||'Not added'],['Expiry',fmt(s.lle)],['Status',s.lle?'Valid':'Not Added']].map(([l,v])=>(
                <View key={l} style={st.licR}><Text style={st.licL}>{l}</Text><Text style={st.licV}>{v}</Text></View>
              ))}
            </View>
            <View style={[st.licCard,{backgroundColor:'#064e3b'}]}>
              <Text style={st.licT}>🚗 Driving Licence</Text>
              {[['DL Number',s.dl||'Not issued'],['Test Date',fmt(s.test)],['Status',s.dl?'Issued':'Pending Test']].map(([l,v])=>(
                <View key={l} style={st.licR}><Text style={st.licL}>{l}</Text><Text style={st.licV}>{v}</Text></View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      <View style={st.bnav}>
        {TABS.map(([key,icon,label])=>(
          <TouchableOpacity key={key} style={st.nb} onPress={()=>setTab(key)}>
            <Text style={[st.ni,tab===key&&st.niActive]}>{icon}</Text>
            <Text style={[st.nl,tab===key&&st.nlActive]}>{label}</Text>
            {tab===key&&<View style={st.nd}/>}
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  container:{flex:1,backgroundColor:'#f1f5f9'},
  hdr:{backgroundColor:'#0f2044',padding:18,paddingTop:50},
  hdrRow:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  av:{width:42,height:42,borderRadius:13,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
  un:{fontSize:15,fontWeight:'900',color:'#fff'},
  ur:{fontSize:10,color:'rgba(255,255,255,0.6)',marginTop:2},
  lout:{backgroundColor:'rgba(255,255,255,0.15)',paddingHorizontal:12,paddingVertical:7,borderRadius:11},
  loutT:{color:'#fff',fontSize:11,fontWeight:'700'},
  badge:{backgroundColor:'rgba(167,139,250,0.2)',paddingHorizontal:12,paddingVertical:4,borderRadius:99,alignSelf:'flex-start',marginTop:10},
  badgeT:{color:'#a78bfa',fontSize:10,fontWeight:'800'},
  body:{padding:14,marginBottom:60},
  sec:{fontSize:10,fontWeight:'800',color:'#94a3b8',textTransform:'uppercase',letterSpacing:1,marginTop:14,marginBottom:7},
  card:{backgroundColor:'#fff',borderRadius:18,padding:14,marginBottom:10,shadowColor:'#000',shadowOpacity:0.06,shadowRadius:4,elevation:2},
  alertW:{flexDirection:'row',gap:10,backgroundColor:'#fffbeb',borderWidth:1,borderColor:'#fde68a',borderRadius:15,padding:12,marginBottom:9,alignItems:'flex-start'},
  alertT:{fontSize:12,fontWeight:'800',color:'#92400e'},
  alertM:{fontSize:11,color:'#b45309',marginTop:1},
  hero:{backgroundColor:'#1e4d8c',borderRadius:18,padding:20,marginBottom:4,alignItems:'center'},
  progBg:{height:8,backgroundColor:'rgba(255,255,255,0.2)',borderRadius:99,overflow:'hidden',marginTop:12,width:'100%'},
  progFill:{height:'100%',backgroundColor:'#10b981',borderRadius:99},
  ir:{flexDirection:'row',justifyContent:'space-between',paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#f8fafc'},
  il:{fontSize:11,color:'#94a3b8',fontWeight:'600'},
  iv:{fontSize:13,fontWeight:'700',color:'#0f172a'},
  ringWrap:{alignItems:'center',paddingVertical:20},
  ring:{width:110,height:110,borderRadius:55,backgroundColor:'#e2e8f0',alignItems:'center',justifyContent:'center'},
  ringInner:{width:84,height:84,borderRadius:42,backgroundColor:'#fff',alignItems:'center',justifyContent:'center'},
  ringNum:{fontSize:26,fontWeight:'900',color:'#0f2044'},
  ringLbl:{fontSize:10,color:'#94a3b8',fontWeight:'600',marginTop:2},
  ringSub:{fontSize:12,color:'#64748b',marginTop:10,fontWeight:'600'},
  clsRow:{flexDirection:'row',alignItems:'center',gap:9,paddingVertical:9,borderBottomWidth:1,borderBottomColor:'#f8fafc'},
  clsNum:{width:34,height:34,borderRadius:11,backgroundColor:'#f1f5f9',alignItems:'center',justifyContent:'center'},
  clsNumDone:{backgroundColor:'#0f2044'},
  licCard:{borderRadius:18,padding:18,marginBottom:10},
  licT:{fontSize:10,fontWeight:'800',color:'rgba(255,255,255,0.6)',textTransform:'uppercase',letterSpacing:1,marginBottom:10},
  licR:{flexDirection:'row',justifyContent:'space-between',paddingVertical:7,borderBottomWidth:1,borderBottomColor:'rgba(255,255,255,0.12)'},
  licL:{fontSize:11,color:'rgba(255,255,255,0.6)',fontWeight:'600'},
  licV:{fontSize:12,fontWeight:'800',color:'#fff'},
  bnav:{position:'absolute',bottom:0,left:0,right:0,backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#e2e8f0',flexDirection:'row',shadowColor:'#000',shadowOpacity:0.08,shadowRadius:4,elevation:8},
  nb:{flex:1,alignItems:'center',justifyContent:'center',paddingVertical:9,gap:3},
  ni:{fontSize:20,opacity:0.28},
  niActive:{opacity:1},
  nl:{fontSize:10,fontWeight:'700',color:'#94a3b8'},
  nlActive:{color:'#0f2044'},
  nd:{width:15,height:2.5,backgroundColor:'#0f2044',borderRadius:99},
});
