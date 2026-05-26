// src/components/CommunityView.js

const CommunityView = ({ t, lang }) => {
    const { motion, AnimatePresence } = window.Motion;
    const { useEffect, useState, useMemo, useRef } = window.React;
    const { useHistory } = window.ReactRouterDOM;

    // Hooks
    const history = useHistory();
    const isMounted = useRef(true);

    // State
    const [communities, setCommunities] = useState([]);
    const [connectedCommunityIds, setConnectedCommunityIds] = useState(new Set());
    const [loading, setLoading] = useState(true);

    // Filters State
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [maxDistance, setMaxDistance] = useState("Any");
    const [userLocation, setUserLocation] = useState(null);

    // Categories List
    const CATEGORIES = ["All", "Sport", "Music", "Technology", "Business", "Social", "Education", "Art", "Gaming", "Lifestyle"];

    useEffect(() => {
        isMounted.current = true;
        // Load Icons
        if (window.lucide) window.lucide.createIcons();

        // Fetch All Data
        const fetchData = async () => {
            if (!window.db) return;

            try {
                // 1. Get User Location (if available)
                if (window.auth.currentUser) {
                    const userDoc = await window.db.collection('users').doc(window.auth.currentUser.uid).get();
                    if (isMounted.current && userDoc.exists && userDoc.data().location) {
                        setUserLocation({
                            lat: userDoc.data().location.latitude,
                            lng: userDoc.data().location.longitude
                        });
                    }

                    // Fetch Connections
                    const connectionsSnapshot = await window.db.collection('users').doc(window.auth.currentUser.uid).collection('connections').get();
                    if (isMounted.current) {
                        const connectionsSet = new Set(connectionsSnapshot.docs.map(doc => doc.id));
                        setConnectedCommunityIds(connectionsSet);
                    }
                }

                // 2. Fetch Communities
                const snapshot = await window.db.collection('users').where('isCommunity', '==', true).get();
                const loaded = snapshot.docs.map(doc => {
                    const data = doc.data();

                    // Logic for location: Prioritize Static
                    let finalLocation = data.location;
                    if (data.isStaticLocation && data.staticLocation) {
                        finalLocation = data.staticLocation;
                    }

                    return {
                        id: doc.id,
                        name: data.displayName || data.name || "Community",
                        username: data.username,
                        image: data.avatar || `https://ui-avatars.com/api/?name=${data.displayName || "C"}&background=random`,
                        category: data.communityCategory || "General",
                        description: data.communityDescription || "",
                        location: finalLocation, // Use resolved location
                        isStaticLocation: data.isStaticLocation, // Flag for UI
                        staticAddress: data.staticAddress, // Label
                        members: "100+ members" // Mock
                    };
                });

                // Initial Sort (Connected First)
                // Note: Real-time filtering happen in useMemo below
                if (isMounted.current) {
                    setCommunities(loaded);
                    setLoading(false);
                }
            } catch (err) {
                console.error("Error fetching data:", err);
                if (isMounted.current) setLoading(false);
            }
        };

        fetchData();

        return () => {
            isMounted.current = false;
        };
    }, []);

    // Helper: Haversine Distance
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        if (!lat1 || !lon1 || !lat2 || !lon2) return null;
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Filter Logic
    const filteredCommunities = useMemo(() => {
        let result = communities;

        // 1. Search
        if (searchQuery) {
            const lowerQuery = searchQuery.toLowerCase();
            result = result.filter(c =>
                (c.name && c.name.toLowerCase().includes(lowerQuery)) ||
                (c.username && c.username.toLowerCase().includes(lowerQuery)) ||
                (c.category && c.category.toLowerCase().includes(lowerQuery))
            );
        }

        // 2. Category
        if (selectedCategory !== "All") {
            result = result.filter(c => c.category === selectedCategory);
        }

        // 3. Distance
        if (maxDistance !== "Any" && userLocation) {
            const limit = parseInt(maxDistance);
            result = result.filter(c => {
                if (!c.location) return false;
                // Note: c.location is already resolved to static if enabled
                const dist = calculateDistance(userLocation.lat, userLocation.lng, c.location.latitude, c.location.longitude);
                return dist !== null && dist <= limit;
            });
        }

        // 4. Sort: Connected First, then Alphabetical
        result.sort((a, b) => {
            const isAConnected = connectedCommunityIds.has(a.id);
            const isBConnected = connectedCommunityIds.has(b.id);
            if (isAConnected && !isBConnected) return -1;
            if (!isAConnected && isBConnected) return 1;
            return a.name.localeCompare(b.name);
        });

        return result;
    }, [communities, searchQuery, selectedCategory, maxDistance, userLocation, connectedCommunityIds]);

    // Helper for category colors
    const getCategoryColor = (cat) => {
        const colors = {
            "Sport": "bg-orange-100 text-orange-600",
            "Music": "bg-purple-100 text-purple-600",
            "Technology": "bg-blue-100 text-blue-600",
            "Business": "bg-slate-100 text-slate-600",
            "Social": "bg-pink-100 text-pink-600",
            "Education": "bg-green-100 text-green-600",
            "Art": "bg-rose-100 text-rose-600",
            "Gaming": "bg-indigo-100 text-indigo-600",
            "Lifestyle": "bg-emerald-100 text-emerald-600"
        };
        return colors[cat] || "bg-gray-100 text-gray-600";
    };

    return (
        <div className="w-full min-h-screen p-4 md:p-6 pb-24">
            <header className="mb-6 pt-24 relative z-10 text-center">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">{t('comm_title')}</h1>
                <p className="text-slate-600 font-medium text-sm md:text-base mb-6">{t('comm_subtitle')}</p>

                {/* SEARCH & FILTERS CONTAINER */}
                <div className="max-w-xl mx-auto space-y-4">

                    {/* Search Bar */}
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            type="text"
                            placeholder={t('comm_search_placeholder')}
                            className="block w-full pl-10 pr-3 py-3 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500 transition shadow-sm"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    {/* Filters Row */}
                    <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
                        {/* Category Pills (Scrollable) */}
                        <div className="flex-1 w-full overflow-x-auto no-scrollbar flex gap-2 pb-1">
                            {CATEGORIES.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-bold transition-all ${selectedCategory === cat ? 'bg-slate-800 text-white shadow-md transform scale-105' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}
                                >
                                    {t('cat_' + cat) || cat}
                                </button>
                            ))}
                        </div>

                        {/* Distance Filter */}
                        <div className="flex flex-col items-end transform -translate-y-[1px]">
                            <div className="relative min-w-[120px]">
                                <select
                                    value={maxDistance}
                                    onChange={(e) => setMaxDistance(e.target.value)}
                                    className={`appearance-none w-full bg-slate-100 border border-slate-300 text-slate-700 py-1.5 px-3 pr-8 rounded-full text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm transition hover:bg-slate-200 cursor-pointer ${!userLocation ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    disabled={!userLocation}
                                >
                                    <option value="Any">{t('comm_filter_any_dist')}</option>
                                    <option value="5">&lt; 5 km</option>
                                    <option value="10">&lt; 10 km</option>
                                    <option value="25">&lt; 25 km</option>
                                    <option value="50">&lt; 50 km</option>
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-500">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                            {!userLocation && (
                                <span className="text-[10px] text-slate-400 mt-1 mr-1 italic">
                                    * {t('comm_allow_loc')}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {loading ? (
                // LOADING SKELETON
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-md md:max-w-4xl mx-auto relative z-10">
                    {[1, 2, 3, 4].map(n => (
                        <div key={n} className="flex items-center gap-4 bg-white/40 p-4 rounded-2xl animate-pulse">
                            <div className="w-16 h-16 bg-slate-200 rounded-xl"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-slate-200 rounded w-3/4"></div>
                                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // CONTENT GRID
                <>
                    {filteredCommunities.length === 0 ? (
                        <div className="text-center py-12 text-slate-400">
                            <p className="mb-2 italic">No communities match your filters.</p>
                            <p className="text-xs">Try adjusting your search criteria.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-md md:max-w-4xl mx-auto relative z-10">
                            {filteredCommunities.map((comm, idx) => {
                                const isConnected = connectedCommunityIds.has(comm.id);
                                return (
                                    <motion.button
                                        key={comm.id}
                                        onClick={() => history.push(`/profile/${comm.username.replace('@', '')}`)}
                                        initial={{ opacity: 0, scale: 0.9 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        whileTap={{ scale: 0.98 }}
                                        transition={{ delay: idx * 0.05 }}
                                        className={`w-full text-left flex items-center gap-4 bg-white/60 backdrop-blur-xl p-3.5 md:p-4 rounded-2xl border transition shadow-lg shadow-blue-500/5 group cursor-pointer relative overflow-hidden ${isConnected ? 'border-blue-300 ring-1 ring-blue-100 bg-blue-50/40' : 'border-white/50 hover:bg-white'}`}
                                    >
                                        <img
                                            src={comm.image}
                                            className="w-14 h-14 md:w-16 md:h-16 rounded-xl object-cover shadow-sm group-hover:scale-105 transition duration-500 bg-slate-100"
                                            alt={comm.name}
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <h3 className="font-bold text-base md:text-lg text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                                                    {comm.name}
                                                </h3>
                                                {/* Blue Badge if Connected */}
                                                {isConnected ? (
                                                    <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded-md font-bold uppercase tracking-wide">
                                                        Following
                                                    </span>
                                                ) : (
                                                    <svg className="w-4 h-4 text-blue-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-2 mb-1">
                                                <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${getCategoryColor(comm.category)}`}>
                                                    {t('cat_' + comm.category) || comm.category}
                                                </span>
                                                <span className="text-slate-400 text-xs truncate max-w-[100px]">{comm.username}</span>
                                            </div>

                                            {/* Location / Address Line */}
                                            {comm.isStaticLocation && comm.staticAddress && (
                                                <div className="flex items-center gap-1 text-slate-500 text-[10px] md:text-xs">
                                                    <svg className="w-3 h-3 text-red-500 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" /></svg>
                                                    <span className="truncate max-w-[150px]">{comm.staticAddress}</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-slate-50 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-all border border-slate-100 flex-shrink-0">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
                                        </div>
                                    </motion.button>
                                );
                            })}
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

window.CommunityView = CommunityView;
