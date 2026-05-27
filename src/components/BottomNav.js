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
        <nav className="fixed bottom-0 left-0 w-full z-[101] pb-safe pointer-events-none">
            <div className="flex justify-center items-end pb-4 w-full">
                {/* Outer wrapper: relative so active bar can be positioned relative to each button */}
                <div className="pointer-events-auto flex items-stretch relative rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
                    {finalItems.map((item, index) => {
                        const active = isActive(item.path);
                        const isProfile = item.id === '/profile';

                        let linkTo = item.path;
                        if (isProfile && window.currentUser && window.currentUser.username) {
                            linkTo = `/profile/${window.currentUser.username.replace('@', '')}`;
                        } else if (isProfile) {
                            linkTo = '/';
                        }

                        const isFirst = index === 0;
                        const isLast = index === finalItems.length - 1;

                        return (
                            <Link
                                key={item.id}
                                to={linkTo}
                                className={`relative flex flex-col items-center justify-center transition-all duration-300 px-7 py-3
                                    bg-white/80 backdrop-blur-xl border-t border-b border-slate-200/80
                                    ${isFirst ? 'border-l rounded-l-2xl' : ''}
                                    ${isLast ? 'border-r rounded-r-2xl' : 'border-r border-slate-200/60'}
                                    ${active ? 'text-blue-600 bg-blue-50/80' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50/80'}`}
                            >
                                {/* Active Indicator — centered using inset-x-0 + mx-auto */}
                                {active && (
                                    <motion.div
                                        layoutId="bottomNavGlow"
                                        className="absolute top-0 inset-x-0 mx-auto w-10 h-[3px] bg-blue-600 rounded-b-full shadow-[0_2px_8px_rgba(37,99,235,0.5)]"
                                    />
                                )}

                                <div className={`p-1 rounded-xl transition-all ${active ? 'translate-y-[-1px]' : ''}`}>
                                    <i data-lucide={item.icon} className={`w-5 h-5 ${active ? 'fill-blue-600/20' : ''}`}></i>
                                </div>

                                <span className="text-[10px] font-bold mt-0.5 tracking-wide">{item.label}</span>
                            </Link>
                        );
                    })}
                </div>
            </div>
        </nav>
    );
};

window.BottomNav = BottomNav;
