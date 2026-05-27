// src/components/LoginView.js

const LoginView = ({ t, lang, setLang }) => {
    const { useState } = React;
    const { auth, googleProvider } = window;
    const { motion } = window.Motion;

    const [error, setError] = useState(null);
    const [isLoading, setIsLoading] = useState(false);



    const handleGoogleLogin = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await auth.signInWithPopup(googleProvider);
        } catch (err) {
            console.error(err);
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="w-full min-h-[100dvh] bg-gradient-to-br from-blue-200 via-white to-blue-200 md:bg-gradient-to-br md:from-blue-100 md:via-white md:to-blue-50 flex flex-col items-center justify-center p-6 pb-28 md:pb-12 relative font-sans overflow-hidden">
            {/* Language Toggle - Absolute Top Left */}
            {/* Language Toggle - Absolute Top Left (Enlarged) */}


            {/* Background Effects (Matching App.js) */}
            {/* Ultra Abstract Background Blobs */}
            {/* Ultra Abstract Background Blobs - Subtle on Mobile, Strong on Desktop */}
            <div className="absolute top-[-20%] left-[-20%] w-[900px] h-[900px] bg-blue-600/5 md:bg-blue-600/30 rounded-full blur-[120px] pointer-events-none md:mix-blend-multiply"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[800px] h-[800px] bg-blue-500/5 md:bg-blue-500/30 rounded-full blur-[100px] pointer-events-none md:mix-blend-multiply"></div>
            <div className="absolute top-[30%] right-[-30%] w-[600px] h-[600px] bg-cyan-400/10 md:bg-cyan-400/30 rounded-full blur-[140px] pointer-events-none rotate-45 transform md:mix-blend-multiply"></div>
            <div className="absolute bottom-[20%] left-[-20%] w-[500px] h-[600px] bg-sky-400/5 md:bg-blue-500/25 rounded-full blur-[110px] pointer-events-none -rotate-12 transform md:mix-blend-multiply"></div>
            <div className="absolute top-[40%] left-[30%] w-[400px] h-[400px] bg-sky-300/5 md:bg-sky-300/20 rounded-full blur-[90px] pointer-events-none md:mix-blend-multiply"></div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="w-full max-w-sm bg-white/60 backdrop-blur-xl border border-white/50 p-8 rounded-3xl shadow-2xl flex flex-col items-center text-center z-10"
            >
                <div className="w-20 h-20 bg-white/80 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 shadow-lg border border-white/20">
                    <img src="/logo.png" className="w-14 h-14 object-contain" alt="Boond" />
                </div>

                <h1 className="text-3xl font-extrabold text-slate-900 mb-3">{t ? t('login_title') : 'Welcome to Boond'}</h1>
                <p className="text-slate-600 text-lg font-medium leading-relaxed">{t ? t('login_tagline') : 'A Key to Bond & Bound'}</p>
                <p className="text-slate-600 text-lg font-medium leading-relaxed mb-8">{t ? t('login_subtitle') : 'Connect locally, bond instantly.'}</p>

                {error && (
                    <div className="mb-4 bg-red-50 text-red-600 border border-red-100 px-4 py-2 rounded-lg text-sm w-full">
                        {error}
                    </div>
                )}

                <button
                    onClick={handleGoogleLogin}
                    disabled={isLoading}
                    className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-800 transition shadow-xl shadow-slate-900/20 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : (
                        <>
                            <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            {t ? t('login_btn_google') : 'Continue with Google'}
                        </>
                    )}
                </button>
            </motion.div>
        </div>
    );
};
window.LoginView = LoginView;
