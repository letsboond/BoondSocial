// src/components/MapsView.js

const MapsView = ({ t }) => {
    const { motion } = window.Motion;
    const { useEffect, useRef } = React;
    const history = window.ReactRouterDOM.useHistory();


    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const location = window.ReactRouterDOM.useLocation();
    const focusHandled = useRef(false);

    // Filter State
    const [filterType, setFilterType] = React.useState('all'); // all, community, personal
    const filterRef = useRef('all');

    useEffect(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, []);

    // Re-Filter Markers Effect
    useEffect(() => {
        filterRef.current = filterType; // Sync Ref
        if (!window.markers || !mapInstance.current) return;

        Object.values(window.markers).forEach(marker => {
            let shouldShow = true;
            if (filterType === 'community' && !marker.isCommunity) shouldShow = false;
            if (filterType === 'personal' && marker.isCommunity) shouldShow = false;

            marker.setMap(shouldShow ? mapInstance.current : null);
        });
    }, [filterType]);

    useEffect(() => {
        if (!mapRef.current || !window.google) return;

        // Init Map
        const map = new window.google.maps.Map(mapRef.current, {
            center: { lat: -6.9744, lng: 107.6303 }, // Bandung Techno Park
            zoom: 17,
            disableDefaultUI: true, // Clean look
            gestureHandling: 'greedy', // Enable 1-finger pan
            styles: [
                { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
                { featureType: "transit", elementType: "labels", stylers: [{ visibility: "off" }] }
            ]
        });

        mapInstance.current = map;

        // Auto-Focus & Default Location Logic
        const { state } = location;

        // Check for specific focus intent passed from Profile View
        if (state && state.focusUid && state.initialPos) {
            console.log("Auto-panning to focused user (Init):", state.focusUid);
            map.panTo(state.initialPos);
            map.setZoom(18);
            focusHandled.current = true;

            // CLEANUP TRIGGER:
            // We clear the state after a delay. 
            // Why? To satisfy the requirement: "Don't center on friend after refresh".
            // By clearing it now, if the user hits F5 later, the state is empty -> Defaults to Self.
            // usage of setTimeout prevents race conditions where state is cleared before Map reads it (if logic changes)
            // and ensures the current 'session' of viewing the friend is valid until reload.
            setTimeout(() => {
                history.replace({ pathname: location.pathname, state: {} });
            }, 2000);

        } else {
            // DEFAULT: Auto-Locate Current User immediately
            console.log("Defaulting to current user location (No Focus provided)...");
            if (navigator.geolocation) {
                const currentUser = window.auth.currentUser;
                // Try from Window Markers (Fastest)
                if (currentUser && window.markers && window.markers[currentUser.uid] && window.markers[currentUser.uid].position) {
                    map.panTo(window.markers[currentUser.uid].position);
                    map.setZoom(17);
                } else {
                    // Fetch GPS (Fallback)
                    navigator.geolocation.getCurrentPosition(
                        (pos) => {
                            const { latitude, longitude } = pos.coords;
                            map.panTo({ lat: latitude, lng: longitude });
                            map.setZoom(17);
                        },
                        (err) => console.log("Auto-Locate Init Fail (Low Prio):", err),
                        { enableHighAccuracy: true, timeout: 5000 }
                    );
                }
            }
        }

        // Define Custom Overlay Class for "Avatar Pin"
        // We define it safely ensuring google maps is loaded
        class AvatarMarker extends window.google.maps.OverlayView {
            constructor(position, image, title, onClick) {
                super();
                this.position = position;
                this.image = image;
                this.title = title;
                this.onClick = onClick;
                this.div = null;
            }

            onAdd() {
                this.div = document.createElement('div');
                this.div.style.position = 'absolute';
                this.div.style.cursor = 'pointer';
                this.div.title = this.title;

                // HTML for the Pin
                this.div.innerHTML = `
                    <div class="relative flex flex-col items-center group transition-transform hover:scale-110 hover:z-50 duration-300" style="transform: translate(-50%, -100%);">
                         <!-- Avatar Circle -->
                         <div class="w-12 h-12 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white z-20 relative">
                            <img src="${this.image}" class="w-full h-full object-cover" alt="${this.title}">
                         </div>
                         <!-- Pin Pointer (Triangle) -->
                         <div class="w-4 h-4 bg-white rotate-45 transform -mt-2 shadow-md z-10 rounded-sm"></div>
                         
                         <!-- Pulse Animation (Optional, mostly for 'me') -->
                         <div class="absolute top-0 w-12 h-12 bg-blue-500 rounded-full animate-ping opacity-20 -z-10"></div>
                    </div>
                `;

                this.div.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent map click
                    if (this.onClick) this.onClick();
                });

                const panes = this.getPanes();
                panes.overlayMouseTarget.appendChild(this.div);
            }

            draw() {
                const projection = this.getProjection();
                if (!projection || !this.position) return;

                const point = projection.fromLatLngToDivPixel(new window.google.maps.LatLng(this.position.lat, this.position.lng));

                if (this.div) {
                    this.div.style.left = point.x + 'px';
                    this.div.style.top = point.y + 'px';
                }
            }

            onRemove() {
                if (this.div) {
                    this.div.parentNode.removeChild(this.div);
                    this.div = null;
                }
            }

            setPosition(newPos) {
                this.position = newPos;
                this.draw();
            }
        }

        // Check if marker matches current filter
        const checkFilter = (isComm) => {
            const currentFilter = filterRef.current;
            if (currentFilter === 'community' && !isComm) return false;
            if (currentFilter === 'personal' && isComm) return false;
            return true;
        };

        // Subscription for Active Users
        const unsubscribe = window.db.collection('users')
            .where('isVisible', '==', true)
            .onSnapshot(snapshot => {
                snapshot.docChanges().forEach(change => {
                    const data = change.doc.data();
                    const uid = change.doc.id;
                    const { location } = data;

                    // Skip if no location data
                    if (!location) return;

                    if (change.type === "added" || change.type === "modified") {
                        const position = { lat: location.latitude, lng: location.longitude };

                        // Check if marker exists
                        if (window.markers[uid]) {
                            // Update position
                            window.markers[uid].setPosition(position);
                        } else {
                            // Create new AvatarMarker
                            const marker = new AvatarMarker(
                                position,
                                data.avatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=Guest",
                                data.displayName || data.username,
                                () => {
                                    // Deep link to profile using history
                                    const username = data.username.replace('@', '');
                                    history.push(`/profile/${username}`);
                                }
                            );

                            // Attach Metadata
                            marker.isCommunity = !!data.isCommunity;

                            // Set Map only if allowed by filter
                            if (checkFilter(marker.isCommunity)) {
                                marker.setMap(map);
                            }
                            window.markers[uid] = marker;
                        }
                    }

                    if (change.type === "removed") {
                        if (window.markers[uid]) {
                            window.markers[uid].setMap(null);
                            delete window.markers[uid];
                        }
                    }
                });
            });

        return () => {
            unsubscribe();
            // Clean up markers
            Object.values(window.markers).forEach(marker => marker.setMap(null));
            window.markers = {};
            // Revert GPS to Low Power Mode
            window.isHighFreqGPS = false;
        };
    }, []);

    // High Frequency GPS Loop (Endless Trigger)
    // This runs ONLY when MapsView is mounted (Map Open).
    // It forces a location update every 2 seconds to ensure "Live" movement.
    useEffect(() => {
        window.isHighFreqGPS = true;

        const loopId = setInterval(() => {
            if (navigator.geolocation && window.auth.currentUser) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        const { latitude, longitude } = position.coords;
                        // console.log("Map Live Loop (2s):", latitude, longitude);
                        try {
                            const docRef = window.db.collection('users').doc(window.auth.currentUser.uid);
                            // Safety Check for Static Location
                            const snap = await docRef.get();
                            if (snap.exists && snap.data().isStaticLocation) {
                                console.log("MapsView: Blocked GPS Write (Static Mode ON)");
                                return;
                            }

                            await docRef.update({
                                location: new window.firebase.firestore.GeoPoint(latitude, longitude),
                                lastSeen: new Date()
                            });
                        } catch (e) {
                            // Silent fail
                        }
                    },
                    (err) => { }, // Silent error
                    { enableHighAccuracy: true, maximumAge: 0 }
                );
            }
        }, 20000); // 20 Seconds Interval (global update rate)

        return () => {
            clearInterval(loopId);
            window.isHighFreqGPS = false;
        }
    }, []);

    // Global marker store to persist across renders (ref pattern preferred but window for stability in no-build)
    if (!window.markers) window.markers = {};

    // Recenter Handler
    const handleRecenter = () => {
        if (!mapInstance.current) return;

        // 1. Performance Optimization: Try Instant Pan to existing marker
        const currentUser = window.auth.currentUser;
        if (currentUser && window.markers && window.markers[currentUser.uid]) {
            const myMarker = window.markers[currentUser.uid];
            // Access position from our custom AvatarMarker property
            if (myMarker.position) {
                console.log("Instant Recenter to Marker");
                mapInstance.current.panTo(myMarker.position);
                mapInstance.current.setZoom(18); // Zoom in on self
                return;
            }
        }

        // 2. Fallback: Request GPS (Slower, but necessary if no marker)
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    const { latitude, longitude } = pos.coords;
                    mapInstance.current.panTo({ lat: latitude, lng: longitude });
                    mapInstance.current.setZoom(17);
                },
                (err) => {
                    console.error("Locate Error:", err);
                    alert("Gagal mendeteksi lokasi. Pastikan GPS aktif.");
                },
                { enableHighAccuracy: true, maximumAge: 5000 } // Allow slightly cached positions
            );
        }
    };

    return (
        <div className="w-full h-[calc(100dvh-4rem-env(safe-area-inset-bottom))] md:h-[calc(100dvh-5rem)] relative bg-slate-100 overflow-hidden">
            {/* The Map Container */}
            <div ref={mapRef} className="w-full h-full absolute inset-0 z-0"></div>

            {/* Filter Pills (Centered Top) */}
            <div className={`absolute top-40 left-1/2 -translate-x-1/2 z-20 flex bg-white/80 backdrop-blur-md rounded-full p-1 shadow-lg border border-white/40 transition-all duration-300`}>
                <button
                    onClick={() => setFilterType('all')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${filterType === 'all' ? 'bg-slate-800 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
                >
                    Semua
                </button>
                <button
                    onClick={() => setFilterType('community')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${filterType === 'community' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
                >
                    <i data-lucide="building-2" className="w-3 h-3"></i>
                    Komunitas
                </button>
                <button
                    onClick={() => setFilterType('personal')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition-all ${filterType === 'personal' ? 'bg-blue-500 text-white shadow-md' : 'text-slate-500 hover:bg-white/50'}`}
                >
                    <i data-lucide="user" className="w-3 h-3"></i>
                    Personal
                </button>
            </div>

            {/* UI Overlay (Live Status) */}
            <div className="absolute top-52 md:top-6 md:left-6 md:translate-x-0 z-10 bg-white/80 backdrop-blur-xl border border-white/20 shadow-sm px-3 py-1.5 rounded-full flex items-center gap-2 w-max pointer-events-none transform scale-90 md:scale-100 origin-center opacity-80 left-1/2 -translate-x-1/2 md:translate-x-0">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/30"></div>
                <span className="text-xs font-bold text-slate-800 tracking-wide">
                    {t('maps_live_label')} • {Object.keys(window.markers || {}).length} {t('comm_active')}
                </span>
            </div>

            {/* Recenter Button */}
            <button
                onClick={handleRecenter}
                className="absolute bottom-6 right-5 md:bottom-10 md:right-10 z-10 bg-white p-3.5 rounded-2xl shadow-xl border border-slate-100 text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-all duration-300 transform active:scale-90 active:rotate-12"
                title="Locate Me"
            >
                <i data-lucide="crosshair" className="w-6 h-6"></i>
            </button>
        </div>
    );
};

window.MapsView = MapsView;
