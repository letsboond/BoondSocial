// src/components/BottomNav.js

const BottomNav = ({ t }) => {
    const { motion } = window.Motion;
    const { useEffect } = React;
    const { Link, useLocation } = window.ReactRouterDOM;

    const location = useLocation();
    const currentPath = location.pathname;

    useEffect(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }, [currentPath]);

    const finalItems = [
        { id: '/buy', path: '/buy', icon: 'shopping-bag', label: t('nav_shop') },
        // { id: '/community', path: '/community', icon: 'users', label: t('nav_community') },
        // { id: '/maps', path: '/', icon: 'map', label: t('nav_explore') },
        { id: '/connections', path: '/connections', icon: 'contact-2', label: t('nav_history') },
        { id: '/profile', path: '/profile', icon: 'user', label: t('nav_profile') },
    ];

    // Helper to check active state
    const isActive = (path) => {
        if (path === '/') return currentPath === '/' || currentPath === '/explore';
        if (path === '/profile') return currentPath.startsWith('/profile');
        return currentPath.startsWith(path);
    };

    return (
        <nav className="fixed bottom-0 left-0 w-full bg-white/90 backdrop-blur-xl border-t border-slate-200 z-[101] pb-safe shadow-[0_-5px_20px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-center h-16 md:h-20 max-w-lg mx-auto relative px-6">

                {finalItems.map((item) => {
                    const active = isActive(item.path);
                    const isProfile = item.id === '/profile';

                    // Dynamic Profile Link Logic
                    let linkTo = item.path;
                    if (isProfile && window.currentUser && window.currentUser.username) {
                        linkTo = `/profile/${window.currentUser.username.replace('@', '')}`;
                    } else if (isProfile) {
                        linkTo = '/profile/me'; // Fallback
                    }

                    return (
                        <Link
                            key={item.id}
                            to={linkTo}
                            className={`relative flex flex-col items-center justify-center h-full transition-all duration-300 w-16 ${active ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
                        >
                            {/* Active Indicator Glow */}
                            {active && (
                                <motion.div
                                    layoutId="bottomNavGlow"
                                    className="absolute -top-[1px] w-12 h-[3px] bg-blue-600 rounded-full shadow-[0_2px_10px_rgba(37,99,235,0.3)]"
                                />
                            )}

                            <div className={`p-1.5 md:p-2 rounded-xl transition-all ${active ? 'bg-blue-50 translate-y-[-2px]' : ''}`}>
                                <i data-lucide={item.icon} className={`w-4 h-4 md:w-6 md:h-6 ${active ? 'fill-blue-600/20' : ''}`}></i>
                            </div>

                            <span className="text-[10px] font-bold mt-1 tracking-wide">{item.label}</span>
                        </Link>
                    )
                })}
            </div>
        </nav>
    );
};

window.BottomNav = BottomNav;
