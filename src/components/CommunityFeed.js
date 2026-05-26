// src/components/CommunityFeed.js

const CommunityFeed = ({ profile, isOwner, db, getIcon, lang }) => {
    const { useState, useEffect } = React;
    const { motion, AnimatePresence } = window.Motion;

    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showEditor, setShowEditor] = useState(false);

    // Editor State
    const [newPost, setNewPost] = useState({
        title: "",
        content: "",
        image: ""
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch Posts
    useEffect(() => {
        if (!profile?.uid || !db) return;

        const unsubscribe = db.collection('users').doc(profile.uid).collection('posts')
            .orderBy('timestamp', 'desc')
            .onSnapshot(snapshot => {
                const loadedPosts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setPosts(loadedPosts);
                setLoading(false);
            }, err => {
                console.error("Error fetching posts:", err);
                setLoading(false);
            });

        return () => unsubscribe();
    }, [profile?.uid, db]);

    // Handle Create Post
    const handleCreatePost = async () => {
        if (!newPost.title || !newPost.content) {
            alert(lang === 'id' ? "Mohon isi judul dan konten." : "Please fill title and content.");
            return;
        }

        setIsSubmitting(true);
        try {
            await db.collection('users').doc(profile.uid).collection('posts').add({
                title: newPost.title,
                content: newPost.content,
                image: newPost.image || "", // ALLOW EMPTY IMAGE (Text-only post)
                timestamp: new Date()
            });

            setNewPost({ title: "", content: "", image: "" });
            setShowEditor(false);
            setIsSubmitting(false);
            alert(lang === 'id' ? "Post berhasil diterbitkan!" : "Post published successfully!");
        } catch (err) {
            console.error("Post Error:", err);
            setIsSubmitting(false);
            alert("Error: " + err.message);
        }
    };

    // Handle Delete Post
    const handleDeletePost = async (postId) => {
        if (!window.confirm(lang === 'id' ? "Hapus postingan ini?" : "Delete this post?")) return;

        try {
            await db.collection('users').doc(profile.uid).collection('posts').doc(postId).delete();
        } catch (err) {
            console.error("Delete Error:", err);
            alert("Error deleting post.");
        }
    };

    return (
        <div className="w-full max-w-4xl mx-auto mt-8 mb-20 px-4">
            {/* Header Section */}
            <div className="flex justify-between items-end mb-6">
                <div>
                    <h3 className="text-xl font-bold text-slate-900">
                        {lang === 'id' ? 'Kabar Terbaru' : 'Community Updates'}
                    </h3>
                    <p className="text-slate-500 text-sm">
                        {lang === 'id' ? 'Aktivitas & Berita Komunitas' : 'Activities & News'}
                    </p>
                </div>
                {isOwner && (
                    <button
                        onClick={() => setShowEditor(true)}
                        className="bg-slate-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 hover:bg-slate-800 transition shadow-lg shadow-slate-900/20"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                        {lang === 'id' ? 'Tulis Baru' : 'New Post'}
                    </button>
                )}
            </div>

            {/* List Posts */}
            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2].map(n => (
                        <div key={n} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 animate-pulse">
                            <div className="h-40 bg-slate-200 rounded-xl mb-4"></div>
                            <div className="h-6 bg-slate-200 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/2"></div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {posts.length === 0 ? (
                        <div className="col-span-full text-center py-12 bg-slate-50 border border-dashed border-slate-200 rounded-3xl">
                            <div className="w-12 h-12 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" x2="8" y1="13" y2="13" /><line x1="16" x2="8" y1="17" y2="17" /><polyline points="10 9 9 9 8 9" /></svg>
                            </div>
                            <p className="text-slate-500 font-medium">
                                {lang === 'id' ? 'Belum ada update terbaru.' : 'No updates yet.'}
                            </p>
                            {isOwner && <p className="text-slate-400 text-xs mt-1">Mulai tulis postingan pertama Anda!</p>}
                        </div>
                    ) : (
                        posts.map((post, idx) => (
                            <motion.div
                                key={post.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.1 }}
                                className="bg-white rounded-3xl overflow-hidden shadow-lg shadow-blue-500/5 border border-slate-100 group flex flex-col"
                            >
                                {/* Image Cover - ONLY IF EXISTS */}
                                {post.image && (
                                    <div className="h-48 bg-slate-100 relative overflow-hidden shrink-0">
                                        <img
                                            src={post.image}
                                            alt={post.title}
                                            className="w-full h-full object-cover group-hover:scale-105 transition duration-700"
                                            onError={(e) => e.target.style.display = 'none'} // Hide broken images
                                        />
                                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                                        <div className="absolute bottom-4 left-4 text-white">
                                            <span className="text-xs font-mono opacity-80 bg-black/30 px-2 py-1 rounded-md backdrop-blur-sm">
                                                {post.timestamp?.seconds
                                                    ? new Date(post.timestamp.seconds * 1000).toLocaleDateString()
                                                    : 'Just now'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="p-6 relative flex-1 flex flex-col">
                                    {isOwner && (
                                        <button
                                            onClick={() => handleDeletePost(post.id)}
                                            className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition p-2 hover:bg-red-50 rounded-full z-10"
                                            title="Delete Post"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /></svg>
                                        </button>
                                    )}

                                    {/* Date for Text-Only Posts */}
                                    {!post.image && (
                                        <span className="text-xs font-mono text-slate-400 mb-2 block">
                                            {post.timestamp?.seconds
                                                ? new Date(post.timestamp.seconds * 1000).toLocaleDateString()
                                                : 'Just now'}
                                        </span>
                                    )}

                                    <h4 className="text-lg font-bold text-slate-900 mb-2 leading-tight">{post.title}</h4>
                                    <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap flex-1">{post.content}</p>
                                </div>
                            </motion.div>
                        ))
                    )}
                </div>
            )}

            {/* EDITOR MODAL */}
            <AnimatePresence>
                {showEditor && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4"
                        onClick={() => setShowEditor(false)}
                    >
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            onClick={e => e.stopPropagation()}
                            className="bg-white w-full md:max-w-lg md:rounded-3xl rounded-t-3xl p-6 h-[90vh] md:h-auto overflow-y-auto relative shadow-2xl"
                        >
                            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                                <h3 className="font-bold text-xl text-slate-900">
                                    {lang === 'id' ? 'Buat Postingan Baru' : 'Create New Post'}
                                </h3>
                                <button onClick={() => setShowEditor(false)} className="p-2 bg-slate-50 rounded-full hover:bg-slate-200 transition">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">
                                        {lang === 'id' ? 'Judul' : 'Title'}
                                    </label>
                                    <input
                                        value={newPost.title}
                                        onChange={e => setNewPost({ ...newPost, title: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                        placeholder={lang === 'id' ? "Judul menarik..." : "Catchy title..."}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">
                                        Image URL (Optional)
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            value={newPost.image}
                                            onChange={e => setNewPost({ ...newPost, image: e.target.value })}
                                            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                                            placeholder="https://..."
                                        />
                                        <button
                                            onClick={() => setNewPost({ ...newPost, image: `https://source.unsplash.com/random/800x600/?${newPost.title.split(' ')[0] || 'community'}` })}
                                            className="px-3 bg-slate-100 rounded-xl hover:bg-slate-200 text-slate-600"
                                            title="Auto Random Image"
                                        >
                                            🎲
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-1 ml-1">
                                        {lang === 'id'
                                            ? 'Biarkan kosong untuk postingan teks saja.'
                                            : 'Leave empty for a text-only post.'}
                                    </p>
                                    {newPost.image && (
                                        <img src={newPost.image} alt="Preview" className="mt-2 w-full h-32 object-cover rounded-xl border border-slate-200" onError={e => e.target.style.display = 'none'} />
                                    )}
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-slate-500 uppercase ml-1 block mb-1">
                                        {lang === 'id' ? 'Konten' : 'Content'}
                                    </label>
                                    <textarea
                                        value={newPost.content}
                                        onChange={e => setNewPost({ ...newPost, content: e.target.value })}
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none min-h-[150px]"
                                        placeholder={lang === 'id' ? "Apa yang terjadi di komunitas?" : "What's happening?"}
                                    />
                                </div>

                                <button
                                    onClick={handleCreatePost}
                                    disabled={isSubmitting}
                                    className={`w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-blue-500/20 transition flex items-center justify-center gap-2 mt-4 ${isSubmitting ? 'bg-slate-300' : 'bg-blue-600 hover:bg-blue-700 hover:scale-[1.02]'}`}
                                >
                                    {isSubmitting ? 'Publishing...' : (lang === 'id' ? 'Terbitkan Postingan' : 'Publish Post')}
                                </button>
                            </div>

                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

window.CommunityFeed = CommunityFeed;
