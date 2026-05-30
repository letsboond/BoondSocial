// src/components/ProfileView.js

const ConnectionButton = ({ targetProfile, currentUser, db, lang, getIcon }) => {
    const [status, setStatus] = React.useState('loading'); // 'loading' | 'none' | 'pending' | 'connected'

    React.useEffect(() => {
        if (!currentUser || !targetProfile?.uid) {
            setStatus('none');
            return;
        }

        const checkStatus = async () => {
            try {
                // 1. Check if already connected
                const connRef = db.collection('users').doc(currentUser.uid).collection('connections').doc(targetProfile.uid);
                const connDoc = await connRef.get();
                if (connDoc.exists) {
                    setStatus('connected');
                    return;
                }

                // 2. Check if request pending (Sender: currentUser, Receiver: targetProfile)
                // We check target's 'requests' collection for a doc with ID = currentUser.uid
                // (Assuming we use senderUID as doc ID for uniqueness)
                const reqRef = db.collection('users').doc(targetProfile.uid).collection('requests').doc(currentUser.uid);
                const reqDoc = await reqRef.get(); // Requires security rule: allow read if request.auth.uid == resource.data.fromUid OR public read on requests?
                // If we can't read target's subcollection directly due to rules, we rely on optimistic UI or open rules.
                // Assuming we can read provided we wrote it.
                if (reqDoc.exists) {
                    setStatus('pending');
                    return;
                }

                setStatus('none');
            } catch (err) {
                console.error("Connection Check Error:", err);
                setStatus('none'); // Default to allowing request
            }
        };

        checkStatus();
    }, [currentUser, targetProfile]);

    const handleSendRequest = async () => {
        if (!currentUser) return alert(lang === 'id' ? "Login dulu!" : "Login first!");

        try {
            setStatus('pending'); // Optimistic

            // AUTO-CONNECT LOGIC: Check if THEY already have ME
            const reverseConnRef = db.collection('users').doc(targetProfile.uid).collection('connections').doc(currentUser.uid);
            const reverseConnDoc = await reverseConnRef.get();

            // Derive Role/Bio/Name from Global Store (more complete than Auth object)
            const globalUser = window.currentUser || {};
            const userBio = globalUser.bio || globalUser.role || "Boond User";
            const userName = globalUser.displayName || currentUser.displayName || "User";
            const userUsername = globalUser.username || currentUser.username || "@user";
            const userAvatar = globalUser.avatar || currentUser.photoURL || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + currentUser.uid;

            // New Demographics
            const userAge = globalUser.age || "";
            const userGender = globalUser.gender || "";

            if (reverseConnDoc.exists) {
                // THEY have ME. So I can auto-connect!
                await db.collection('users').doc(currentUser.uid).collection('connections').doc(targetProfile.uid).set({
                    uid: targetProfile.uid,
                    displayName: targetProfile.displayName || targetProfile.name || "User",
                    username: targetProfile.username || "@user",
                    avatar: targetProfile.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + targetProfile.uid,
                    role: targetProfile.bio || "Connection",
                    savedAt: new Date(),
                    age: targetProfile.age || "",
                    gender: targetProfile.gender || "",
                    isCommunity: targetProfile.isCommunity || false,
                    communityCategory: targetProfile.communityCategory || ""
                });
                setStatus('connected');
                alert(lang === 'id' ? "Langsung Terhubung! (Kalian sekarang berteman)" : "Instantly Connected! (You are now friends)");
                return;
            }

            // Normal Flow: Send Request
            await db.collection('users').doc(targetProfile.uid).collection('requests').doc(currentUser.uid).set({
                fromUid: currentUser.uid,
                fromName: userName,
                fromUsername: userUsername,
                fromAvatar: userAvatar,
                fromRole: userBio,
                fromAge: userAge,
                fromGender: userGender,
                timestamp: new Date()
            });

            alert(lang === 'id' ? "Permintaan kontak terkirim!" : "Connection request sent!");
        } catch (err) {
            console.error("Request Error:", err);
            setStatus('none');
            alert("Failed: " + err.message);
        }
    };

    if (status === 'loading') return <div className="w-full py-3 bg-slate-100 rounded-xl animate-pulse"></div>;

    if (status === 'connected') {
        return (
            <button disabled className="w-full bg-green-500 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 opacity-90 cursor-default mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                {lang === 'id' ? 'Terhubung' : 'Connected'}
            </button>
        );
    }

    if (status === 'pending') {
        return (
            <button disabled className="w-full bg-yellow-400 text-white py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 opacity-90 cursor-default mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                {lang === 'id' ? 'Menunggu Konfirmasi' : 'Request Pending'}
            </button>
        );
    }

    return (
        <button
            onClick={handleSendRequest}
            className="w-full bg-blue-600 text-white py-3.5 rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 transform active:scale-95 shadow-xl shadow-blue-600/20 mb-4 animate-pulse"
        >
            {getIcon('download', 'w-4 h-4')}
            {lang === 'id' ? 'Simpan Kontak' : 'Save Contact'}
        </button>
    );
};


// Helper for Timer
const getTimeLeft = (until) => {
    if (!until) return 0;
    const now = new Date();
    const end = until.toDate ? until.toDate() : new Date(until); // Handle Firestore Timestamp
    const diff = Math.floor((end - now) / 1000);
    return diff > 0 ? diff : 0;
};

const formatTimeLeft = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
};

const PrivacyControlPanel = ({ profile, currentUser, db, lang }) => {
    const [mode, setMode] = React.useState(profile.accessMode || 'public'); // private, public, timed
    const [timer, setTimer] = React.useState(0);

    // Timer Effect
    React.useEffect(() => {
        if (mode === 'timed' && profile.accessUntil) {
            const interval = setInterval(() => {
                const left = getTimeLeft(profile.accessUntil);
                setTimer(left);
                if (left <= 0) {
                    // Optimistic revert to private visuals until DB update reflects
                }
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [mode, profile.accessUntil]);

    const updateMode = async (newMode) => {
        // Optimistic Update
        setMode(newMode);

        let updateData = { accessMode: newMode };

        if (newMode === 'timed') {
            const until = new Date();
            until.setMinutes(until.getMinutes() + 5); // 5 Minutes
            updateData.accessUntil = until;
        } else {
            updateData.accessUntil = null; // Clear timer
        }

        try {
            await db.collection('users').doc(currentUser.uid).update(updateData);
        } catch (err) {
            console.error("Privacy Update Error", err);
            alert("Failed to update privacy.");
            setMode(profile.accessMode || 'private'); // Revert
        }
    };

    return (
        <div className="w-full bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-slate-700">{lang === 'id' ? 'Kontrol Privasi Link' : 'Link Privacy Control'}</h3>
                <div className="text-xs font-medium text-slate-500">
                    {mode === 'private' && (lang === 'id' ? '🔒 Terkunci' : '🔒 Locked')}
                    {mode === 'public' && (lang === 'id' ? '🌍 Publik' : '🌍 Public')}
                    {mode === 'timed' && (timer > 0 ? `⚡ ${formatTimeLeft(timer)}` : (lang === 'id' ? '🔒 Habis' : '🔒 Expired'))}
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <button
                    onClick={() => updateMode('private')}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition ${mode === 'private' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><rect width="18" height="11" x="3" y="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                    <span className="text-[10px] font-bold">{lang === 'id' ? 'Privat' : 'Private'}</span>
                </button>

                <button
                    onClick={() => updateMode('timed')}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition ${mode === 'timed' ? 'bg-yellow-400 text-slate-900 border-yellow-400' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" /></svg>
                    <span className="text-[10px] font-bold">5 Mins</span>
                </button>

                <button
                    onClick={() => updateMode('public')}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl border transition ${mode === 'public' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-1"><circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                    <span className="text-[10px] font-bold">{lang === 'id' ? 'Publik' : 'Public'}</span>
                </button>
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────
// AVATAR CROPPER MODAL
// Drag to pan, scroll/pinch to zoom, 1:1 crop guide
// ─────────────────────────────────────────────
const AvatarCropperModal = ({ src, lang, onConfirm, onCancel }) => {
    const { useEffect, useRef, useState } = React;
    const canvasRef = useRef(null);
    const stateRef = useRef({
        scale: 1, minScale: 1,
        offsetX: 0, offsetY: 0,
        dragging: false,
        lastX: 0, lastY: 0,
        lastDist: 0,
        imgW: 0, imgH: 0,
        canvasSize: 220,
        imgEl: null,
    });
    const [ready, setReady] = useState(false);

    const drawCanvas = () => {
        const s = stateRef.current;
        const canvas = canvasRef.current;
        if (!canvas || !s.imgEl) return;
        const cs = s.canvasSize;
        const ctx = canvas.getContext('2d');

        ctx.clearRect(0, 0, cs, cs);

        // Draw image
        ctx.save();
        ctx.drawImage(s.imgEl, s.offsetX, s.offsetY, s.imgW * s.scale, s.imgH * s.scale);
        ctx.restore();

        // Dark overlay outside crop circle
        ctx.save();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, 0, cs, cs);
        // Cut out circle
        ctx.globalCompositeOperation = 'destination-out';
        ctx.beginPath();
        ctx.arc(cs / 2, cs / 2, cs / 2 - 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // Border ring
        ctx.save();
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(cs / 2, cs / 2, cs / 2 - 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // Grid lines (rule of thirds)
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cs / 2, cs / 2, cs / 2 - 4, 0, Math.PI * 2);
        ctx.clip();
        [cs/3, cs*2/3].forEach(x => {
            ctx.moveTo(x, 0); ctx.lineTo(x, cs);
        });
        [cs/3, cs*2/3].forEach(y => {
            ctx.moveTo(0, y); ctx.lineTo(cs, y);
        });
        ctx.stroke();
        ctx.restore();
    };

    const clampOffset = (s) => {
        const cs = s.canvasSize;
        const iw = s.imgW * s.scale;
        const ih = s.imgH * s.scale;
        s.offsetX = Math.min(0, Math.max(s.offsetX, cs - iw));
        s.offsetY = Math.min(0, Math.max(s.offsetY, cs - ih));
    };

    useEffect(() => {
        const img = new Image();
        img.onload = () => {
            const s = stateRef.current;
            const cs = s.canvasSize;
            const scaleW = cs / img.naturalWidth;
            const scaleH = cs / img.naturalHeight;
            const initScale = Math.max(scaleW, scaleH);
            s.imgEl = img;
            s.imgW = img.naturalWidth;
            s.imgH = img.naturalHeight;
            s.scale = initScale;
            s.minScale = initScale;
            // Center
            s.offsetX = (cs - img.naturalWidth * initScale) / 2;
            s.offsetY = (cs - img.naturalHeight * initScale) / 2;
            clampOffset(s);
            setReady(true);
        };
        img.src = src;
    }, [src]);

    useEffect(() => {
        if (ready) drawCanvas();
    }, [ready]);

    // Mouse events
    const onMouseDown = (e) => {
        stateRef.current.dragging = true;
        stateRef.current.lastX = e.clientX;
        stateRef.current.lastY = e.clientY;
    };
    const onMouseMove = (e) => {
        const s = stateRef.current;
        if (!s.dragging) return;
        s.offsetX += e.clientX - s.lastX;
        s.offsetY += e.clientY - s.lastY;
        s.lastX = e.clientX;
        s.lastY = e.clientY;
        clampOffset(s);
        drawCanvas();
    };
    const onMouseUp = () => { stateRef.current.dragging = false; };

    const onWheel = (e) => {
        e.preventDefault();
        const s = stateRef.current;
        const cs = s.canvasSize;
        const delta = e.deltaY < 0 ? 1.08 : 0.93;
        const newScale = Math.max(s.minScale, s.scale * delta);
        const cx = cs / 2, cy = cs / 2;
        s.offsetX = cx - (cx - s.offsetX) * (newScale / s.scale);
        s.offsetY = cy - (cy - s.offsetY) * (newScale / s.scale);
        s.scale = newScale;
        clampOffset(s);
        drawCanvas();
    };

    // Touch events
    const onTouchStart = (e) => {
        const s = stateRef.current;
        if (e.touches.length === 1) {
            s.dragging = true;
            s.lastX = e.touches[0].clientX;
            s.lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            s.dragging = false;
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            s.lastDist = Math.hypot(dx, dy);
        }
    };
    const onTouchMove = (e) => {
        e.preventDefault();
        const s = stateRef.current;
        if (e.touches.length === 1 && s.dragging) {
            s.offsetX += e.touches[0].clientX - s.lastX;
            s.offsetY += e.touches[0].clientY - s.lastY;
            s.lastX = e.touches[0].clientX;
            s.lastY = e.touches[0].clientY;
            clampOffset(s);
            drawCanvas();
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const delta = dist / s.lastDist;
            const cs = s.canvasSize;
            const cx = cs / 2, cy = cs / 2;
            const newScale = Math.max(s.minScale, s.scale * delta);
            s.offsetX = cx - (cx - s.offsetX) * (newScale / s.scale);
            s.offsetY = cy - (cy - s.offsetY) * (newScale / s.scale);
            s.scale = newScale;
            s.lastDist = dist;
            clampOffset(s);
            drawCanvas();
        }
    };
    const onTouchEnd = () => { stateRef.current.dragging = false; };

    const handleConfirm = () => {
        const s = stateRef.current;
        const cs = s.canvasSize;
        // Draw only the circle region to output canvas
        const out = document.createElement('canvas');
        out.width = cs; out.height = cs;
        const octx = out.getContext('2d');
        if (s.imgEl) {
            octx.drawImage(s.imgEl, s.offsetX, s.offsetY, s.imgW * s.scale, s.imgH * s.scale);
        }
        out.toBlob((blob) => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.9);
    };

    const modalContent = (
        <div
            style={{ position: 'fixed', inset: 0, zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
            onClick={onCancel}
        >
            <div
                style={{ background: '#0f172a', borderRadius: '24px', padding: '16px', width: '100%', maxWidth: '300px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)' }}
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div>
                        <h3 style={{ color: 'white', fontSize: '14px', fontWeight: 700, margin: 0 }}>{lang === 'id' ? 'Sesuaikan Foto' : 'Crop Photo'}</h3>
                        <p style={{ color: '#64748b', fontSize: '10px', margin: '2px 0 0' }}>{lang === 'id' ? 'Geser & cubit untuk atur posisi' : 'Drag & pinch to adjust'}</p>
                    </div>
                    <button onClick={onCancel} style={{ width: 28, height: 28, borderRadius: '50%', background: '#1e293b', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                {/* Canvas */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
                    <canvas
                        ref={canvasRef}
                        width={220}
                        height={220}
                        className="touch-none cursor-move"
                        style={{ background: '#111', borderRadius: '50%', width: 220, height: 220, display: 'block' }}
                        onMouseDown={onMouseDown}
                        onMouseMove={onMouseMove}
                        onMouseUp={onMouseUp}
                        onMouseLeave={onMouseUp}
                        onWheel={onWheel}
                        onTouchStart={onTouchStart}
                        onTouchMove={onTouchMove}
                        onTouchEnd={onTouchEnd}
                    />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                        onClick={onCancel}
                        style={{ flex: 1, padding: '10px', borderRadius: '12px', border: '1px solid #475569', background: 'transparent', color: '#cbd5e1', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                    >
                        {lang === 'id' ? 'Batal' : 'Cancel'}
                    </button>
                    <button
                        onClick={handleConfirm}
                        style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: '#2563eb', color: 'white', fontWeight: 700, fontSize: '14px', cursor: 'pointer' }}
                    >
                        {lang === 'id' ? 'Pakai' : 'Use'}
                    </button>
                </div>
            </div>
        </div>
    );

    return ReactDOM.createPortal(modalContent, document.body);
};


const ProfileView = ({ profile, isEmbedded = false, isOwner = false, onNavigate, t, lang, setLang, onLogout }) => {
    const { motion, AnimatePresence } = window.Motion;
    const { useEffect, useState, useRef } = React;
    const { QRCode, CommunityFeed } = window;

    // --- Direct Link Redirect Logic REMOVED (2025-01-29) ---
    // User requested to remove software-side redirect feature.
    // This component now strictly serves as a Hardware Writer interface.

    // Load Lucide Icons - re-run when relevant data changes
    useEffect(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, [profile, isEmbedded, isEditing, formData, showQR]);



    // Edit Mode State
    const [isEditing, setIsEditing] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showQR, setShowQR] = useState(false);



    // Community Registration State
    const [showCommunityReg, setShowCommunityReg] = useState(false);
    const [commTabData, setCommTabData] = useState({
        category: "Sport",
        description: "",
        isProcessing: false
    });

    const qrCanvasRef = useRef(null);
    const ChatRoom = window.ChatRoom;

    // Connection Privacy Logic
    const [isConnected, setIsConnected] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
    const [zoomedAvatar, setZoomedAvatar] = useState(false);

    // Privacy Logic
    const accessMode = profile.accessMode || 'private'; // private, public, timed
    const accessUntil = profile.accessUntil;
    const isPublic = accessMode === 'public';
    const timeLeft = accessUntil ? getTimeLeft(accessUntil) : 0;
    const isTimedUnlock = accessMode === 'timed' && timeLeft > 0;

    // Visibility Check
    const isLinksVisible = isOwner || isConnected || isPublic || isTimedUnlock;

    const handleCopyLink = () => {
        const link = `boond.id/profile/${profile.username.replace('@', '')}`;
        navigator.clipboard.writeText(link).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    useEffect(() => {
        // If owner, always true
        if (isOwner) {
            setIsConnected(true);
            return;
        }

        // If guest, default false
        if (!window.auth.currentUser || !profile?.uid) {
            setIsConnected(false);
            return;
        }

        // Listener for MUTUAL connection status
        // 1. Check if I have them (My Connection)
        const myConnRef = window.db.collection('users').doc(window.auth.currentUser.uid).collection('connections').doc(profile.uid || 'unknown');

        // 2. Check if they have me (Their Connection)
        const theirConnRef = window.db.collection('users').doc(profile.uid || 'unknown').collection('connections').doc(window.auth.currentUser.uid);

        let myStatus = false;
        let theirStatus = false;

        const checkMutual = () => {
            setIsConnected(myStatus && theirStatus);
        };

        const unsub1 = myConnRef.onSnapshot(doc => {
            myStatus = doc.exists;
            checkMutual();
        }, err => console.log("My Conn err", err));

        const unsub2 = theirConnRef.onSnapshot(doc => {
            theirStatus = doc.exists;
            checkMutual();
        }, err => console.log("Their Conn err", err));

        return () => {
            unsub1();
            unsub2();
        };
    }, [isOwner, profile, window.auth.currentUser]);

    // Form Data State
    // Static Icons Map to avoid flashing/disappearing issues
    const ICONS = {
        // UI Icons
        "x": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>,
        "qr-code": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="5" height="5" x="3" y="3" rx="1" /><rect width="5" height="5" x="16" y="3" rx="1" /><rect width="5" height="5" x="3" y="16" rx="1" /><path d="M21 16h-3a2 2 0 0 0-2 2v3" /><path d="M21 21v.01" /><path d="M12 7v3a2 2 0 0 1-2 2H7" /><path d="M3 12h.01" /><path d="M12 3h.01" /><path d="M12 16v.01" /><path d="M16 12h1" /><path d="M21 12v.01" /><path d="M12 21v-1" /></svg>,
        "share-2": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><line x1="8.59" x2="15.42" y1="13.51" y2="17.49" /><line x1="15.41" x2="8.59" y1="6.51" y2="10.49" /></svg>,
        "download": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>,
        "log-out": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>,
        "shuffle": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l14.2-12.6c.8-1.1 2-1.7 3.3-1.7H22" /><path d="m18 2 4 4-4 4" /><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2" /><path d="M22 18h-2.7c-1.3 0-2.6-.6-3.3-1.7L11.6 11" /><path d="m18 22 4-4-4-4" /></svg>,
        "trash-2": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" x2="10" y1="11" y2="17" /><line x1="14" x2="14" y1="11" y2="17" /></svg>,
        "chevron-right": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>,

        // Social / Link Icons
        "Link": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>,
        "MessageCircle": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 21 1.9-5.7a8.5 8.5 0 1 1 3.8 3.8z" /></svg>, // WhatsApp
        "Instagram": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>,
        "Twitter": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z" /></svg>,

        "Tiktok": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" /></svg>,
        "Spotify": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#1DB954" /><path d="M17.4 11.3c-2.9-1.7-7.6-1.9-10.4-1-.5.1-.9-.2-1-.6-.2-.5.1-.9.6-1.1 3.2-1 8.4-.8 11.7 1.2.5.3.6.9.3 1.4-.2.4-.7.5-1.2.1zm-.3 2.7c-.3.4-.8.5-1.2.3-2.4-1.5-6.1-1.9-8.9-1-.4.1-.8-.1-.9-.5-.1-.4.1-.8.5-.9 3.3-1 7.4-.5 10.2 1.2.4.2.5.7.3 1.1-.1.2-.3.2-.3.2zm-.4 2.8c-.2.4-.6.5-.9.3-2.1-1.3-4.7-1.6-7.8-.9-.4.1-.8-.2-.9-.5-.1-.4.2-.8.5-.9 3.4-.8 6.3-.5 8.8 1 .3.2.4.6.2.9-.1.2-.4.4-.9.1z" fill="#FFF" /></svg>,
        "Telegram": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>,
        "Facebook": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>,
        "Youtube": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" /><path d="m10 15 5-3-5-3z" /></svg>,
        "Google": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>,
        "Globe": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>,
        "Mail": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>,
        "Phone": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" /></svg>,
        "MapPin": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>,
        "Github": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" /><path d="M9 18c-4.51 2-5-2-7-2" /></svg>,
        "Linkedin": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" /><rect width="4" height="12" x="2" y="9" /><circle cx="4" cy="4" r="2" /></svg>,
        "ShoppingBag": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>,
        "Coffee": <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2v2" /><path d="M14 2v2" /><path d="M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 0 1 4 4v0a4 4 0 0 1-4 4h-1" /><line x1="6" x2="6" y1="2" y2="4" /></svg>
    };

    const URL_TEMPLATES = {
        'Instagram': 'https://instagram.com/',
        'MessageCircle': 'https://wa.me/', // WhatsApp
        'Tiktok': 'https://tiktok.com/@',
        'Twitter': 'https://x.com/',
        'Telegram': 'https://t.me/',
        'Mail': 'mailto:',
        'Phone': 'tel:',
        'Github': 'https://github.com/',
        'Linkedin': 'https://linkedin.com/in/',
        'Youtube': 'https://youtube.com/@'
    };

    const AVAILABLE_COLORS = [
        "bg-slate-900", "bg-slate-500", "bg-red-500", "bg-orange-500",
        "bg-yellow-500", "bg-green-500", "bg-emerald-500", "bg-teal-500",
        "bg-cyan-500", "bg-sky-500", "bg-blue-500", "bg-indigo-500",
        "bg-violet-500", "bg-purple-500", "bg-fuchsia-500", "bg-pink-500", "bg-rose-500"
    ];

    const [activeIconPicker, setActiveIconPicker] = useState(null);
    const [cropSrc, setCropSrc] = useState(null); // raw data URL setelah pilih file
    const [showCropper, setShowCropper] = useState(false);
    const cropCanvasRef = React.useRef(null);
    const cropStateRef = React.useRef({ scale: 1, offsetX: 0, offsetY: 0, dragging: false, lastX: 0, lastY: 0, imgEl: null });

    // Helper to get icon
    const getIcon = (name, className = "w-4 h-4") => {
        const icon = ICONS[name] || ICONS["Link"];
        // Clone element to add class
        return React.cloneElement(icon, { className });
    }

    const [formData, setFormData] = useState({
        name: "",
        username: "",
        bio: "",
        avatar: "",
        age: "",
        gender: "Laki-laki",
        communityCategory: "Sport",
        communityDescription: "",
        isStaticLocation: false,
        staticAddress: "",
        staticLocation: null,
        links: [],
        directMode: false,
        directLinkUrl: ""
    });

    // Initialize form data when entering edit mode or profile changes
    useEffect(() => {
        if (!isEditing) {
            setFormData({
                name: profile.displayName || profile.name || "",
                username: profile.username || "",
                bio: profile.bio || "",
                avatar: profile.avatar || "",
                age: profile.age || "",
                gender: profile.gender || "Laki-laki",
                communityCategory: profile.communityCategory || "Sport",
                communityDescription: profile.communityDescription || "",
                isStaticLocation: profile.isStaticLocation || false,
                staticAddress: profile.staticAddress || "",
                staticLocation: profile.staticLocation || null,
                links: profile.links ? profile.links.map(l => ({
                    ...l,
                    url: (!l.url || l.url.trim() === "") ? "https://" : l.url
                })) : [],
                directLinkUrl: profile.directLinkUrl || ""
            });
        }
    }, [isEditing, profile]);



    // --- Map Picker Logic ---
    const [showPicker, setShowPicker] = useState(false);
    const pickerMapRef = useRef(null);
    const [pickerSearch, setPickerSearch] = useState("");

    useEffect(() => {
        if (showPicker && pickerMapRef.current && window.google) {
            const initialLat = formData.staticLocation ? formData.staticLocation.latitude : -6.914744;
            const initialLng = formData.staticLocation ? formData.staticLocation.longitude : 107.609810;

            const map = new window.google.maps.Map(pickerMapRef.current, {
                center: { lat: initialLat, lng: initialLng },
                zoom: 15,
                disableDefaultUI: true,
                zoomControl: true,
                gestureHandling: 'greedy' // Enable 1-finger pan
            });

            const marker = new window.google.maps.Marker({
                position: { lat: initialLat, lng: initialLng },
                map: map,
                draggable: true // Allow dragging pin
            });

            // Map Click -> Move Marker & Update State
            map.addListener("click", (e) => {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                marker.setPosition({ lat, lng });
                setFormData(prev => ({
                    ...prev,
                    staticLocation: new window.firebase.firestore.GeoPoint(lat, lng)
                }));
            });

            // Marker Drag End -> Update State
            marker.addListener("dragend", (e) => {
                const lat = e.latLng.lat();
                const lng = e.latLng.lng();
                setFormData(prev => ({
                    ...prev,
                    staticLocation: new window.firebase.firestore.GeoPoint(lat, lng)
                }));
            });

            // Expose map to search function via ref or closure if needed, but simple re-init is fine for search results?
            // Better: store map instance in ref if needed.
            window.pickerMapInstance = map;
            window.pickerMarkerInstance = marker;
        }
    }, [showPicker]);

    const handlePickerSearch = () => {
        if (!pickerSearch || !window.google) return;
        const geocoder = new window.google.maps.Geocoder();
        geocoder.geocode({ address: pickerSearch }, (results, status) => {
            if (status === "OK" && results[0]) {
                const location = results[0].geometry.location;
                const lat = location.lat();
                const lng = location.lng();

                // Pan map
                if (window.pickerMapInstance) {
                    window.pickerMapInstance.setCenter(location);
                    window.pickerMapInstance.setZoom(17);
                    window.pickerMarkerInstance.setPosition(location);
                }

                // Update Form
                setFormData(prev => ({
                    ...prev,
                    staticLocation: new window.firebase.firestore.GeoPoint(lat, lng),
                    staticAddress: results[0].formatted_address // Auto-fill address name too!
                }));
            } else {
                alert("Location not found.");
            }
        });
    };

    // Step 1: Pilih file → buka crop modal
    const handleAvatarChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // Reset file input so same file can be re-selected
        e.target.value = '';

        const reader = new FileReader();
        reader.onload = (ev) => {
            setCropSrc(ev.target.result);
            setShowCropper(true);
        };
        reader.readAsDataURL(file);
    };

    // Step 2: Setelah crop dikonfirmasi → compress & upload
    const handleCropConfirm = async (croppedBlob) => {
        setShowCropper(false);
        setCropSrc(null);
        setIsUploadingAvatar(true);
        try {
            let file = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });

            // Compress (sudah 1:1 dari crop, cukup resize ke 600x600)
            if (window.utils && window.utils.compressImage) {
                file = await window.utils.compressImage(file, 600, 600, 0.8);
            }

            // Hapus avatar lama di Firebase Storage jika ada
            if (formData.avatar && formData.avatar.includes('firebasestorage.googleapis.com')) {
                try {
                    const oldAvatarRef = window.storage.refFromURL(formData.avatar);
                    await oldAvatarRef.delete();
                } catch (delError) {
                    console.warn("Failed to delete old avatar:", delError);
                }
            }

            const storageRef = window.storage.ref();
            const avatarRef = storageRef.child(`avatars/${window.auth.currentUser.uid}_${Date.now()}`);
            await avatarRef.put(file);
            const downloadURL = await avatarRef.getDownloadURL();
            setFormData(prev => ({ ...prev, avatar: downloadURL }));
        } catch (error) {
            console.error("Error uploading avatar:", error);
            alert((lang === 'id' ? "Gagal mengunggah foto profil: " : "Failed to upload avatar: ") + error.message);
        } finally {
            setIsUploadingAvatar(false);
        }
    };

    const handleSave = async () => {
        console.log("Attempting to save profile...", formData);

        // Debug Checks
        if (!window.db) {
            alert("Error: Database connection (window.db) not found.");
            return;
        }
        if (!window.auth.currentUser) {
            alert("Error: No logged-in user found. Please re-login.");
            return;
        }

        // Validation: Static Location must have coordinates
        if (profile.isCommunity && formData.isStaticLocation && !formData.staticLocation) {
            alert(lang === 'id' ? "Mohon tentukan lokasi basecamp di peta." : "Please set the basecamp location on the map.");
            return;
        }

        try {
            console.log("Updating document for UID:", window.auth.currentUser.uid);
            const updateData = {
                displayName: formData.name,
                username: formData.username,
                avatar: formData.avatar,
                links: formData.links
            };

            // Only update personal fields if NOT a community
            if (!profile.isCommunity) {
                updateData.bio = formData.bio;
                updateData.age = formData.age;
                updateData.gender = formData.gender;
            } else {
                // Update community specific fields
                updateData.communityCategory = formData.communityCategory;
                updateData.communityDescription = formData.communityDescription;

                // Static Location Update
                updateData.isStaticLocation = formData.isStaticLocation;
                updateData.staticAddress = formData.staticAddress;

                if (formData.staticLocation) {
                    updateData.staticLocation = formData.staticLocation;

                    // CRITICAL: If Static is ON, Overwrite the MAIN location field immediately.
                    // This ensures the Map View sees the static location.
                    // And App.js heartbeat is disabled so it won't be overwritten by GPS.
                    if (formData.isStaticLocation) {
                        updateData.location = formData.staticLocation;
                    }
                }
            }

            await window.db.collection('users').doc(window.auth.currentUser.uid).update(updateData);
            console.log("Update success!");
            setIsEditing(false);
            alert(lang === 'id' ? "Profil berhasil diperbarui!" : "Profile updated!");
        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Save Failed: " + error.message);
        }
    };

    // Privacy Toggle Handler
    const [isVisible, setIsVisible] = useState(profile.isVisible || false);

    // Sync local state when profile updates from parent (Firestore listener)
    useEffect(() => {
        setIsVisible(!!profile.isVisible);
    }, [profile]);

    const handleTogglePrivacy = async () => {
        if (!window.auth.currentUser) return;

        // Fetch FRESH data from DB to ensure no stale props cause GPS overwrite
        let isStatic = false;
        try {
            const doc = await window.db.collection('users').doc(window.auth.currentUser.uid).get();
            if (doc.exists) {
                isStatic = doc.data().isStaticLocation || false;
            }
        } catch (err) {
            console.error("Error fetching fresh profile for toggle:", err);
            // Fallback to prop if fetch fails
            isStatic = profile.isStaticLocation || false;
        }

        const newState = !isVisible;

        // If turning ON visibility
        if (newState === true) {
            // OPTIMISTIC UPDATE: Turn it ON immediately visually
            setIsVisible(true);

            // Check if Static Location is active (FRESH CHECK)
            if (isStatic) {
                console.log("Visibility ON (Static Mode - Verified DB). Skipping GPS fetch.");
                try {
                    await window.db.collection('users').doc(window.auth.currentUser.uid).update({
                        isVisible: true,
                        lastSeen: new Date()
                    });
                } catch (error) {
                    console.error("Privacy Toggle Error (Static):", error);
                    setIsVisible(false); // Revert on error
                    alert("Failed to update privacy mode.");
                }
                return;
            }

            // Normal Dynamic Mode: Fetch GPS in Background
            if (navigator.geolocation) {
                console.log("Requesting GPS...");
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        console.log("GPS Found. Syncing to DB...");
                        try {
                            await window.db.collection('users').doc(window.auth.currentUser.uid).update({
                                location: new window.firebase.firestore.GeoPoint(position.coords.latitude, position.coords.longitude),
                                isVisible: true,
                                lastSeen: new Date()
                            });
                            console.log("Location Synced!");
                        } catch (e) {
                            console.error("Failed to save initial location", e);
                            setIsVisible(false); // Revert
                            alert("Failed to save location. Privacy mode disabled.");
                        }
                    },
                    (err) => {
                        console.warn("Permission Prompt: DENIED/CLOSED", err);
                        setIsVisible(false); // Revert because we MUST have location
                        alert("Gagal mengaktifkan: Boond butuh izin lokasi. Pastikan GPS aktif dan izin browser diberikan.");
                    }
                );
                return;
            } else {
                setIsVisible(false);
                alert("Browser user tidak support Geolocation.");
                return;
            }
        }

        // Turning OFF
        setIsVisible(newState);

        try {
            await window.db.collection('users').doc(window.auth.currentUser.uid).update({
                isVisible: newState,
                lastSeen: new Date()
            });
        } catch (error) {
            console.error("Privacy Toggle Error:", error);
            setIsVisible(!newState);
            alert("Failed to update privacy mode.");
        }
    };

    // Handle Delete Account
    const handleDeleteAccount = async () => {
        const confirmMsg = lang === 'id'
            ? "YAKIN ingin menghapus akun? \n\nSemua data profil dan link Boond Anda akan HILANG SELAMANYA. Tindakan ini tidak bisa dibatalkan."
            : "Are you SURE you want to delete your account? \n\nAll existing data and your Boond link will be GONE FOREVER. This cannot be undone.";

        if (!window.confirm(confirmMsg)) return;

        const user = window.auth.currentUser;
        if (!user) return;

        try {
            window.isDeletingAccount = true; // Signal to App.js to stop auto-creation
            console.log("Starting delete process for UID:", user.uid);

            // 1. Delete Firestore Data
            await window.db.collection('users').doc(user.uid).delete();
            console.log("Firestore data deleted for UID:", user.uid);
            alert("Step 1 Success: Data Profile Terhapus. Lanjut menghapus akun...");

            // 2. Delete Auth Account
            await user.delete();
            console.log("Auth account deleted for UID:", user.uid);

            alert(lang === 'id' ? "SUKSES: Akun berhasil dihapus total. Sampai jumpa." : "SUCCESS: Account deleted. Goodbye.");
        } catch (error) {
            console.error("Delete Error:", error);
            if (error.code === 'auth/requires-recent-login') {
                const reLoginMsg = lang === 'id'
                    ? "Gagal di Langkah 2 (Auth): Mohon LOGOUT dan LOGIN ulang, lalu coba hapus lagi."
                    : "Failed at Step 2 (Auth): Please LOGOUT and LOGIN again, then try deleting.";
                alert(reLoginMsg);
                window.auth.signOut();
            } else if (error.code === 'permission-denied' || error.message.includes('permission')) {
                const permMsg = lang === 'id'
                    ? "Gagal di Langkah 1 (Database): Izin Ditolak. Cek Rules Firebase."
                    : "Failed at Step 1 (Database): Permission Denied. Check Firebase Rules.";
                alert(permMsg);
            } else {
                alert("Error: " + error.message);
            }
        }
    };

    // Handle Community Registration
    const handleRegisterCommunity = async () => {
        if (!commTabData.description) {
            alert(lang === 'id' ? "Mohon isi deskripsi komunitas." : "Please fill in community description.");
            return;
        }

        setCommTabData(prev => ({ ...prev, isProcessing: true }));

        // Simulate Payment
        setTimeout(async () => {
            try {
                await window.db.collection('users').doc(window.auth.currentUser.uid).update({
                    isCommunity: true,
                    communityCategory: commTabData.category,
                    communityDescription: commTabData.description,
                    subscriptionStatus: 'active',
                    updatedAt: new Date()
                });

                setCommTabData(prev => ({ ...prev, isProcessing: false }));
                setShowCommunityReg(false);
                alert(lang === 'id' ? "Selamat! Profil Anda telah diubah menjadi Akun Komunitas." : "Congrats! Your profile is now a Community Account.");
            } catch (err) {
                console.error("Community Upgrade Error:", err);
                setCommTabData(prev => ({ ...prev, isProcessing: false }));
                alert("Error: " + err.message);
            }
        }, 2000); // 2 second mock payment
    };

    const COMMUNITY_CATEGORIES = [
        "Sport", "Music", "Technology", "Business", "Social", "Education", "Art", "Gaming", "Lifestyle", "Other"
    ];

    // Link Management
    const handleAddLink = () => {
        setFormData(prev => ({
            ...prev,
            links: [...prev.links, { id: Date.now(), title: "New Link", url: "https://", icon: "Link", color: "bg-slate-500" }]
        }));
        // Re-init icons after render (fallback for Lucide)
        setTimeout(() => window.lucide && window.lucide.createIcons(), 100);
    };

    const handleRemoveLink = (index) => {
        setFormData(prev => ({
            ...prev,
            links: prev.links.filter((_, i) => i !== index)
        }));
    };

    const handleLinkChange = (index, field, value) => {
        const newLinks = [...formData.links];
        const currentLink = { ...newLinks[index] }; // Copy object to mutate safely

        let finalValue = value;

        if (field === 'url') {
            // Strict HTTPS Enforcement
            if (!value.startsWith('https://')) {
                // If user deleted part of the prefix, restore it
                finalValue = 'https://';
            }
            currentLink.url = finalValue;
        } else if (field === 'icon') {
            // SMART MIGRATION LOGIC
            const oldIcon = currentLink.icon;
            const newIcon = value;
            const oldTemplate = URL_TEMPLATES[oldIcon];
            const newTemplate = URL_TEMPLATES[newIcon];

            // Update the icon
            currentLink.icon = newIcon;

            // If switching TO a known template
            if (newTemplate) {
                // 1. If currently empty, "https://", or matches the OLD template -> Migrate
                if (!currentLink.url || currentLink.url === 'https://') {
                    currentLink.url = newTemplate;
                }
                else if (oldTemplate && currentLink.url.startsWith(oldTemplate)) {
                    const suffix = currentLink.url.slice(oldTemplate.length);
                    currentLink.url = newTemplate + suffix;
                }
                // 2. If it was a generic link but looks like it could be migrated (optional, skip for safety)
            }
        } else {
            // Title, color, etc.
            currentLink[field] = finalValue;
        }

        newLinks[index] = currentLink;
        setFormData(prev => ({ ...prev, links: newLinks }));
    };

    const handleMoveLink = (index, direction) => {
        const newLinks = [...formData.links];
        if (direction === -1 && index > 0) {
            // Move Up
            [newLinks[index], newLinks[index - 1]] = [newLinks[index - 1], newLinks[index]];
        } else if (direction === 1 && index < newLinks.length - 1) {
            // Move Down
            [newLinks[index], newLinks[index + 1]] = [newLinks[index + 1], newLinks[index]];
        }
        setFormData(prev => ({ ...prev, links: newLinks }));
    };

    // Helper for category colors (Matched with CommunityView)
    const getCategoryColor = (cat) => {
        const colors = {
            "Sport": "bg-orange-100 text-orange-600 border-orange-200",
            "Music": "bg-purple-100 text-purple-600 border-purple-200",
            "Technology": "bg-blue-100 text-blue-600 border-blue-200",
            "Business": "bg-slate-100 text-slate-600 border-slate-200",
            "Social": "bg-pink-100 text-pink-600 border-pink-200",
            "Education": "bg-green-100 text-green-600 border-green-200",
            "Art": "bg-rose-100 text-rose-600 border-rose-200",
            "Gaming": "bg-indigo-100 text-indigo-600 border-indigo-200"
        };
        return colors[cat] || "bg-slate-100 text-slate-600 border-slate-200";
    };

    // User Community Tags Logic
    const [userCommunities, setUserCommunities] = useState([]);

    useEffect(() => {
        if (!profile || !profile.uid || profile.isCommunity) return;

        const fetchUserCommunities = async () => {
            try {
                // 1. Get all connections
                const connectionsSnapshot = await window.db.collection('users')
                    .doc(profile.uid)
                    .collection('connections')
                    .get();

                if (connectionsSnapshot.empty) return;

                const connectionIds = connectionsSnapshot.docs.map(doc => doc.id);

                // 2. Fetch details for each connection to check if it's a community
                // properties to fetch: displayName, avatar, isCommunity, communityCategory
                // optimization: limit concurrency if needed, but for now map is fine for MVP
                const promises = connectionIds.map(id =>
                    window.db.collection('users').doc(id).get()
                );

                const results = await Promise.all(promises);

                const communities = results
                    .map(doc => ({ id: doc.id, ...doc.data() }))
                    .filter(user => user.isCommunity === true); // Filter ONLY communities

                setUserCommunities(communities);
            } catch (err) {
                console.error("Error fetching user communities:", err);
            }
        };

        fetchUserCommunities();
    }, [profile]);

    return (
        <div className={`w-full h-full text-slate-900 p-6 flex flex-col items-center relative overflow-hidden ${isEmbedded ? '' : 'min-h-screen bg-transparent'}`}>
            {/* ... (Background Logic remains same, omitted for brevity in replace block if not changing) ... */}
            {/* Background Ambient - Only show if not embedded */}
            {!isEmbedded && (
                <>
                    <div className="absolute top-[-20%] left-[-20%] w-[900px] h-[900px] bg-blue-600/30 rounded-full blur-[120px] pointer-events-none mix-blend-multiply"></div>
                    <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-500/30 rounded-full blur-[100px] pointer-events-none mix-blend-multiply"></div>
                    <div className="absolute top-[30%] right-[-30%] w-[600px] h-[600px] bg-cyan-400/30 rounded-full blur-[140px] pointer-events-none mix-blend-multiply rotate-45 transform"></div>
                </>
            )}



            {/* Scrollable Container */}
            <div className="w-full max-w-md min-h-screen pb-32 pt-24">
                {/* Key prop ensures clean unmount/remount between View/Edit to prevent DOM conflicts */}
                <motion.div
                    key={isEditing ? "edit" : "view"}
                    initial={{ opacity: 0, y: 50 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="w-full z-10 flex flex-col items-center gap-6"
                >

                    {/* --- VIEW MODE --- */}
                    {!isEditing ? (
                        <>
                            {/* QR Code Modal Overlay */}
                            <AnimatePresence>
                                {showQR && (
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 z-[100] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-6"
                                        onClick={() => setShowQR(false)}
                                    >
                                        <motion.div
                                            initial={{ scale: 0.8, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            exit={{ scale: 0.8, opacity: 0 }}
                                            className="bg-white rounded-3xl p-8 max-w-sm w-full flex flex-col items-center text-center shadow-2xl relative"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <button
                                                onClick={() => setShowQR(false)}
                                                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
                                            >
                                                {getIcon('x', 'w-6 h-6')}
                                            </button>

                                            <h3 className="text-2xl font-bold mb-2 text-slate-900">{lang === 'id' ? 'Scan untuk Terhubung' : 'Scan to Connect'}</h3>
                                            <p className="text-slate-500 mb-6 text-sm">{lang === 'id' ? 'Scan QR ini pakai kamera HP untuk buka profil Boond.' : 'Scan this QR with your phone camera to open the Boond profile.'}</p>

                                            <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-100 mb-6 flex justify-center">
                                                <img
                                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=256x256&color=0f172a&bgcolor=ffffff&data=${encodeURIComponent('https://boond.id/profile/' + profile.username.replace('@', ''))}`}
                                                    alt="Profile QR Code"
                                                    className="w-48 h-48 object-contain rounded-lg"
                                                />
                                            </div>

                                            <p className="font-mono text-xs text-slate-400 bg-slate-50 px-3 py-1 rounded-full">
                                                boond.id/profile/{profile.username.replace('@', '')}
                                            </p>
                                        </motion.div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* Chat Room Overlay */}
                            <AnimatePresence>
                                {showChat && ChatRoom && (
                                    <ChatRoom
                                        currentUser={window.auth.currentUser}
                                        targetUser={profile}
                                        onClose={() => setShowChat(false)}
                                        isConnected={isConnected}
                                    />
                                )}
                            </AnimatePresence>

                            {/* Identity Section Wrapper for tighter internal spacing */}
                            <div className="flex flex-col items-center gap-3 w-full">
                                {/* Avatar Ring */}
                                <div className="relative group">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-blue-400 to-sky-300 rounded-full blur opacity-40 group-hover:opacity-60 transition duration-500 pointer-events-none"></div>
                                    <img
                                        src={profile.avatar}
                                        alt={profile.name}
                                        className="relative w-32 h-32 rounded-full border-4 border-white object-cover shadow-2xl cursor-zoom-in hover:scale-105 transition"
                                        onClick={() => setZoomedAvatar(true)}
                                    />
                                    <div 
                                        className="absolute bottom-1 right-1 bg-white text-slate-900 w-8 h-8 rounded-full border-4 border-transparent flex items-center justify-center shadow-lg hover:scale-110 transition cursor-pointer z-10"
                                        onClick={(e) => { e.stopPropagation(); setShowQR(true); }}
                                    >
                                        {getIcon('qr-code', 'w-4 h-4')}
                                    </div>
                                </div>

                                {/* Identity */}
                                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 text-center flex items-center justify-center gap-2">
                                    {profile.displayName || profile.name}
                                    {profile.isCommunity && (
                                        <span className="bg-blue-100 text-blue-600 p-1.5 rounded-full" title="Community Account">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                        </span>
                                    )}
                                </h2>
                                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                                    <div className="text-blue-600 font-semibold text-sm bg-blue-50 px-3 py-1 rounded-full flex items-center gap-2">
                                        {profile.username}
                                    </div>
                                    <button
                                        onClick={handleCopyLink}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border transition flex items-center gap-1.5 ${isCopied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white text-slate-500 border-slate-200 hover:border-blue-400 hover:text-blue-600'}`}
                                    >
                                        {isCopied ? (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                                                {lang === 'id' ? 'Tersalin!' : 'Copied!'}
                                            </>
                                        ) : (
                                            <>
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                                {lang === 'id' ? 'Salin Link Profil' : 'Copy Profile Link'}
                                            </>
                                        )}
                                    </button>
                                </div>
                                {profile.isCommunity && profile.communityCategory && (
                                    <div className={`mt-1 px-3 py-1 text-xs font-bold uppercase tracking-wider rounded-lg border ${getCategoryColor(profile.communityCategory)}`}>
                                        {t('cat_' + profile.communityCategory) || profile.communityCategory}
                                    </div>
                                )}

                                {/* Static Location Label */}
                                {profile.isCommunity && profile.isStaticLocation && profile.staticAddress && (
                                    <div className="flex items-center gap-1.5 text-slate-500 text-sm font-medium mt-1">
                                        <svg className="w-4 h-4 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                                        <span>{profile.staticAddress}</span>
                                    </div>
                                )}

                                {/* User Community Tags */}
                                {userCommunities.length > 0 && (
                                    <div className="flex flex-col items-center mt-3 animate-fade-in-up">
                                        <span className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-2">
                                            {lang === 'id' ? 'Komunitas' : 'Member of'}
                                        </span>
                                        <div className="flex flex-wrap justify-center gap-2 max-w-xs">
                                            {userCommunities.map(comm => (
                                                <button
                                                    key={comm.id}
                                                    onClick={() => onNavigate && onNavigate(`/profile/${comm.username.replace('@', '')}`)}
                                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border transition hover:scale-105 ${getCategoryColor(comm.communityCategory)}`}
                                                >
                                                    {/* Tiny Icon */}
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                                    {comm.displayName || comm.name}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                <p className="text-center text-slate-500 leading-relaxed max-w-xs text-sm font-medium mt-1">
                                    {profile.isCommunity ? (profile.communityDescription || profile.bio) : profile.bio}
                                </p>

                                {/* Demographics Badges (Hidden for Communities) */}
                                {!profile.isCommunity && (profile.age || profile.gender) && (
                                    <div className="flex gap-2 justify-center mt-2">
                                        {profile.age && (
                                            <div className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5">
                                                <span>🎂</span>
                                                {profile.age} {lang === 'id' ? 'Tahun' : 'Years'}
                                            </div>
                                        )}
                                        {profile.gender && (
                                            <div className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 ${['Laki-laki', 'Male'].includes(profile.gender) ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                                <span>{['Laki-laki', 'Male'].includes(profile.gender) ? '♂' : '♀'}</span>
                                                {/* Localize Display */}
                                                {['Laki-laki', 'Male'].includes(profile.gender)
                                                    ? (lang === 'id' ? 'Laki-laki' : 'Male')
                                                    : (lang === 'id' ? 'Perempuan' : 'Female')
                                                }
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>


                            {/* MAIN ACTIONS */}
                            {/* MAIN ACTIONS */}
                            <div className="w-full flex gap-3 mb-1">
                                {/* Edit Button - Owner Only */}
                                {isOwner && (
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-xl font-bold border border-slate-200 hover:bg-slate-200 transition flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>
                                        {lang === 'id' ? 'Ubah' : 'Edit'}
                                    </button>
                                )}

                                {/* Share/QR Button - For Everyone */}
                                <button
                                    onClick={() => setShowQR(true)}
                                    className="flex-1 bg-slate-900 text-white py-2.5 rounded-xl font-bold hover:bg-slate-800 transition flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10"
                                >
                                    {getIcon('share-2', 'w-4 h-4')}
                                    {t('profile_share')}
                                </button>
                            </div>

                            {/* Public Chat Button - For Everyone (Except Owner) */}
                            {/* Secondary Actions Row: Chat & Map */}
                            {!isOwner && window.auth.currentUser && (
                                <div className="w-full flex gap-3 mb-8">
                                    <button
                                        onClick={() => setShowChat(true)}
                                        className="flex-1 bg-blue-100 text-blue-700 py-3 rounded-xl font-bold hover:bg-blue-200 transition flex items-center justify-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" /></svg>
                                        {lang === 'id' ? 'Kirim Pesan' : 'Send Message'}
                                    </button>

                                    {/* View on Map Button - Only if profile is visible and has location */}
                                    {profile.isVisible && profile.location && (
                                        <button
                                            onClick={() => onNavigate('maps', {
                                                focusUid: profile.uid,
                                                initialPos: { lat: profile.location.latitude, lng: profile.location.longitude }
                                            })}
                                            className="flex-1 bg-emerald-100 text-emerald-700 py-3 rounded-xl font-bold hover:bg-emerald-200 transition flex items-center justify-center gap-2"
                                        >
                                            {getIcon('MapPin', 'w-5 h-5')}
                                            {lang === 'id' ? 'Lihat di Peta' : 'View on Map'}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Privacy Control Panel (Owner Only) - HIDDEN as per request */}
                            {/* {isOwner && (
                                <PrivacyControlPanel profile={profile} currentUser={window.auth.currentUser} db={window.db} lang={lang} />
                            )} */}

                            {/* Links List - PRIVACY AWARE */}
                            {isLinksVisible ? (
                                <div className="w-full space-y-4 mb-8">
                                    {/* Timed Access Banner */}
                                    {isTimedUnlock && !isOwner && !isConnected && (
                                        <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-3 py-2 rounded-xl text-center text-xs font-bold mb-2 animate-pulse">
                                            🔓 {lang === 'id' ? 'Akses Sementara Aktif!' : 'Temporary Access Active!'} ({formatTimeLeft(timeLeft)})
                                        </div>
                                    )}

                                    {profile.links && profile.links.map((link, idx) => (
                                        <motion.a
                                            key={link.id}
                                            href={link.url}
                                            target="_blank"
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: 0.1 * idx }}
                                            className="block group"
                                        >
                                            <div className={`bg-white/80 backdrop-blur-md border border-slate-200 hover:border-blue-400 p-4 rounded-2xl flex items-center gap-4 transition-all hover:bg-white hover:shadow-xl hover:shadow-blue-500/10 relative overflow-hidden group`}>
                                                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${link.color} text-white shadow-lg shadow-blue-500/20 group-hover:scale-110 transition-transform`}>
                                                    {getIcon(link.icon || "Link", "w-5 h-5")}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{link.title}</h3>
                                                </div>
                                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-50 transition-colors">
                                                    {getIcon('chevron-right', "w-4 h-4 text-slate-400 group-hover:text-blue-600 group-hover:translate-x-0.5 transition-all")}
                                                </div>
                                            </div>
                                        </motion.a>
                                    ))}
                                    {(!profile.links || profile.links.length === 0) && (
                                        <p className="text-center text-slate-400 text-sm italic">{lang === 'id' ? 'Belum ada link.' : 'No links added yet.'}</p>
                                    )}
                                </div>
                            ) : (
                                <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-8 text-center mb-8">
                                    <div className="bg-slate-200 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
                                    </div>
                                    <h3 className="text-slate-900 font-bold text-lg mb-1">{lang === 'id' ? 'Link Terkunci 🔒' : 'Links Locked 🔒'}</h3>
                                    <p className="text-slate-500 text-sm mb-6">{lang === 'id' ? 'Simpan kontak ini untuk melihat link media sosialnya.' : 'Save this contact to view their social links.'}</p>

                                    {!window.auth.currentUser && (
                                        <button onClick={() => window.location.href = '/login'} className="text-blue-600 font-bold text-sm underline">
                                            {lang === 'id' ? 'Login untuk terhubung' : 'Login to connect'}
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Connection Request Button (Guest/Other User) */}
                            {!isOwner && (
                                <ConnectionButton
                                    targetProfile={profile}
                                    currentUser={window.auth.currentUser}
                                    db={window.db}
                                    lang={lang}
                                    getIcon={getIcon}
                                />
                            )}

                            {/* Community Feed */}
                            {profile.isCommunity && CommunityFeed && (
                                <CommunityFeed
                                    profile={profile}
                                    isOwner={isOwner}
                                    db={window.db}
                                    getIcon={getIcon}
                                    lang={lang}
                                />
                            )}

                            {/* Logout Button (Only if OWNER) */}
                            {isOwner && onLogout && (
                                <button
                                    onClick={onLogout}
                                    className="text-red-500 font-bold text-sm bg-red-50 px-6 py-3 rounded-xl border border-red-100 hover:bg-red-100 transition flex items-center justify-center gap-2 w-full"
                                >
                                    {getIcon('log-out', 'w-4 h-4')}
                                    {t('profile_logout')}
                                </button>
                            )}
                        </>
                    ) : (

                        /* --- EDIT MODE (Unchanged logic, just re-rendering) --- */
                        <div className="w-full bg-white/50 backdrop-blur-sm rounded-3xl p-4 border border-slate-200 shadow-xl animate-fade-in-up">
                            <h3 className="text-xl font-bold mb-6 text-center border-b border-slate-200 pb-4">
                                {lang === 'id' ? 'Edit Profil' : 'Edit Profile'}
                            </h3>

                            {/* Basic Info Fields */}
                            <div className="space-y-4 mb-8">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                        {lang === 'id' ? 'Nama Tampilan' : 'Display Name'}
                                    </label>
                                    <input
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white/80"
                                        placeholder={lang === 'id' ? "Nama Anda" : "Your Name"}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">{lang === 'id' ? 'Username' : 'Username'}</label>
                                    <input
                                        value={formData.username}
                                        onChange={e => setFormData({ ...formData, username: e.target.value })}
                                        className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white/80"
                                        placeholder="@username"
                                    />
                                    <p className="text-[10px] text-red-500 font-bold mt-1 ml-1 leading-tight">
                                        {lang === 'id'
                                            ? '*Username wajib unik sebagai alamat link profilmu (boond.id/profile/username)'
                                            : '*Username must be unique as it serves as your profile link (boond.id/profile/username)'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">{lang === 'id' ? 'Avatar / Foto Profil' : 'Avatar / Profile Picture'}</label>
                                    <div className="flex items-center gap-3 mt-2">
                                        {/* Avatar Preview */}
                                        <div className="w-14 h-14 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden flex-shrink-0 relative shadow-sm">
                                            {isUploadingAvatar && (
                                                <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
                                                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                                </div>
                                            )}
                                            {formData.avatar ? (
                                                <img src={formData.avatar} alt="Preview" className="w-full h-full object-cover" onError={(e) => e.target.src = `https://ui-avatars.com/api/?name=${formData.username}`} />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-slate-300">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                </div>
                                            )}
                                        </div>

                                        {/* Upload Full-Width Button */}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            id="avatar-upload"
                                            onChange={handleAvatarChange}
                                            disabled={isUploadingAvatar}
                                        />
                                        <label
                                            htmlFor="avatar-upload"
                                            className="flex-1 flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-2xl font-bold text-sm cursor-pointer hover:bg-slate-700 active:scale-95 transition-all shadow-md"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>
                                            {isUploadingAvatar ? (lang === 'id' ? 'Mengunggah...' : 'Uploading...') : (lang === 'id' ? 'Unggah Foto' : 'Upload Photo')}
                                        </label>
                                    </div>
                                </div>

                                {/* Avatar Cropper Modal */}
                                {showCropper && cropSrc && (
                                    <AvatarCropperModal
                                        src={cropSrc}
                                        lang={lang}
                                        onConfirm={handleCropConfirm}
                                        onCancel={() => { setShowCropper(false); setCropSrc(null); }}
                                    />
                                )}

                                {/* Community Specific Fields */}
                                {profile.isCommunity && (
                                    <>
                                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 space-y-4">
                                            <h4 className="font-bold text-blue-800 text-sm flex items-center gap-2">
                                                {getIcon('MapPin', 'w-4 h-4 text-blue-600')}
                                                {t('profile_comm_settings')}
                                            </h4>

                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                                    {lang === 'id' ? 'Kategori' : 'Category'}
                                                </label>
                                                <select
                                                    value={formData.communityCategory}
                                                    onChange={e => setFormData({ ...formData, communityCategory: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-xl border border-blue-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                                                >
                                                    {COMMUNITY_CATEGORIES.map(cat => (
                                                        <option key={cat} value={cat}>{t('cat_' + cat) || cat}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                                    {lang === 'id' ? 'Deskripsi' : 'Description'}
                                                </label>
                                                <textarea
                                                    value={formData.communityDescription}
                                                    onChange={e => setFormData({ ...formData, communityDescription: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-xl border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                                                    rows="3"
                                                    placeholder={lang === 'id' ? "Jelaskan komunitas Anda..." : "Describe your community..."}
                                                />
                                            </div>

                                            {/* Static Location (Basecamp) */}
                                            <div className="pt-2 border-t border-blue-100">
                                                <div className="flex items-center justify-between mb-2">
                                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                                        {lang === 'id' ? 'Lokasi Basecamp (Statis)' : 'Static Basecamp'}
                                                    </label>
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="checkbox"
                                                            checked={formData.isStaticLocation}
                                                            onChange={(e) => setFormData({ ...formData, isStaticLocation: e.target.checked })}
                                                            className="toggle-checkbox"
                                                        />
                                                        <span className="text-xs text-slate-400">{formData.isStaticLocation ? 'On' : 'Off'}</span>
                                                    </div>
                                                </div>

                                                {formData.isStaticLocation && (
                                                    <div className="space-y-3 animate-fade-in-up">
                                                        {/* Address Input */}
                                                        <input
                                                            value={formData.staticAddress}
                                                            onChange={e => setFormData({ ...formData, staticAddress: e.target.value })}
                                                            className="w-full px-4 py-2 rounded-xl border border-blue-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                                                            placeholder={lang === 'id' ? "Nama Tempat (Contoh: Gelora Bung Karno)" : "Location Name (e.g. Central Park)"}
                                                        />

                                                        {/* MAP PICKER BUTTONS */}
                                                        <div className="flex gap-2">
                                                            <button
                                                                onClick={() => {
                                                                    if (navigator.geolocation) {
                                                                        navigator.geolocation.getCurrentPosition((pos) => {
                                                                            const { latitude, longitude } = pos.coords;
                                                                            setFormData({
                                                                                ...formData,
                                                                                staticLocation: new window.firebase.firestore.GeoPoint(latitude, longitude)
                                                                            });
                                                                            alert(lang === 'id' ? "Lokasi GPS terkini berhasil diambil!" : "Current GPS location captured!");
                                                                        }, (err) => alert("GPS Error: " + err.message));
                                                                    }
                                                                }}
                                                                className="flex-1 py-2 bg-blue-100 text-blue-700 rounded-xl text-xs font-bold hover:bg-blue-200 transition flex items-center justify-center gap-2"
                                                            >
                                                                {getIcon('MapPin', 'w-3 h-3')}
                                                                {lang === 'id' ? 'GPS Saat Ini' : 'Current GPS'}
                                                            </button>
                                                            <button
                                                                onClick={() => setShowPicker(!showPicker)}
                                                                className="flex-1 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2"
                                                            >
                                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M12 8l4 4-4 4M8 12h8" /></svg>
                                                                {showPicker ? (lang === 'id' ? 'Tutup Peta' : 'Close Map') : (lang === 'id' ? 'Buka Peta / Cari' : 'Open Map / Search')}
                                                            </button>
                                                        </div>

                                                        {/* MAP PICKER CONTAINER */}
                                                        {showPicker && (
                                                            <div className="mt-2 p-1 bg-white border border-slate-200 rounded-xl animate-fade-in">
                                                                {/* Search Bar inside Picker */}
                                                                <div className="flex gap-2 mb-2 p-1">
                                                                    <input
                                                                        className="flex-1 px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-slate-50 focus:bg-white transition"
                                                                        placeholder={lang === 'id' ? "Cari lokasi..." : "Search place..."}
                                                                        value={pickerSearch}
                                                                        onChange={(e) => setPickerSearch(e.target.value)}
                                                                        onKeyDown={(e) => e.key === 'Enter' && handlePickerSearch()}
                                                                    />
                                                                    <button onClick={handlePickerSearch} className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-bold hover:bg-slate-900">
                                                                        {lang === 'id' ? "Cari" : "Search"}
                                                                    </button>
                                                                </div>
                                                                <div ref={pickerMapRef} className="w-full h-48 rounded-lg bg-slate-100 cursor-crosshair border border-slate-100 relative">
                                                                    {/* Loading or placeholder if google not ready? Map will render over this. */}
                                                                </div>
                                                                <p className="text-[10px] text-center text-slate-400 mt-1 italic">
                                                                    {lang === 'id' ? "Klik atau geser pin untuk menentukan lokasi." : "Click or drag pin to set location."}
                                                                </p>
                                                            </div>
                                                        )}

                                                        {formData.staticLocation && (
                                                            <p className="text-[10px] text-green-600 text-center font-mono bg-green-50 py-1 rounded border border-green-100">
                                                                Selected: {formData.staticLocation.latitude.toFixed(5)}, {formData.staticLocation.longitude.toFixed(5)}
                                                            </p>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}

                                {/* Personal Fields (Hidden for Communities) */}
                                {!profile.isCommunity && (
                                    <>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                                    {lang === 'id' ? 'Umur (Tahun)' : 'Age (Years)'}
                                                </label>
                                                <input
                                                    type="number"
                                                    value={formData.age}
                                                    onChange={e => setFormData({ ...formData, age: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white/80"
                                                    placeholder="25"
                                                />
                                            </div>
                                            <div>
                                                <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                                    {lang === 'id' ? 'Jenis Kelamin' : 'Gender'}
                                                </label>
                                                <select
                                                    value={formData.gender}
                                                    onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                                    className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white/80"
                                                >
                                                    <option value="Laki-laki">{lang === 'id' ? 'Laki-laki' : 'Male'}</option>
                                                    <option value="Perempuan">{lang === 'id' ? 'Perempuan' : 'Female'}</option>
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-xs font-bold text-slate-500 uppercase ml-1">{lang === 'id' ? 'Bio' : 'Bio'}</label>
                                            <textarea
                                                value={formData.bio}
                                                onChange={e => setFormData({ ...formData, bio: e.target.value })}
                                                className="w-full px-4 py-2 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white/80"
                                                rows="3"
                                                placeholder={lang === 'id' ? "Ceritakan tentang Anda..." : "Tell us about yourself..."}
                                            />
                                        </div>
                                    </>
                                )}
                            </div>



                            {/* Links Editor */}
                            <div className="mb-8">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1">
                                        {lang === 'id' ? 'Tautan' : 'Links'} ({formData.links.length})
                                    </label>
                                    <button onClick={handleAddLink} className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-lg font-bold hover:bg-blue-200 transition">
                                        + {lang === 'id' ? 'Tambah' : 'Add'}
                                    </button>
                                </div>
                                <div className="space-y-3">
                                    {formData.links.map((link, idx) => (
                                        <div key={link.id || idx} className="bg-slate-50 p-3 rounded-xl border border-slate-200 relative group">
                                            {/* Reorder & Delete Actions */}
                                            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                                                {/* Move Up */}
                                                <button
                                                    onClick={() => handleMoveLink(idx, -1)}
                                                    disabled={idx === 0}
                                                    className={`p-1 rounded-lg border shadow-sm transition ${idx === 0 ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                    title="Move Up"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m18 15-6-6-6 6" /></svg>
                                                </button>

                                                {/* Move Down */}
                                                <button
                                                    onClick={() => handleMoveLink(idx, 1)}
                                                    disabled={idx === formData.links.length - 1}
                                                    className={`p-1 rounded-lg border shadow-sm transition ${idx === formData.links.length - 1 ? 'bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                                                    title="Move Down"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6" /></svg>
                                                </button>

                                                {/* Delete */}
                                                <button onClick={() => handleRemoveLink(idx)} className="bg-white text-red-500 p-1 rounded-lg border border-red-100 shadow-sm hover:bg-red-50 transition opacity-100">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                                </button>
                                            </div>

                                            <div className="flex gap-3">
                                                {/* Icon Picker Trigger */}
                                                <div className="relative">
                                                    <button
                                                        onClick={() => setActiveIconPicker(activeIconPicker === idx ? null : idx)}
                                                        className={`w-12 h-12 rounded-xl flex items-center justify-center ${link.color} text-white shadow-sm hover:scale-105 transition-transform`}
                                                    >
                                                        {getIcon(link.icon || "Link", "w-6 h-6")}
                                                    </button>

                                                    {/* POPOVER: Icon & Color Picker */}
                                                    {activeIconPicker === idx && (
                                                        <div className="absolute top-14 left-0 z-50 bg-white border border-slate-200 shadow-2xl rounded-2xl p-4 w-64 animate-fade-in-up">

                                                            {/* Close Button Mobile Overlay (Optional) */}
                                                            <div className="flex justify-between items-center mb-3">
                                                                <h5 className="text-xs font-bold text-slate-500 uppercase">{lang === 'id' ? 'Ikon & Warna' : 'Icon & Color'}</h5>
                                                                <button onClick={() => setActiveIconPicker(null)} className="text-slate-400 hover:text-slate-600">
                                                                    {getIcon('x', 'w-4 h-4')}
                                                                </button>
                                                            </div>

                                                            {/* Colors */}
                                                            <div className="mb-4">
                                                                <div className="flex flex-wrap gap-2">
                                                                    {AVAILABLE_COLORS.map(colorClass => (
                                                                        <button
                                                                            key={colorClass}
                                                                            onClick={() => handleLinkChange(idx, 'color', colorClass)}
                                                                            className={`w-5 h-5 rounded-full ${colorClass} ${link.color === colorClass ? 'ring-2 ring-offset-2 ring-slate-400' : 'hover:scale-110'} transition-all`}
                                                                        />
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Icons Grid */}
                                                            <div className="grid grid-cols-5 gap-2 max-h-48 overflow-y-auto no-scrollbar">
                                                                {Object.keys(ICONS).filter(k => !["x", "qr-code", "share-2", "download", "log-out", "trash-2", "chevron-right", "shuffle"].includes(k)).map(iconKey => (
                                                                    <button
                                                                        key={iconKey}
                                                                        onClick={() => {
                                                                            handleLinkChange(idx, 'icon', iconKey);
                                                                            setActiveIconPicker(null);
                                                                        }}
                                                                        className={`w-8 h-8 rounded-lg flex items-center justify-center hover:bg-slate-100 text-slate-600 ${link.icon === iconKey ? 'bg-blue-50 text-blue-600 ring-1 ring-blue-200' : ''}`}
                                                                        title={iconKey}
                                                                    >
                                                                        {getIcon(iconKey, "w-4 h-4")}
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Inputs */}
                                                <div className="flex-1 grid gap-2 pr-6">
                                                    <input
                                                        value={link.title}
                                                        onChange={e => handleLinkChange(idx, 'title', e.target.value)}
                                                        className="w-full px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-bold focus:outline-none focus:border-blue-500"
                                                        placeholder={lang === 'id' ? "Judul Link" : "Link Title"}
                                                    />

                                                    {/* SMART URL INPUT */}
                                                    {(() => {
                                                        const templatePrefix = URL_TEMPLATES[link.icon];
                                                        // Check if the current URL actually starts with the template
                                                        const isMatch = templatePrefix && link.url.startsWith(templatePrefix);

                                                        return (
                                                            <div className="relative flex items-center w-full rounded-lg border border-slate-200 focus-within:ring-1 focus-within:ring-blue-500 bg-white overflow-hidden">
                                                                {templatePrefix && (
                                                                    <div className="pl-2 pr-1 py-1.5 bg-slate-50 border-r border-slate-100 text-[10px] font-mono text-slate-400 select-none whitespace-nowrap flex items-center">
                                                                        {templatePrefix.replace('https://', '')}
                                                                    </div>
                                                                )}
                                                                <input
                                                                    value={isMatch ? link.url.slice(templatePrefix.length) : link.url}
                                                                    onChange={e => {
                                                                        const val = e.target.value;
                                                                        if (templatePrefix) {
                                                                            // If user clears everything, reset to empty or just prefix? 
                                                                            // Better: just append their typing to prefix
                                                                            handleLinkChange(idx, 'url', templatePrefix + val);
                                                                        } else {
                                                                            handleLinkChange(idx, 'url', val);
                                                                        }
                                                                    }}
                                                                    className="w-full px-2 py-1.5 text-xs font-mono text-slate-600 focus:outline-none bg-transparent"
                                                                    placeholder={templatePrefix ? (lang === 'id' ? "username/nomor" : "username/number") : "https://..."}
                                                                />
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {formData.links.length === 0 && (
                                        <div className="text-center py-4 bg-slate-50 rounded-xl border border-dashed border-slate-300 text-slate-400 text-xs">
                                            {lang === 'id' ? 'Belum ada link. Klik + Tambah.' : 'No links yet. Click + Add to start.'}
                                        </div>
                                    )}
                                </div>
                            </div>


                            {/* COMMUNITY UPGRADE OPTION - ONLY IF NOT COMMUNITY */}
                            {!profile.isCommunity && (
                                <div className="mb-8 p-4 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl text-white relative overflow-hidden">
                                    <div className="relative z-10 flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-lg mb-1">
                                                {lang === 'id' ? 'Buat Akun Komunitas?' : 'Create Community Account?'}
                                            </h4>
                                            <p className="text-blue-100 text-xs max-w-[200px] mb-3">
                                                {lang === 'id'
                                                    ? 'Ubah profil ini menjadi halaman resmi komunitas Anda. Punya fitur khusus!'
                                                    : 'Turn this profile into your official community page. Get exclusive features!'}
                                            </p>
                                        </div>
                                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setShowCommunityReg(true)}
                                        className="relative z-10 w-full bg-white text-blue-600 py-2.5 rounded-xl font-bold text-sm hover:bg-blue-50 transition shadow-lg"
                                    >
                                        {lang === 'id' ? 'Mulai Pendaftaran' : 'Start Registration'}
                                    </button>
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex gap-3 pt-4 border-t border-slate-100">
                                <button
                                    onClick={() => setIsEditing(false)}
                                    className="flex-1 py-3 text-sm text-slate-600 font-bold bg-slate-100 rounded-xl hover:bg-slate-200 transition"
                                >
                                    {lang === 'id' ? 'Batal' : 'Cancel'}
                                </button>
                                <button
                                    onClick={handleSave}
                                    className="flex-1 py-3 text-sm text-white font-bold bg-blue-600 rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-500/30 transition transform active:scale-95"
                                >
                                    {lang === 'id' ? 'Simpan' : 'Save All'}
                                </button>
                            </div>

                            {/* Danger Zone */}
                            <div className="mt-8 pt-6 border-t border-red-100">
                                <h4 className="text-xs font-bold text-red-500 uppercase mb-2">
                                    {lang === 'id' ? 'Area Berbahaya' : 'Danger Zone'}
                                </h4>
                                <button
                                    onClick={handleDeleteAccount}
                                    className="w-full py-3 text-sm text-red-600 font-bold bg-white border border-red-200 rounded-xl hover:bg-red-50 transition flex items-center justify-center gap-2"
                                >
                                    {getIcon('trash-2', 'w-4 h-4')}
                                    {lang === 'id' ? 'Hapus Akun Permanen' : 'Delete Account Permanently'}
                                </button>
                                <p className="text-[10px] text-red-400 text-center mt-2">
                                    {lang === 'id'
                                        ? 'Tindakan ini tidak bisa dibatalkan. Link profil Anda akan mati.'
                                        : 'This action cannot be undone. Your profile link will eventually expire.'}
                                </p>
                            </div>
                        </div>
                    )}
                </motion.div>
                {/* COMMUNITY REGISTRATION MODAL */}
                <AnimatePresence>
                    {showCommunityReg && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[70] bg-black/80 backdrop-blur-md flex items-end md:items-center justify-center p-0 md:p-4"
                        >
                            <motion.div
                                initial={{ y: "100%" }}
                                animate={{ y: 0 }}
                                exit={{ y: "100%" }}
                                className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl p-6 md:p-8 h-[85vh] md:h-auto overflow-y-auto relative shadow-2xl"
                            >
                                <div className="absolute top-4 right-4">
                                    <button onClick={() => setShowCommunityReg(false)} className="p-2 bg-slate-100 rounded-full hover:bg-slate-200">
                                        {getIcon('x', 'w-5 h-5 text-slate-600')}
                                    </button>
                                </div>

                                {/* Header */}
                                <div className="text-center mb-8">
                                    <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                    </div>
                                    <h2 className="text-2xl font-bold text-slate-900 leading-tight">
                                        {lang === 'id' ? 'Daftar Komunitas' : 'Register Community'}
                                    </h2>
                                    <p className="text-slate-500 text-sm mt-2">
                                        {lang === 'id'
                                            ? 'Ubah akun personal Anda menjadi akun resmi komunitas.'
                                            : 'Transform your personal account into an official community account.'}
                                    </p>
                                </div>

                                {/* Form */}
                                <div className="space-y-4 mb-8">
                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">
                                            {lang === 'id' ? 'Nama Komunitas' : 'Community Name'}
                                        </label>
                                        <div className="px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-bold">
                                            {formData.name || profile.displayName}
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1 ml-1">
                                            {lang === 'id' ? '*Diambil dari Nama Tampilan profil Anda' : '*Taken from your Display Name'}
                                        </p>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">
                                            {lang === 'id' ? 'Kategori' : 'Category'}
                                        </label>
                                        <select
                                            value={commTabData.category}
                                            onChange={e => setCommTabData({ ...commTabData, category: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 font-semibold focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                                        >
                                            {COMMUNITY_CATEGORIES.map(cat => (
                                                <option key={cat} value={cat}>{t('cat_' + cat) || cat}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">
                                            {lang === 'id' ? 'Deskripsi Komunitas' : 'Description'}
                                        </label>
                                        <textarea
                                            value={commTabData.description}
                                            onChange={e => setCommTabData({ ...commTabData, description: e.target.value })}
                                            className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                                            rows="4"
                                            placeholder={lang === 'id' ? "Jelaskan visi & misi komunitas..." : "Describe your community..."}
                                        />
                                    </div>
                                </div>

                                {/* Payment Simulation */}
                                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 mb-6">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-slate-600">{lang === 'id' ? 'Biaya Aktivasi' : 'Activation Fee'}</span>
                                        <span className="font-bold text-slate-900">{lang === 'id' ? 'IDR 0 (Gratis)' : 'IDR 0 (Free)'}</span>
                                    </div>
                                    <div className="flex justify-between items-center text-xs text-slate-400">
                                        <span>{lang === 'id' ? 'Durasi Langganan' : 'Subscription Duration'}</span>
                                        <span>{lang === 'id' ? 'Selamanya' : 'Forever'}</span>
                                    </div>
                                </div>

                                <button
                                    onClick={handleRegisterCommunity}
                                    disabled={commTabData.isProcessing}
                                    className={`w-full py-4 rounded-xl font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all ${commTabData.isProcessing ? 'bg-slate-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02]'}`}
                                >
                                    {commTabData.isProcessing ? (
                                        <>
                                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                            Processing...
                                        </>
                                    ) : (
                                        <>
                                            {lang === 'id' ? 'Aktifkan Komunitas' : 'Activate Community'}
                                        </>
                                    )}
                                </button>

                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Avatar Fullscreen Modal */}
            <AnimatePresence>
                {zoomedAvatar && profile.avatar && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setZoomedAvatar(false)}
                        className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out backdrop-blur-sm"
                    >
                        <motion.div 
                            initial={{ scale: 0.9 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0.9 }}
                            className="relative max-w-[95vw] max-h-[90vh]"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <img
                                src={profile.avatar}
                                alt="Avatar zoom"
                                className="w-full h-full object-contain rounded-full max-w-[90vw] max-h-[90vh] shadow-2xl"
                            />
                            <button 
                                className="absolute top-2 right-2 md:top-4 md:right-4 text-white bg-black/50 hover:bg-black/80 p-2 rounded-full transition backdrop-blur-md border border-white/20"
                                onClick={() => setZoomedAvatar(false)}
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div >
    );
};

window.ProfileView = ProfileView;
