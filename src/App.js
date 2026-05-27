// src/App.js

// --- Layout Component (Moved Outside to prevent re-creation) ---
const Layout = ({ children, t, lang, setLang }) => {
    const location = window.ReactRouterDOM.useLocation();
    const history = window.ReactRouterDOM.useHistory();
    const { motion, AnimatePresence } = window.Motion;
    const { BottomNav } = window;

    // Determine active tab
    const isLogin = location.pathname === '/';

    return (
        <div className="bg-white min-h-screen text-slate-900 relative font-sans">
            {/* FIXED Background Layer (Stays put while scrolling) */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                {/* Background Blobs */}
                <div className="absolute top-[-20%] left-[-20%] w-[900px] h-[900px] bg-blue-600/5 md:bg-blue-600/30 rounded-full blur-[120px] mix-blend-multiply"></div>
                <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-500/5 md:bg-blue-500/30 rounded-full blur-[100px] mix-blend-multiply"></div>
                <div className="absolute top-[30%] right-[-30%] w-[600px] h-[600px] bg-cyan-400/10 md:bg-cyan-400/30 rounded-full blur-[140px] rotate-45 transform mix-blend-multiply"></div>
                <div className="absolute bottom-[20%] left-[-20%] w-[500px] h-[600px] bg-sky-400/5 md:bg-blue-500/25 rounded-full blur-[110px] -rotate-12 transform mix-blend-multiply"></div>
            </div>

            {/* Main Content Area (Scrollable) */}
            <main className={`w-full ${isLogin ? 'min-h-screen pb-0' : 'min-h-screen pb-24'} relative z-10`}>
                <AnimatePresence mode="wait">
                    <motion.div
                        key={location.pathname}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="w-full h-full"
                    >
                        {children}
                    </motion.div>
                </AnimatePresence>
            </main>

            {/* Floating Logo */}
            {!isLogin && (
                <div
                    onClick={() => {
                        if (window.currentUser && window.currentUser.username) {
                            history.push(`/profile/${window.currentUser.username.replace('@', '')}`);
                        } else {
                            history.push('/profile/me');
                        }
                    }}
                    className="fixed z-50 transition-all duration-500 rounded-full overflow-hidden shadow-2xl border border-slate-200 cursor-pointer hover:scale-105 active:scale-95 top-6 left-6 md:top-10 md:left-10 w-16 h-16"
                >
                    <div className="w-full h-full bg-white/80 backdrop-blur-md">
                        <img src="/logo.png" className="w-full h-full object-cover" alt="Boond Logo" />
                    </div>
                </div>
            )}

            {/* Global Language Toggle (Except Login) */}
            {!isLogin && (
                <button
                    onClick={() => setLang(lang === 'id' ? 'en' : 'id')}
                    className="fixed top-9 right-6 md:top-10 md:right-10 z-50 bg-white/50 backdrop-blur-md border border-slate-200 px-5 py-2.5 rounded-xl text-base font-bold text-slate-700 hover:bg-white hover:shadow-lg transition-all flex items-center gap-2.5"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                    {lang === 'id' ? 'ID' : 'EN'}
                </button>
            )}

            {/* Bottom Navigation */}
            <BottomNav t={t} />
        </div>
    );
};

// --- Profile Route (Moved Component) ---
const ProfileRoute = ({ user, userProfile, t, lang, setLang }) => {
    const { useParams, useHistory } = window.ReactRouterDOM;
    const { useState, useEffect } = React;
    const { auth, LoginView, ProfileView } = window;

    const { username } = useParams();
    const history = useHistory();
    const [viewProfile, setViewProfile] = useState(null);
    const [isLoadingProfile, setIsLoadingProfile] = useState(true);
    const [isOwner, setIsOwner] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            setIsLoadingProfile(true);

            // Case 1: /profile (No username) -> Redirect to Me or Login
            if (!username) {
                if (user) {
                    // User logged in, redirect to their username
                    const mySlug = user.username ? user.username.replace('@', '') : 'me';
                    history.replace(`/profile/${mySlug}`);
                } else {
                    // Not logged in, go to Login
                    history.replace('/');
                }
                setIsLoadingProfile(false);
                return;
            }

            // Case 2: /profile/me
            if (username === 'me') {
                if (user) {
                    setViewProfile(userProfile);
                    setIsOwner(true);
                    setIsLoadingProfile(false);
                } else {
                    // Not logged in accessing /me -> Login
                    history.replace('/');
                }
                return;
            }

            // Case 3: /profile/@username or /profile/username
            const targetUsername = username.startsWith('@') ? username : '@' + username;

            // Check if it's the current user
            if (user && user.username === targetUsername) {
                setViewProfile(userProfile);
                setIsOwner(true);
                setIsLoadingProfile(false);
                return;
            }

            // It's someone else (or we are guest) -> Fetch from Firestore
            try {
                console.log("Fetching public profile for:", targetUsername);
                const querySnapshot = await window.db.collection('users')
                    .where('username', '==', targetUsername)
                    .limit(1)
                    .get();

                if (!querySnapshot.empty) {
                    const doc = querySnapshot.docs[0];
                    setViewProfile(doc.data());
                    setIsOwner(false);
                } else {
                    console.log("User not found");
                    setViewProfile(null); // User not found
                }
            } catch (err) {
                console.error("Error fetching profile:", err);
                setViewProfile(null);
            } finally {
                setIsLoadingProfile(false);
            }
        };

        fetchProfile();
    }, [username, user?.uid]); // FIX: Only re-run if route changes or user logs in/out.

    // SYNC EFFECT: Keep viewProfile in sync with userProfile PROP if we are viewing ourselves
    // This allows edits to reflect immediately without needing the main fetch to re-run
    // And relies on App.js to only pass new 'userProfile' ref when VISUAL changes happen.
    useEffect(() => {
        if (isOwner && userProfile) {
            setViewProfile(userProfile);
        }
    }, [userProfile, isOwner]);

    // If no username param was present, we handled redirect above
    if (!username) return null;

    if (isLoadingProfile) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-slate-400">
                <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p>Loading Profile...</p>
            </div>
        );
    }

    // If loading finished but no profile found (and not directed to login)
    if (!viewProfile) {
        // If trying to access 'me' but not logged in -> Redirect handled in fetchProfile

        // Real 404
        return (
            <div className="flex flex-col items-center justify-center min-h-screen text-center p-6 bg-slate-50">
                <div className="text-6xl mb-4">🤷‍♂️</div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">User Not Found</h2>
                <p className="text-slate-500 mb-6">The user {username} does not exist or has claimed a new handle.</p>
                <button onClick={() => history.push('/')} className="bg-blue-600 text-white px-6 py-2 rounded-full font-bold">Back Home</button>
            </div>
        );
    }

    // Render Profile
    return (
        <ProfileView
            profile={viewProfile}
            isEmbedded={true}
            isOwner={isOwner} // Pass ownership status
            onNavigate={(path, state) => history.push(path === 'maps' ? { pathname: '/', state } : path)}
            onLogout={isOwner ? () => auth.signOut() : null} // Only allow logout if owner
            t={t}
            lang={lang}
            setLang={setLang}
        />
    );
};

// --- Root Route (Handles / ) ---
const RootRoute = ({ user, t, lang, setLang }) => {
    const { useHistory } = window.ReactRouterDOM;
    const { useEffect } = React;
    const history = useHistory();

    useEffect(() => {
        if (user) {
            const mySlug = user.username ? user.username.replace('@', '') : 'me';
            history.replace(`/profile/${mySlug}`);
        }
    }, [user, history]);

    if (user) return null;

    return <window.LoginView t={t} lang={lang} setLang={setLang} />;
};

const App = () => {
    // Safety check for critical dependencies
    if (!window.Motion || !window.React || !window.ReactDOM || !window.ReactRouterDOM) {
        const missing = [];
        if (!window.Motion) missing.push("Motion");
        if (!window.React) missing.push("React");
        if (!window.ReactDOM) missing.push("ReactDOM");
        if (!window.ReactRouterDOM) missing.push("ReactRouterDOM");
        return <div className="p-10 text-center text-red-500 font-sans">Error: Critical libraries failed to load: {missing.join(", ")}. Please refresh.</div>;
    }

    const { useState, useEffect } = React;
    // v5 Imports
    const { BrowserRouter, Switch, Route, Redirect, useParams, useHistory, useLocation, Link } = window.ReactRouterDOM;
    const { auth } = window;
    const { MapsView, CommunityView, ProfileView, BuyView, LoginView, HistoryView, MOCK_PROFILE } = window; // BottomNav used in Layout


    const [lang, setLang] = useState('id'); // 'id' or 'en'
    const [user, setUser] = useState(null); // Auth state
    const [loadingAuth, setLoadingAuth] = useState(true);

    // Auth & Data Listener (Real-time)
    useEffect(() => {
        if (!auth) {
            setLoadingAuth(false);
            return;
        }

        let unsubscribeFirestore = null;

        const unsubscribeAuth = auth.onAuthStateChanged((u) => {
            if (unsubscribeFirestore) {
                unsubscribeFirestore();
                unsubscribeFirestore = null;
            }

            if (u) {
                const userRef = window.db.collection('users').doc(u.uid);

                unsubscribeFirestore = userRef.onSnapshot((doc) => {
                    if (doc.exists) {
                        const newData = doc.data();

                        // Performance Optimization: 
                        // Only update React State (re-render) if core profile data changes.
                        // STRICTLY IGNORE 'location' and 'lastSeen' which update frequently.
                        setUser((prevUser) => {
                            // FIX: Explicitly include UID as spreading Firebase User object often misses it
                            const safeUser = { ...newData, uid: u.uid, email: u.email, photoURL: u.photoURL || newData.avatar };

                            if (!prevUser) return safeUser;

                            // Define what counts as a "Visual Change" that requires a re-render
                            const hasVisualChange =
                                prevUser.displayName !== newData.displayName ||
                                prevUser.bio !== newData.bio ||
                                prevUser.username !== newData.username ||
                                prevUser.avatar !== newData.avatar ||
                                prevUser.role !== newData.role ||
                                JSON.stringify(prevUser.links) !== JSON.stringify(newData.links) ||
                                prevUser.isVisible !== newData.isVisible ||
                                prevUser.isCommunity !== newData.isCommunity; // Added check for community status

                            // Always update the global reference for imperactive logic (like Maps)
                            window.currentUser = safeUser;

                            if (hasVisualChange) {
                                console.log("App.js: Visual Profile Updated (Re-render triggered)");
                                return safeUser;
                            } else {
                                // Important: Return the EXACT previous object reference.
                                // React UseState will detect this and skip the re-render cycle entirely.
                                // console.log("App.js: Silent BG Update (No re-render)");
                                return prevUser;
                            }
                        });
                    } else {
                        // Resurrect Prevention & Account Creation logic...
                        if (window.isDeletingAccount) {
                            console.log("Skipping auto-creation: Account deletion in progress.");
                            return;
                        }

                        const newProfile = {
                            uid: u.uid,
                            displayName: u.displayName || "User",
                            email: u.email,
                            photoURL: u.photoURL,
                            bio: "Halo! Saya pengguna baru Boond.",
                            username: "@" + (u.email ? u.email.split('@')[0] : 'user'),
                            role: "User",
                            accessMode: "public",
                            isVisible: false,
                            links: [
                                { id: 1, title: "WhatsApp", url: "", icon: "MessageCircle", color: "bg-green-500" },
                                { id: 2, title: "Instagram", url: "", icon: "Instagram", color: "bg-pink-500" }
                            ],
                            joinedAt: new Date()
                        };
                        userRef.set(newProfile).catch(console.error);
                    }
                    setLoadingAuth(false);
                }, (error) => {
                    console.error("Firestore Listen Error:", error);
                    setLoadingAuth(false);
                });

            } else {
                setUser(null);
                window.currentUser = null;
                setLoadingAuth(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubscribeFirestore) unsubscribeFirestore();
        };
    }, []);

    // --- Geolocation Logic (Phase 8) ---
    const lastUpdateRef = React.useRef(0); // Track last sync time
    const userRef = React.useRef(user); // Ref to hold latest user state for intervals

    // Keep ref synced
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    useEffect(() => {
        if (!user || !user.uid) return;

        let watchId = null;

        // 1. If Visible: Start Tracking
        const shouldTrack = user.isVisible && !user.isStaticLocation;

        if (shouldTrack) {
            console.log("Starting GPS Tracking for:", user.username);

            if (!navigator.geolocation) {
                console.error("Geolocation is not supported by this browser.");
                return;
            }

            // Reliable Heartbeat: 30 Seconds Background Update
            // We use setInterval + getCurrentPosition instead of watchPosition 
            // because watchPosition can "sleep" on some browsers/devices if motionless.

            // Initial call (immediate)
            const updateLocation = () => {
                // DOUBLE CHECK inside callback using REF to prevent stale closure writes
                const currentUserState = userRef.current;

                if (!currentUserState || !currentUserState.isVisible || currentUserState.isStaticLocation) {
                    console.log("Skipping GPS Write: User is invalid, invisible, or Static Mode is ON.", {
                        static: currentUserState?.isStaticLocation,
                        visible: currentUserState?.isVisible
                    });
                    return;
                }

                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        // Re-check after async delay too, just to be super safe
                        if (userRef.current?.isStaticLocation) return;

                        const { latitude, longitude } = position.coords;

                        try {
                            // ULTIMATE SAFEGUARD: Check DB directly before writing
                            // This prevents any local state staleness from causing overwrites
                            const docRef = window.db.collection('users').doc(user.uid);
                            const snap = await docRef.get();
                            if (snap.exists && snap.data().isStaticLocation) {
                                console.log("Blocked GPS Write: Server-side Static Location is ON.");
                                return;
                            }

                            console.log("GPS Heartbeat (30s):", latitude, longitude);
                            await docRef.update({
                                location: new window.firebase.firestore.GeoPoint(latitude, longitude),
                                lastSeen: new Date()
                            });
                        } catch (err) {
                            console.error("BG GPS Error:", err);
                        }
                    },
                    (err) => console.error("GPS Error:", err),
                    { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
                );
            };

            updateLocation(); // Run immediately on mount
            watchId = setInterval(updateLocation, 20000); // Repeat every 20s
        }
        // 2. If Invisible or Static, we don't start the interval.
        // Note: We don't auto-clear location if Static. We only clear if invisible AND not static? 
        // Logic: Invisible = Delete Location. Static = User Managed.
        else if (!user.isVisible && user.location) {
            console.log("Clearing location data for invisible user...");
            window.db.collection('users').doc(user.uid).update({
                location: window.firebase.firestore.FieldValue.delete()
            }).catch(console.error);
        }

        return () => {
            if (watchId) clearInterval(watchId);
        };
    }, [user?.isVisible, user?.uid, user?.isStaticLocation]); // Re-run triggers

    // Fallback info
    const DEFAULT_PROFILE = window.MOCK_PROFILE || {
        name: "Guest User",
        username: "@guest",
        bio: "Welcome to Boond!",
        avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest",
        links: []
    };

    const userProfile = user ? {
        name: user.displayName || "Boond User",
        username: user.username || "@user",
        bio: user.bio || "No bio yet.",
        avatar: user.photoURL || DEFAULT_PROFILE.avatar,
        email: user.email,
        links: user.links || DEFAULT_PROFILE.links,
        isVisible: user.isVisible // Sync Privacy Status
    } : DEFAULT_PROFILE;

    const TRANSLATIONS = {
        id: {
            nav_shop: 'Gear',
            nav_community: 'Komunitas',
            nav_explore: 'Jelajah',
            nav_history: 'Koneksi',
            nav_profile: 'Profil',
            shop_title: 'Boond Shop',
            history_title: 'Koneksi',
            history_subtitle: 'Jejak digital pertemuanmu.',
            history_view_all: 'Lihat Semua',
            shop_subtitle: 'Upgrade gaya networking kamu.',
            shop_corp_title: 'Pesanan Korporat?',
            shop_corp_desc: 'Dapatkan Boond dengan logo komunitas atau perusahaan kamu.',
            shop_btn_contact: 'Hubungi Sales',
            shop_btn_buy: 'Beli',
            comm_title: 'Pusat Komunitas',
            comm_subtitle: 'Temukan komunitas di sekitarmu.',
            comm_search_placeholder: 'Cari komunitas...',
            comm_filter_all: 'Semua',
            comm_filter_any_dist: 'Jarak Bebas',
            comm_allow_loc: 'Login & izinkan lokasi',
            comm_active: 'Aktif',
            // Categories
            cat_All: 'Semua',
            cat_Sport: 'Olahraga',
            cat_Music: 'Musik',
            cat_Technology: 'Teknologi',
            cat_Business: 'Bisnis',
            cat_Social: 'Sosial',
            cat_Education: 'Pendidikan',
            cat_Art: 'Seni',
            cat_Gaming: 'Game',
            cat_Lifestyle: 'Gaya Hidup',
            cat_Other: 'Lainnya',
            profile_comm_settings: 'Pengaturan Komunitas',

            profile_save: 'Simpan Kontak',
            profile_footer: 'Perangkat Boond Asli',
            maps_live: 'Status Langsung',
            maps_active: 'Perangkat Aktif',
            maps_explore: 'Mulai Jelajah',
            map_unavailable: 'Peta tidak tersedia saat ini.',
            maps_live_label: 'Langsung',
            comm_members: 'Anggota',
            shop_tag_best: 'Paling Laris',
            shop_tag_new: 'Baru',
            shop_tag_popular: 'Populer',
            profile_logout: 'Keluar',
            login_title: 'Selamat Datang di Boond',
            login_tagline: 'Kunci Untuk Mengikat & Terikat',
            login_subtitle: 'Konek Lokal, Akrab Instan',
            login_btn_google: 'Masuk dengan Google',
            history_login_title: 'Harap Login',
            history_login_desc: 'Masuk untuk melihat koneksi tersimpan Anda.',
            history_empty_title: 'Belum Ada Koneksi',
            history_empty_desc: 'Jelajahi peta dan simpan kontak orang yang Anda temui!',
            profile_share: 'Bagikan'
        },
        en: {
            nav_shop: 'Gear',
            nav_community: 'Community',
            nav_explore: 'Explore',
            nav_history: 'Connections',
            nav_profile: 'Profile',
            shop_title: 'Boond Shop',
            history_title: 'Connections',
            history_subtitle: 'Your digital handshake trail.',
            history_view_all: 'View All',
            shop_subtitle: 'Upgrade your networking style.',
            shop_corp_title: 'Corporate Orders?',
            shop_corp_desc: 'Get Boond customized with your community or company logo.',
            shop_btn_contact: 'Contact Sales',
            shop_btn_buy: 'Buy',
            comm_title: 'Community Hub',
            comm_subtitle: 'Find communities around you.',
            comm_search_placeholder: 'Find communities...',
            comm_filter_all: 'All',
            comm_filter_any_dist: 'Any Distance',
            comm_allow_loc: 'Login & allow location',
            comm_active: 'Active',
            // Categories
            cat_All: 'All',
            cat_Sport: 'Sport',
            cat_Music: 'Music',
            cat_Technology: 'Technology',
            cat_Business: 'Business',
            cat_Social: 'Social',
            cat_Education: 'Education',
            cat_Art: 'Art',
            cat_Gaming: 'Gaming',
            cat_Lifestyle: 'Lifestyle',
            cat_Other: 'Other',
            profile_comm_settings: 'Community Settings',

            profile_save: 'Save Contact',
            profile_footer: 'Proprietary Boond Device',
            maps_live: 'Live Status',
            maps_active: 'Active Devices',
            maps_explore: 'Start Exploring',
            map_unavailable: 'Map currently unavailable.',
            maps_live_label: 'Live Status',
            comm_members: 'Members',
            shop_tag_best: 'Best Seller',
            shop_tag_new: 'New',
            shop_tag_popular: 'Popular',
            profile_logout: 'Logout',
            login_title: 'Welcome to Boond',
            login_tagline: 'A Key To Bond & Bound',
            login_subtitle: 'Connect Locally, Bond Instantly',
            login_btn_google: 'Sign In with Google',
            history_login_title: 'Please Login',
            history_login_desc: 'Log in to view your saved connections.',
            history_empty_title: 'No Connections Yet',
            history_empty_desc: 'Explore the map and save people you meet!',
            profile_share: 'Share'
        }
    };

    const t = (key) => TRANSLATIONS[lang][key] || key;

    // --- Route Components (v5) ---



    return (
        <BrowserRouter>
            <Layout t={t} lang={lang} setLang={setLang}>
                <Switch>
                    <Route exact path="/">
                        <RootRoute user={user} t={t} lang={lang} setLang={setLang} />
                    </Route>
                    <Route path="/explore">
                        <Redirect to="/profile" />
                    </Route>
                    <Route path="/community">
                        <CommunityView t={t} lang={lang} />
                    </Route>
                    <Route path="/buy">
                        <BuyView t={t} user={user} lang={lang} />
                    </Route>
                    <Route path="/connections">
                        <HistoryView t={t} lang={lang} />
                    </Route>

                    <Route exact path="/profile">
                        <ProfileRoute user={user} userProfile={user} t={t} lang={lang} setLang={setLang} />
                    </Route>
                    <Route path="/profile/:username">
                        <ProfileRoute user={user} userProfile={user} t={t} lang={lang} setLang={setLang} />
                    </Route>

                    <Route path="*">
                        <Redirect to="/" />
                    </Route>
                </Switch>
            </Layout>
        </BrowserRouter>
    );
};

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
