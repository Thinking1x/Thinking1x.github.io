// ==========================================
// INTERACTIVE KEYBOARD LAUNCHPAD (SPLIT MODE)
// ==========================================

// 1. Mapped exactly to your home row layout
const launchpadKeys = {
    'a': 0, // 1st song in list
    's': 1, // 2nd
    'd': 2, // 3rd
    'f': 3, // 4th
    'j': 4, // 5th
    'k': 5, // 6th
    'l': 6, // 7th
    ';': 7, // 8th
    ':': 7  // Just in case you hold shift!
};

const activeKeys = new Set();

// 2. WHEN YOU PRESS DOWN
document.addEventListener('keydown', (event) => {
    if (event.target.tagName === 'INPUT') return; 

    const key = event.key.toLowerCase();
    if (launchpadKeys[key] === undefined || activeKeys.has(key)) return;

    activeKeys.add(key);

    const trackIndex = launchpadKeys[key];
    
    // ⚠️ IMPORTANT: Ensure your rows actually use the class '.track'
    // If your HTML uses a different name like '.song-row', change it here!
    const trackRows = document.querySelectorAll('.track'); 

    if (trackRows[trackIndex]) {
        const row = trackRows[trackIndex];

        // Generate a random hue specifically for the keyboard
        const randomHue = Math.floor(Math.random() * 360);
        row.style.setProperty('--kb-hue', randomHue);

        // Add our NEW independent CSS class that player.js can't erase
        row.classList.add('keyboard-flash');
    }
});

// 3. WHEN YOU LIFT UP
document.addEventListener('keyup', (event) => {
    const key = event.key.toLowerCase();
    
    if (launchpadKeys[key] !== undefined) {
        activeKeys.delete(key);

        const trackIndex = launchpadKeys[key];
        const trackRows = document.querySelectorAll('.track');

        if (trackRows[trackIndex]) {
            const row = trackRows[trackIndex];
            
            // Remove the independent glow instantly
            row.classList.remove('keyboard-flash');
        }
    }
});