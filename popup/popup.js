document.addEventListener('DOMContentLoaded', () => {
    console.log('Popup loaded successfully.');

    const btn = document.getElementById('test-btn');
    if (btn) {
        btn.addEventListener('click', () => {
            console.log('Button clicked!');
            btn.textContent = 'Hello Firefox!';
        });
    }
});