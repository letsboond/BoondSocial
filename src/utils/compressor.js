// File: src/utils/compressor.js

window.utils = window.utils || {};

/**
 * Compresses an image file using HTML5 Canvas.
 * @param {File} file - The original image file
 * @param {number} maxWidth - Maximum width of the compressed image
 * @param {number} maxHeight - Maximum height of the compressed image
 * @param {number} quality - JPEG quality from 0 to 1
 * @returns {Promise<File>} - The compressed image file
 */
window.utils.compressImage = async (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        // If not an image, return original file (could be useful for basic filter)
        if (!file.type.startsWith('image/')) {
            return resolve(file);
        }

        const reader = new FileReader();
        reader.readAsDataURL(file);
        
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Calculate aspect ratio
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                // Create canvas and draw image
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;

                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                // Convert canvas to blob
                canvas.toBlob((blob) => {
                    if (!blob) {
                        reject(new Error('Canvas to Blob failed'));
                        return;
                    }
                    
                    // Generate new file
                    const fileName = file.name.replace(/\.[^/.]+$/, "") + ".jpg";
                    const compressedFile = new File([blob], fileName, {
                        type: 'image/jpeg',
                        lastModified: Date.now()
                    });
                    
                    resolve(compressedFile);
                }, 'image/jpeg', quality);
            };
            
            img.onerror = error => reject(error);
        };
        
        reader.onerror = error => reject(error);
    });
};

/**
 * Placeholder for video compression.
 * Note: Frontend video compression requires heavy WASM libraries (like ffmpeg.wasm)
 * which can freeze the browser and consume a lot of memory.
 * For now, this just validates the size and returns the original file.
 */
window.utils.compressVideo = async (file, maxMB = 50) => {
    // In the future, you could integrate ffmpeg.wasm here.
    // For now, we will just ensure it's under maxMB.
    const maxBytes = maxMB * 1024 * 1024;
    if (file.size > maxBytes) {
        throw new Error(`Video file is too large! Maximum allowed size is ${maxMB}MB.`);
    }
    return file; // Return original video for backend or simple storage
};
