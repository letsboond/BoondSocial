// src/components/BuyView.js

const BuyView = ({ t, user, lang }) => {
    const { motion, AnimatePresence } = window.Motion;
    const { useState, useEffect } = React;

    const [nfcUrl, setNfcUrl] = useState('');
    const [nfcStatus, setNfcStatus] = useState('idle'); // idle, scanning, success, error
    const [nfcMessage, setNfcMessage] = useState('');
    const [isNfcSupported, setIsNfcSupported] = useState(false);
    const [selectedImage, setSelectedImage] = useState(null);

    useEffect(() => {
        if (window.lucide) {
            window.lucide.createIcons();
        }
        // Check Web NFC Support
        if ('NDEFReader' in window) {
            setIsNfcSupported(true);
        }
    }, []);

    // Helper: Get Icon (Simplified version for this view)
    const getIcon = (name, className) => {
        if (name === 'Link') return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>;
        return null;
    };

    const products = [
        { id: 1, name: "Keychain Boond Series", image: "/gear-1.jpg" },
        { id: 2, name: "Keychain Custom Made", image: "/gear-2.jpg" },
    ];

    return (
        <div className="w-full min-h-screen p-6 pb-24">
            <header className="mb-6 md:mb-8 text-center pt-24 md:pt-24 relative z-10">
                <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-2 tracking-tight">My Gear & Shop</h1>
                <p className="text-slate-600 font-medium text-sm md:text-base">{t('shop_subtitle')}</p>
            </header>

            {/* --- NFC WRITER TOOL (Android Only) --- */}
            {isNfcSupported && (
                <div className="max-w-md mx-auto mb-12 relative z-20">
                    <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700 relative overflow-hidden group">
                        {/* Background Effects */}
                        <div className="absolute top-[-50%] right-[-50%] w-64 h-64 bg-emerald-500/20 rounded-full blur-3xl group-hover:bg-emerald-500/30 transition duration-1000"></div>

                        {/* Overlay: Status Messages */}
                        <AnimatePresence>
                            {nfcStatus !== 'idle' && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-xl flex flex-col items-center justify-center text-center p-6"
                                >
                                    {nfcStatus === 'scanning' && (
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 mb-4 rounded-full border-4 border-emerald-500/30 border-t-emerald-500 animate-spin"></div>
                                            <h4 className="text-xl font-bold text-white mb-2">{lang === 'id' ? 'Siap Menulis...' : 'Ready to Write...'}</h4>
                                            <p className="text-sm text-slate-300 max-w-[200px] leading-relaxed mb-6">
                                                {lang === 'id' ? 'Tempelkan kartu NFC ke belakang HP Anda sekarang.' : 'Tap NFC tag to the back of your phone now.'}
                                            </p>
                                            <button
                                                onClick={() => setNfcStatus('idle')}
                                                className="px-6 py-2 bg-white text-slate-900 rounded-full text-sm font-bold hover:bg-slate-200 transition shadow-lg"
                                            >
                                                {lang === 'id' ? 'Batal' : 'Cancel'}
                                            </button>
                                        </div>
                                    )}

                                    {nfcStatus === 'success' && (
                                        <div className="flex flex-col items-center">
                                            <div className="w-20 h-20 mb-6 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/50">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                            </div>
                                            <h4 className="text-xl font-bold text-white mb-2">{lang === 'id' ? 'Berhasil!' : 'Success!'}</h4>
                                            <p className="text-sm text-slate-400 mb-6">
                                                {lang === 'id' ? 'Link profil baru telah disimpan ke chip.' : 'New profile link written to chip.'}
                                            </p>
                                            <button
                                                onClick={() => setNfcStatus('idle')}
                                                className="px-6 py-2 bg-white text-slate-900 rounded-full text-sm font-bold hover:bg-slate-200 transition shadow-lg"
                                            >
                                                {lang === 'id' ? 'Tutup' : 'Close'}
                                            </button>
                                        </div>
                                    )}

                                    {nfcStatus === 'error' && (
                                        <div className="flex flex-col items-center">
                                            <div className="w-16 h-16 mb-4 bg-red-500/20 rounded-full flex items-center justify-center border-2 border-red-500">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                            </div>
                                            <h4 className="text-xl font-bold text-white mb-2">{lang === 'id' ? 'Gagal' : 'Failed'}</h4>
                                            <p className="text-xs text-red-200 mb-6 max-w-[250px] font-mono bg-red-900/30 p-2 rounded">
                                                {nfcMessage}
                                            </p>
                                            <button
                                                onClick={() => setNfcStatus('idle')}
                                                className="px-6 py-2 bg-white text-slate-900 rounded-full text-sm font-bold hover:bg-slate-200 transition shadow-lg"
                                            >
                                                {lang === 'id' ? 'Coba Lagi' : 'Try Again'}
                                            </button>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="relative z-10">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-bold text-lg flex items-center gap-2 text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h10" /><path d="M9 5v14" /><path d="m16 16 6-4" /><path d="m16 8 6 4" /></svg>
                                    NFC Writer Tool
                                </h4>
                                <div className="bg-emerald-500/20 px-2 py-1 rounded-md border border-emerald-500/30">
                                    <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></div>
                                        HARDWARE
                                    </span>
                                </div>
                            </div>

                            <p className="text-slate-300 text-xs mb-4 leading-relaxed opacity-90 max-w-[95%]">
                                {lang === 'id'
                                    ? "Tulis link apapun ke chip NFC Anda. Klik tombol hijau & tempelkan gear ke HP."
                                    : "Write any link to your NFC chip. Click the green button & tap gear to phone."}
                            </p>

                            {/* Input */}
                            <div className="bg-white/5 backdrop-blur-md p-1 rounded-xl border border-white/10 mb-4">
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                        {getIcon('Link', 'w-4 h-4')}
                                    </div>
                                    <input
                                        value={nfcUrl}
                                        onChange={e => setNfcUrl(e.target.value)}
                                        className="w-full pl-9 pr-4 py-2.5 rounded-lg bg-transparent text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:bg-black/20 transition"
                                        placeholder="https://"
                                    />
                                </div>
                            </div>

                            {/* Helper: Reset to Profile Link */}
                            {user && (
                                <button
                                    onClick={() => setNfcUrl(`${window.location.origin}/profile/${user.username ? user.username.replace('@', '') : 'me'}`)}
                                    className="text-[10px] text-blue-300 mb-4 hover:underline hover:text-blue-200 flex items-center gap-1"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" /><path d="M8 16H3v5" /></svg>
                                    {lang === 'id' ? 'Gunakan Link Profil Boond Saya' : 'Use My Boond Profile Link'}
                                </button>
                            )}

                            {/* HARDWARE WRITE BUTTON */}
                            <div className="pt-4 border-t border-white/10">
                                <button
                                    onClick={async () => {
                                        let targetUrl = nfcUrl.trim();
                                        if (!/^https?:\/\//i.test(targetUrl)) {
                                            targetUrl = 'https://' + targetUrl;
                                        }

                                        if (!targetUrl) return alert(lang === 'id' ? "Link kosong!" : "Empty link!");

                                        try {
                                            const ndef = new window.NDEFReader();
                                            setNfcStatus('scanning');
                                            await ndef.scan();
                                            await ndef.write({
                                                records: [{ recordType: "url", data: targetUrl }]
                                            });
                                            setNfcStatus('success');
                                        } catch (error) {
                                            console.error("NFC Write Error:", error);
                                            setNfcMessage(error.message || "Unknown error");
                                            setNfcStatus('error');
                                        }
                                    }}
                                    className="w-full py-4 bg-emerald-500 text-white rounded-xl text-sm font-black uppercase tracking-widest shadow-xl shadow-emerald-500/20 hover:bg-emerald-400 hover:scale-[1.02] flex items-center justify-center gap-3 transition-all transform"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12h10" /><path d="M9 5v14" /><path d="m16 16 6-4" /><path d="m16 8 6 4" /></svg>
                                    {lang === 'id' ? 'Tulis Chip Sekarang' : 'Write to Chip Now'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-md md:max-w-4xl mx-auto relative z-10">
                {products.map((item, idx) => (
                    <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        transition={{ delay: idx * 0.1 }}
                        className="bg-white/60 backdrop-blur-xl rounded-3xl overflow-hidden shadow-xl shadow-blue-900/5 border border-white/50 group"
                    >
                        <div className="h-56 md:h-72 relative overflow-hidden cursor-pointer" onClick={() => setSelectedImage(item.image)}>
                            <img src={item.image} className="w-full h-full object-cover transition duration-700 group-hover:scale-105" alt={item.name} />
                        </div>
                        <div className="p-5 md:p-6 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
                            <h3 className="font-bold text-lg md:text-xl text-slate-900 text-center sm:text-left">{item.name}</h3>
                            <button className="w-full sm:w-auto bg-slate-900 text-white px-6 py-2.5 rounded-xl font-bold hover:bg-slate-800 transition shadow-lg shadow-slate-900/20 active:scale-95 flex items-center justify-center gap-2 text-sm">
                                {t('shop_btn_buy')} <i data-lucide="arrow-right" className="w-4 h-4"></i>
                            </button>
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-12 p-8 bg-slate-900/90 backdrop-blur-xl rounded-3xl shadow-2xl text-center relative overflow-hidden max-w-md mx-auto group cursor-pointer border border-white/10 mb-20">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 to-transparent opacity-0 group-hover:opacity-100 transition duration-500"></div>
                <div className="relative z-10">
                    <h3 className="text-2xl font-bold text-white mb-2">{t('shop_corp_title')}</h3>
                    <p className="text-slate-300 text-sm mb-6 leading-relaxed">{t('shop_corp_desc')}</p>
                    <button className="text-white bg-white/10 backdrop-blur-md px-6 py-2 rounded-full font-semibold hover:bg-white hover:text-slate-900 transition border border-white/10">{t('shop_btn_contact')} &rarr;</button>
                </div>
            </div>

            {/* Full Screen Image Viewer Modal */}
            {window.ImageViewerModal && (
                <window.ImageViewerModal 
                    src={selectedImage} 
                    onClose={() => setSelectedImage(null)} 
                />
            )}
        </div>
    );
};

window.BuyView = BuyView;
