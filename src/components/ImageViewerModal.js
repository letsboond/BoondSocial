// src/components/ImageViewerModal.js

const ImageViewerModal = ({ src, onClose }) => {
    const { React } = window;
    const { motion, AnimatePresence } = window.Motion;
    const imgRef = React.useRef(null);
    const containerRef = React.useRef(null);
    const panzoomRef = React.useRef(null);

    React.useEffect(() => {
        if (src && imgRef.current && window.Panzoom) {
            try {
                // Initialize Panzoom
                panzoomRef.current = window.Panzoom(imgRef.current, {
                    maxScale: 5,
                    minScale: 1,
                    contain: 'outside',
                });
                
                // Allow wheel zoom if method exists
                const elem = imgRef.current.parentElement;
                if (elem && panzoomRef.current && typeof panzoomRef.current.zoomWithWheel === 'function') {
                    elem.addEventListener('wheel', panzoomRef.current.zoomWithWheel);
                }
            } catch (err) {
                console.error("Panzoom init error", err);
            }
        }
        
        return () => {
            if (panzoomRef.current) {
                if (imgRef.current && imgRef.current.parentElement && typeof panzoomRef.current.zoomWithWheel === 'function') {
                    imgRef.current.parentElement.removeEventListener('wheel', panzoomRef.current.zoomWithWheel);
                }
                if (typeof panzoomRef.current.destroy === 'function') {
                    try {
                        panzoomRef.current.destroy();
                    } catch (e) {
                        console.error("Panzoom destroy error", e);
                    }
                }
            }
        };
    }, [src]);

    return (
        <AnimatePresence>
            {src && (
                <motion.div 
                    key="image-viewer-modal"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-[999] bg-black/90 flex items-center justify-center touch-none backdrop-blur-md"
                    onClick={(e) => {
                        // Close if clicking the background wrapper
                        if (e.target === containerRef.current || e.target === e.currentTarget) {
                            onClose();
                        }
                    }}
                >
                    <button 
                        onClick={onClose}
                        className="absolute top-6 right-6 z-[1000] p-3 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-full text-white transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                    
                    <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden p-4">
                        <img 
                            ref={imgRef}
                            src={src} 
                            alt="Full Screen" 
                            className="max-w-full max-h-full object-contain cursor-grab active:cursor-grabbing rounded-xl shadow-2xl"
                            style={{ touchAction: 'none' }} // Required for Panzoom multi-touch
                        />
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

window.ImageViewerModal = ImageViewerModal;
