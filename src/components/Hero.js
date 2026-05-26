// src/components/Hero.js

const Hero = ({ onDemoStart }) => {
    const { motion } = window.Motion;

    return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden">
            {/* Background Blob */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-brand-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500 rounded-full mix-blend-multiply filter blur-[100px] opacity-20 animate-blob animation-delay-2000"></div>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
            >
                <img src="/logo.png" alt="Boond Logo" className="h-24 mx-auto mb-6" />
                <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto mb-8 font-light">
                    The Wearable Link-in-Bio. <br />
                    <span className="font-semibold text-white">Connect instantly in the real world.</span>
                </p>

                <div className="flex gap-4 justify-center">
                    <button className="px-8 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-full font-semibold transition-all shadow-[0_0_20px_rgba(14,165,233,0.5)]">
                        Beli Boond
                    </button>
                    <button onClick={onDemoStart} className="px-8 py-3 glass-panel border border-white/10 hover:bg-white/10 rounded-full transition-all">
                        Demo App
                    </button>
                </div>
            </motion.div>
        </div>
    );
};

window.Hero = Hero;
