// Debug Script to catch top-level errors
window.onerror = function (message, source, lineno, colno, error) {
    const errorDiv = document.createElement('div');
    errorDiv.style.position = 'fixed';
    errorDiv.style.top = '0';
    errorDiv.style.left = '0';
    errorDiv.style.width = '100%';
    errorDiv.style.backgroundColor = 'red';
    errorDiv.style.color = 'white';
    errorDiv.style.padding = '20px';
    errorDiv.style.zIndex = '9999';
    errorDiv.style.fontFamily = 'monospace';
    errorDiv.innerHTML = `<h3>Global Error Caught</h3>
    <p><strong>Message:</strong> ${message}</p>
    <p><strong>Source:</strong> ${source}:${lineno}:${colno}</p>
    <pre>${error ? error.stack : 'No stack trace'}</pre>`;
    document.body.appendChild(errorDiv);
};

console.log("Debug script loaded");
