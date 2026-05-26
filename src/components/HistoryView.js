// src/components/HistoryView.js

const HistoryView = ({ t, lang }) => {
    const { motion, AnimatePresence } = window.Motion;
    const { useEffect, useState } = React;
    const { auth, db } = window;

    const [connections, setConnections] = useState([]);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(auth.currentUser);
    const [requests, setRequests] = useState([]);
    const [activeChatUser, setActiveChatUser] = useState(null);
    const ChatRoom = window.ChatRoom;
    // FIX: Call hook at top level
    const history = window.ReactRouterDOM.useHistory();


    // Listen to Auth State
    useEffect(() => {
        const unsub = auth.onAuthStateChanged(u => {
            setUser(u);
            if (!u) {
                setConnections([]);
                setRequests([]);
                setLoading(false);
            }
        });
        return () => unsub();
    }, []);

    // Listen to Requests Sub-collection
    useEffect(() => {
        if (!user) return;

        const unsubscribe = db.collection('users')
            .doc(user.uid)
            .collection('requests')
            .orderBy('timestamp', 'desc')
            .onSnapshot(snapshot => {
                const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // FILTER: Exclude requests from users we are ALREADY connected to
                const validRequests = fetched.filter(req => !connections.some(c => c.uid === req.fromUid));
                setRequests(validRequests);
            }, (err) => console.error("Requests Error:", err));

        return () => unsubscribe();
    }, [user, connections]);

    // Listen to Connections Sub-collection
    useEffect(() => {
        if (!user) return;

        console.log("Listening to connections for:", user.uid);
        const unsubscribe = db.collection('users')
            .doc(user.uid)
            .collection('connections')
            .orderBy('savedAt', 'desc')
            .onSnapshot(snapshot => {
                const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setConnections(fetched);
                setLoading(false);

                // AUTO-SYNC: Check for profile updates in background
                syncStaleConnections(fetched);

            }, (err) => {
                console.error("Connections Error:", err);
                setLoading(false);
            });

        // Helper: Sync Stale Connections
        const syncStaleConnections = async (currentConnections) => {
            if (!currentConnections || currentConnections.length === 0) return;

            // 1. Get UIDs needing check (limit to first 10 for performance/optimization in this view)
            const uidsToCheck = currentConnections
                .map(c => c.uid)
                .filter(uid => uid && uid !== 'unknown')
                .slice(0, 10); // Batch size limit

            if (uidsToCheck.length === 0) return;

            try {
                // 2. Fetch latest User Profiles
                // Note: 'in' queries limited to 10
                const usersSnap = await db.collection('users')
                    .where(window.firebase.firestore.FieldPath.documentId(), 'in', uidsToCheck)
                    .get();

                if (usersSnap.empty) return;

                const batch = db.batch();
                let updatesCount = 0;

                usersSnap.forEach(userDoc => {
                    const latest = userDoc.data();
                    const existing = currentConnections.find(c => c.uid === userDoc.id);

                    if (!existing) return;

                    // 3. Compare Fields
                    const needsUpdate =
                        latest.displayName !== existing.displayName ||
                        latest.username !== existing.username ||
                        (latest.avatar !== existing.avatar && latest.avatar) ||
                        (latest.bio || latest.role) !== existing.role ||
                        (latest.age || "") !== (existing.age || "") ||
                        (latest.gender || "") !== (existing.gender || "") ||
                        (latest.isCommunity || false) !== (existing.isCommunity || false) ||
                        (latest.communityCategory || "") !== (existing.communityCategory || "");

                    if (needsUpdate) {
                        const connRef = db.collection('users').doc(user.uid).collection('connections').doc(existing.id);
                        batch.update(connRef, {
                            displayName: latest.displayName || existing.displayName,
                            username: latest.username || existing.username,
                            avatar: latest.avatar || existing.avatar,
                            role: latest.bio || latest.role || existing.role || "Boond User",
                            age: latest.age || "",
                            gender: latest.gender || "",
                            isCommunity: latest.isCommunity || false,
                            communityCategory: latest.communityCategory || ""
                        });
                        updatesCount++;
                    }
                });

                if (updatesCount > 0) {
                    console.log(`Auto-syncing ${updatesCount} connections...`);
                    await batch.commit();
                }
            } catch (err) {
                console.error("Sync Error:", err);
            }
        };

        return () => unsubscribe();
    }, [user]);

    // --- NEW: CHAT LISTENER & REQUEST MERGING ---
    useEffect(() => {
        if (!user) return;

        const unsubscribe = db.collection('chats')
            .where('participants', 'array-contains', user.uid)
            .onSnapshot(async snapshot => {
                const chatDocs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                // 1. Calculate Global Unread & Update Connections
                const newUnreadCounts = {};
                const messageRequests = [];

                for (const chat of chatDocs) {
                    const partnerUid = chat.participants.find(uid => uid !== user.uid);
                    if (!partnerUid) continue;

                    const unread = chat[`unreadCount_${user.uid}`] || 0;

                    // Check if connected (Check both uid field and doc ID for robustness)
                    const isConnected = connections.some(c => c.uid === partnerUid || c.id === partnerUid);

                    if (isConnected) {
                        if (unread > 0) newUnreadCounts[partnerUid] = unread;
                    } else {
                        // It's a Message Request
                        // We need basic partner info. Try to get from participants or fetch?
                        // For efficiency, we might need a user cache, but for now let's use a placeholder or active fetch
                        // (Ideally, chat doc should store partner snapshot, but we didn't implement that fully)
                        // We'll try to fetch user profile if it's a new request

                        // We construct a "Request-like" object
                        messageRequests.push({
                            id: `chat_${chat.id}`,
                            fromUid: partnerUid,
                            type: 'message_request',
                            timestamp: chat.timestamp,
                            unread: unread,
                            chatId: chat.id
                        });
                    }
                }

                // Update Connections with Unread Badges (Local State Injection)
                setConnections(prev => prev.map(c => ({
                    ...c,
                    unread: newUnreadCounts[c.uid] || 0
                })));

                // Merge Message Requests with Connection Requests
                if (messageRequests.length > 0) {
                    // Fetch profiles for message requests if needed (bulk)
                    const uidsToFetch = messageRequests.map(m => m.fromUid);
                    const usersSnap = await db.collection('users').where(window.firebase.firestore.FieldPath.documentId(), 'in', uidsToFetch).get();
                    const userMap = {};
                    usersSnap.forEach(doc => userMap[doc.id] = doc.data());

                    const hydratedMsgRequests = messageRequests.map(req => {
                        const profile = userMap[req.fromUid] || {};
                        return {
                            ...req,
                            fromName: profile.displayName || "User",
                            fromUsername: profile.username || "@user",
                            fromAvatar: profile.avatar || profile.photoURL,
                            fromRole: "Start a conversation",
                            fromAge: profile.age,
                            fromGender: profile.gender
                        };
                    });

                    setRequests(prev => {
                        // Filter out existing standard requests from same user to avoid dupes?
                        // Or just append. Let's append but unique by ID.
                        const others = prev.filter(r => r.type !== 'message_request');
                        return [...others, ...hydratedMsgRequests].sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));
                    });
                } else {
                    // Remove old message requests
                    setRequests(prev => prev.filter(r => r.type !== 'message_request'));
                }

            });



        return () => unsubscribe();
    }, [user, connections]); // Re-run when connections list changes to re-filter

    const handleAccept = async (req) => {
        try {
            const batch = db.batch();
            const me = window.currentUser || auth.currentUser;

            // 0. Fetch LATEST Sender Data (Ensure freshness)
            const senderDoc = await db.collection('users').doc(req.fromUid).get();
            const senderData = senderDoc.exists ? senderDoc.data() : req; // Fallback to req if fetch fails

            // 1. Add sender to my connections (Using LATEST sender data)
            const myConnRef = db.collection('users').doc(me.uid).collection('connections').doc(req.fromUid);
            batch.set(myConnRef, {
                uid: req.fromUid,
                displayName: senderData.displayName || req.fromName || "User",
                username: senderData.username || req.fromUsername || "@user",
                avatar: senderData.avatar || req.fromAvatar,
                role: senderData.bio || senderData.role || req.fromRole || "Connection",
                age: senderData.age || req.fromAge || "",
                gender: senderData.gender || req.fromGender || "",
                isCommunity: senderData.isCommunity || false,
                communityCategory: senderData.communityCategory || "",
                savedAt: new Date()
            });

            // 2. Add me to sender's connections (Using MY latest data)
            const senderConnRef = db.collection('users').doc(req.fromUid).collection('connections').doc(me.uid);
            batch.set(senderConnRef, {
                uid: me.uid,
                displayName: me.displayName || "User",
                username: me.username || "@user",
                avatar: me.avatar || me.photoURL, // Prefer Firestore avatar
                role: me.bio || me.role || "Boond User",
                age: me.age || "",
                gender: me.gender || "",
                isCommunity: me.isCommunity || false,
                communityCategory: me.communityCategory || "",
                savedAt: new Date()
            });

            // 3. Delete Request
            const reqRef = db.collection('users').doc(me.uid).collection('requests').doc(req.id);
            batch.delete(reqRef);

            await batch.commit();
        } catch (err) {
            console.error("Accept Error:", err);
            alert("Error: " + err.message);
        }
    };

    const handleReject = async (reqId) => {
        if (!window.confirm(lang === 'id' ? "Tolak permintaan ini?" : "Reject this request?")) return;
        try {
            await db.collection('users').doc(user.uid).collection('requests').doc(reqId).delete();
        } catch (err) {
            console.error("Reject Error:", err);
        }
    };

    useEffect(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, [connections, requests]); // Re-run icons when lists update

    const formatDate = (timestamp) => {
        if (!timestamp) return "";
        // Convert Firestore Timestamp to Date JS
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return `${Math.floor(diffInSeconds / 86400)}d ago`;
    };

    const getCategoryColor = (cat) => {
        const colors = {
            "Sport": "bg-orange-100 text-orange-600",
            "Music": "bg-purple-100 text-purple-600",
            "Technology": "bg-blue-100 text-blue-600",
            "Business": "bg-slate-100 text-slate-600",
            "Social": "bg-pink-100 text-pink-600",
            "Education": "bg-green-100 text-green-600",
            "Art": "bg-rose-100 text-rose-600",
            "Gaming": "bg-indigo-100 text-indigo-600"
        };
        return colors[cat] || "bg-gray-100 text-gray-600";
    };

    return (
        <div className="w-full min-h-screen p-6 pb-24">
            <header className="mb-8 pt-24 relative z-10 text-center">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">{t('history_title')}</h1>
                <p className="text-slate-600 font-medium text-sm md:text-base">{t('history_subtitle')}</p>
            </header>

            {!user ? (
                <div className="text-center py-20 opacity-50">
                    <p className="text-lg font-bold">{t('history_login_title')}</p>
                    <p className="text-sm">{t('history_login_desc')}</p>
                </div>
            ) : loading ? (
                <div className="flex justify-center py-20">
                    <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                </div>
            ) : (
                <div className="max-w-md mx-auto spacing-y-4">

                    {/* Incoming Requests Section */}
                    {requests.length > 0 && (
                        <div className="mb-8">
                            <h2 className="text-lg font-bold text-slate-800 mb-4 px-1 flex items-center gap-2">
                                <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{requests.length}</span>
                                {lang === 'id' ? "Permintaan Masuk" : "Incoming Requests"}
                            </h2>
                            <div className="space-y-3">
                                {requests.map(req => (
                                    <div key={req.id} className="bg-white p-4 rounded-2xl shadow-sm border border-blue-100 flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 flex-shrink-0">
                                            <img src={req.fromAvatar} alt={req.fromName} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className="font-bold text-slate-900 truncate">{req.fromName}</h3>
                                            <p className="text-xs text-blue-600 font-medium truncate">{req.fromUsername}</p>
                                            <p className="text-xs text-slate-500 truncate mt-0.5">{req.fromRole || "Boond User"}</p>

                                            {/* Badges */}
                                            {(req.fromAge || req.fromGender) && (
                                                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                                    {req.fromAge && (
                                                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                                            🎂 {req.fromAge}
                                                        </span>
                                                    )}
                                                    {req.fromGender && (
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${['Laki-laki', 'Male'].includes(req.fromGender) ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                                            {['Laki-laki', 'Male'].includes(req.fromGender)
                                                                ? (lang === 'id' ? 'Laki-laki' : 'Male')
                                                                : (lang === 'id' ? 'Perempuan' : 'Female')}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => handleReject(req.id)}
                                                className="w-8 h-8 flex items-center justify-center rounded-full border border-red-200 text-red-500 hover:bg-red-50 transition"
                                            >
                                                <i data-lucide="x" className="w-4 h-4"></i>
                                            </button>

                                            {/* Action Button: Accept (if standard) or Chat (if message request) */}
                                            {req.type === 'message_request' ? (
                                                <>
                                                    <button
                                                        onClick={() => setActiveChatUser({
                                                            uid: req.fromUid,
                                                            displayName: req.fromName,
                                                            username: req.fromUsername,
                                                            avatar: req.fromAvatar
                                                        })}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 hover:bg-blue-200 transition shadow-sm relative"
                                                    >
                                                        <i data-lucide="message-circle" className="w-4 h-4"></i>
                                                        {req.unread > 0 && (
                                                            <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
                                                        )}
                                                    </button>
                                                    <button
                                                        onClick={() => handleAccept(req)}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                                                    >
                                                        <i data-lucide="check" className="w-4 h-4"></i>
                                                    </button>
                                                </>
                                            ) : (
                                                <button
                                                    onClick={() => handleAccept(req)}
                                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
                                                >
                                                    <i data-lucide="check" className="w-4 h-4"></i>
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {connections.length === 0 ? (
                        <div className="text-center py-10 opacity-50">
                            <div className="text-4xl mb-4">📭</div>
                            <p className="text-lg font-bold">{t('history_empty_title')}</p>
                            <p className="text-sm">{t('history_empty_desc')}</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <AnimatePresence>
                                {connections.map((item, idx) => (
                                    <motion.div
                                        key={item.id}
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -50 }}
                                        transition={{ delay: idx * 0.05 }}
                                        onClick={async () => {
                                            if (!history) return;

                                            let targetUsername = item.username;

                                            // Smart Navigation: Resolve latest username via UID if possible
                                            if (item.uid && item.uid !== "unknown") {
                                                try {
                                                    const userDoc = await window.db.collection('users').doc(item.uid).get();
                                                    if (userDoc.exists) {
                                                        const userData = userDoc.data();
                                                        if (userData.username && userData.username !== item.username) {
                                                            console.log(`Smart Nav: Cleaning up database ${item.username} -> ${userData.username}`);
                                                            targetUsername = userData.username;

                                                            // AUTO-FIX: Update the stale data in OUR connections list
                                                            window.db.collection('users')
                                                                .doc(window.auth.currentUser.uid)
                                                                .collection('connections')
                                                                .doc(item.id)
                                                                .update({
                                                                    username: userData.username,
                                                                    displayName: userData.displayName || item.displayName, // Update name too if changed
                                                                    avatar: userData.avatar || item.avatar // Update avatar too
                                                                })
                                                                .catch(e => console.error("Auto-fix failed:", e));
                                                        }
                                                    }
                                                } catch (err) {
                                                    console.error("Smart Nav Error:", err);
                                                }
                                            }

                                            const targetSlug = targetUsername ? targetUsername.replace('@', '') : item.id;
                                            history.push(`/profile/${targetSlug}`);
                                        }}
                                        className="flex items-center gap-4 bg-white/60 backdrop-blur-xl p-4 rounded-2xl border border-white/50 hover:bg-white transition shadow-sm hover:shadow-md cursor-pointer group relative overflow-hidden"
                                    >
                                        <div className="relative">
                                            <img
                                                src={item.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + item.id}
                                                className={`${item.isCommunity ? 'w-14 h-14 rounded-xl' : 'w-12 h-12 rounded-full'} border-2 border-white shadow-sm object-cover transition-all`}
                                                alt={item.displayName}
                                            />
                                            {item.isCommunity && (
                                                <div className="absolute -bottom-1 -right-1 bg-blue-500 text-white p-0.5 rounded-full border-2 border-white">
                                                    <svg className="w-3 h-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-0.5">
                                                <h3 className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate text-base">
                                                    {item.displayName}
                                                </h3>
                                                {item.isCommunity && (
                                                    <svg className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" className="text-blue-100" /><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
                                                )}
                                            </div>

                                            {item.isCommunity ? (
                                                <div className="flex items-center gap-2">
                                                    {item.communityCategory && (
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${getCategoryColor(item.communityCategory)}`}>
                                                            {t('cat_' + item.communityCategory) || item.communityCategory}
                                                        </span>
                                                    )}
                                                    <p className="text-xs text-slate-400 font-medium truncate">{item.username}</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <p className="text-xs text-blue-500/80 font-medium mb-0.5 truncate">{item.username}</p>
                                                    <p className="text-slate-500 text-xs line-clamp-1">{item.role || "Boond User"}</p>
                                                </>
                                            )}

                                            {/* Attributes: Only for Personal Accounts */}
                                            {!item.isCommunity && (item.age || item.gender) && (
                                                <div className="flex gap-1.5 mt-1.5 flex-wrap">
                                                    {item.age && (
                                                        <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                                                            🎂 {item.age}
                                                        </span>
                                                    )}
                                                    {item.gender && (
                                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${['Laki-laki', 'Male'].includes(item.gender) ? 'bg-blue-50 text-blue-600' : 'bg-pink-50 text-pink-600'}`}>
                                                            {['Laki-laki', 'Male'].includes(item.gender)
                                                                ? (lang === 'id' ? 'Laki-laki' : 'Male')
                                                                : (lang === 'id' ? 'Perempuan' : 'Female')}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-2">
                                            <span className="text-xs font-bold text-slate-400 block">{formatDate(item.savedAt)}</span>

                                            <div className="flex items-center gap-2 mt-auto">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setActiveChatUser(item);
                                                    }}
                                                    className="p-2 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 transition relative"
                                                >
                                                    <i data-lucide="message-circle" className="w-4 h-4"></i>
                                                    {item.unread > 0 && (
                                                        <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border border-white"></span>
                                                    )}
                                                </button>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation(); // Prevent navigation
                                                        if (window.confirm(lang === 'id' ? "Hapus kontak ini?" : "Delete this contact?")) {
                                                            // Delete from Firestore
                                                            window.db.collection('users')
                                                                .doc(window.auth.currentUser.uid)
                                                                .collection('connections')
                                                                .doc(item.id) // Correct: Use the Firestore Doc ID directly
                                                                .delete()
                                                                .then(() => {
                                                                    // Toast or alert handled by UI update automatically via snapshot
                                                                })
                                                                .catch(err => {
                                                                    alert("Error: " + err.message);
                                                                });
                                                        }
                                                    }}
                                                    className="p-2 rounded-full bg-red-50 text-red-500 hover:bg-red-100 transition"
                                                >
                                                    <i data-lucide="trash-2" className="w-4 h-4"></i>
                                                </button>
                                                <i data-lucide="chevron-right" className="w-4 h-4 text-slate-300 group-hover:text-blue-500 transition-colors"></i>
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>
                        </div>
                    )
                    }

                    {
                        connections.length > 5 && (
                            <div className="mt-8 text-center">
                                <button className="text-xs font-bold text-slate-400 hover:text-slate-600 transition uppercase tracking-wider">
                                    {t('history_view_all')}
                                </button>
                            </div>
                        )
                    }
                </div >
            )}

            {/* Chat Room Overlay */}
            <AnimatePresence>
                {activeChatUser && ChatRoom && (
                    <ChatRoom
                        currentUser={window.auth.currentUser}
                        targetUser={activeChatUser}
                        onClose={() => setActiveChatUser(null)}
                    />
                )}
            </AnimatePresence>
        </div>
    );
};

window.HistoryView = HistoryView;
