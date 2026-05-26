
const ChatRoom = ({ currentUser, targetUser, onClose, isConnected = false }) => {
    const { useEffect, useState, useRef } = React;
    const { AnimatePresence, motion } = window.Motion;
    const { db } = window;

    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState("");
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    // 1. Generate Chat ID
    const chatId = [currentUser.uid, targetUser.uid].sort().join('_');

    // 2. Fetch Messages
    useEffect(() => {
        const unsubscribe = db.collection('chats')
            .doc(chatId)
            .collection('messages')
            .orderBy('timestamp', 'asc')
            .onSnapshot(snapshot => {
                const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setMessages(msgs);
                setLoading(false);

                // Mark as Read Logic
                const batch = db.batch();
                let hasUpdates = false;
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.senderId !== currentUser.uid && !data.isRead) {
                        batch.update(doc.ref, { isRead: true });
                        hasUpdates = true;
                    }
                });
                if (hasUpdates) batch.commit();

            }, err => console.error("Chat Error:", err));

        // Reset My Unread Count on Open
        db.collection('chats').doc(chatId).set({
            [`unreadCount_${currentUser.uid}`]: 0
        }, { merge: true }).catch(e => console.log("Init read count error", e));

        return () => unsubscribe();
    }, [chatId, currentUser.uid]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const text = newMessage.trim();
        setNewMessage("");

        try {
            await db.collection('chats').doc(chatId).collection('messages').add({
                text: text,
                senderId: currentUser.uid,
                timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                isRead: false
            });

            // Update Chat Meta
            const chatRef = db.collection('chats').doc(chatId);
            await chatRef.set({
                lastMessage: text,
                timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                participants: [currentUser.uid, targetUser.uid],
                [`unreadCount_${targetUser.uid}`]: window.firebase.firestore.FieldValue.increment(1)
            }, { merge: true });

            // AUTO-CONNECTION REQUEST LOGIC
            // If not connected, sending a message should effectively be a "Request"
            if (!isConnected) {
                const reqRef = db.collection('users').doc(targetUser.uid).collection('requests');
                const existingReq = await reqRef.where('fromUid', '==', currentUser.uid).get();

                if (existingReq.empty) {
                    await reqRef.add({
                        fromUid: currentUser.uid,
                        fromName: currentUser.displayName || "User",
                        fromUsername: currentUser.username || "@user",
                        fromAvatar: currentUser.avatar || currentUser.photoURL,
                        fromRole: currentUser.bio || "Boond User",
                        fromAge: currentUser.age || "",
                        fromGender: currentUser.gender || "",
                        timestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
                        type: 'message_request' // Tag it just in case
                    });
                }
            }

        } catch (err) {
            console.error("Send Error:", err);
            alert("Failed to send message.");
        }
    };

    // Helper: Format Date for Separator
    const getGroupDate = (timestamp) => {
        if (!timestamp) return "Sending...";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        const today = new Date();
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === today.toDateString()) return "Hari ini";
        if (date.toDateString() === yesterday.toDateString()) return "Kemarin";

        return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // Helper: Format Time for Bubble
    const formatTime = (timestamp) => {
        if (!timestamp) return "...";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');
    };

    // Helper: Group Messages
    const groupedMessages = [];
    let lastDate = null;
    messages.forEach(msg => {
        const dateGroup = getGroupDate(msg.timestamp);
        if (dateGroup !== lastDate) {
            groupedMessages.push({ type: 'separator', date: dateGroup });
            lastDate = dateGroup;
        }
        groupedMessages.push({ type: 'message', ...msg });
    });

    return window.ReactDOM.createPortal(
        <motion.div
            initial={{ opacity: 0, y: "20px" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            className="fixed top-0 left-0 right-0 h-[100dvh] z-[100] bg-white flex flex-col shadow-2xl overflow-hidden md:max-w-md md:mx-auto md:top-[120px] md:bottom-10 md:h-auto md:rounded-3xl"
        >
            {/* Header (Flex Item, Sticky at Top) */}
            <div className="flex-none bg-white px-4 pt-4 pb-3 border-b border-slate-200 flex items-center justify-between shadow-sm z-[102] relative">
                <div className="flex items-center gap-3">
                    <button onClick={onClose} className="p-2 -ml-2 hover:bg-slate-100 rounded-full transition text-slate-600">
                        {window.lucide.icons ? <i data-lucide="chevron-left"></i> : "Back"}
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                    </button>
                    <div className="w-10 h-10 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                        <img src={targetUser.avatar || targetUser.photoURL} alt={targetUser.username} className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 leading-tight">{targetUser.displayName || targetUser.name || "User"}</h3>
                        <p className="text-xs text-slate-500 font-medium">{targetUser.username || "@username"}</p>
                    </div>
                </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-2">
                {groupedMessages.map((item, idx) => {
                    if (item.type === 'separator') {
                        return (
                            <div key={`sep-${idx}`} className="flex justify-center my-4">
                                <span className="bg-slate-200/60 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                                    {item.date}
                                </span>
                            </div>
                        );
                    }

                    const isMe = item.senderId === currentUser.uid;

                    return (
                        <div key={item.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-2 relative shadow-sm ${isMe
                                ? 'bg-blue-600 text-white rounded-br-none'
                                : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                                }`}>
                                <p className="text-sm leading-relaxed whitespace-pre-wrap">{item.text}</p>

                                <div className={`flex items-center justify-end gap-1 mt-1 ${isMe ? 'text-blue-100' : 'text-slate-400'}`}>
                                    <span className="text-[10px] font-medium opacity-80">
                                        {formatTime(item.timestamp)}
                                    </span>
                                    {isMe && (
                                        <span className="flex items-center">
                                            {item.isRead ? (
                                                <div className="flex -space-x-1">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-blue-200"><polyline points="20 6 9 17 4 12" /></svg>
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-blue-200"><polyline points="20 6 9 17 4 12" /></svg>
                                                </div>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="opacity-70"><polyline points="20 6 9 17 4 12" /></svg>
                                            )}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Sticky Bottom */}
            <div className="flex-none bg-white p-3 pb-[85px] md:pb-3 border-t border-slate-200 z-[102]">
                <form onSubmit={handleSend} className="flex items-end gap-2 pb-4 md:pb-3">
                    <textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Tulis pesan..."
                        className="flex-1 bg-slate-100 border-0 rounded-2xl px-4 py-3 text-sm text-black focus:ring-2 focus:ring-blue-500 focus:bg-white transition resize-none max-h-32 min-h-[44px]"
                        rows="1"
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="bg-blue-600 text-white w-11 h-11 rounded-full flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition shadow-lg shadow-blue-500/20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
                    </button>
                </form>
            </div>
        </motion.div>,
        document.body
    );
};

window.ChatRoom = ChatRoom;
