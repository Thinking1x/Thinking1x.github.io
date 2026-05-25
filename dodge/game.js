// ==========================================
// GAME ENGINE & STATE
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const timeDisplay = document.getElementById('timeDisplay');
const flashCooldownUI = document.getElementById('flashCooldown');
const gameOverScreen = document.getElementById('gameOverScreen');
const restartBtn = document.getElementById('restartBtn');

// Global State
let isGameOver = false;
let startTime = 0;
let lastTime = 0;
let spawnRate = 1200; 
let lastSpawn = 0;
let mouseX = canvas.width / 2, mouseY = canvas.height / 2;
let skillshots = [];
let particles = [];
let clickIndicators = [];

// The Champion (Mage)
let player = {
    x: canvas.width / 2, 
    y: canvas.height / 2,
    targetX: canvas.width / 2, 
    targetY: canvas.height / 2,
    radius: 12,    // Actual hitbox (small for fair dodging)
    speed: 280, 
    angle: 0,
    flashCooldown: 5000, // 5 seconds
    lastFlash: -5000,    // Starts ready
    walkCycle: 0         // Used for animation wobble
};

// ==========================================
// INPUT CONTROLS
// ==========================================
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
});

// Click to move
canvas.addEventListener('mousedown', (e) => {
    if (isGameOver) return;
    if (e.button === 0 || e.button === 2) { // Left or Right click
        player.targetX = mouseX;
        player.targetY = mouseY;
        // Spawn green move indicator
        clickIndicators.push({ x: mouseX, y: mouseY, radius: 0, alpha: 1 });
    }
});

// Prevent right-click menu popping up in-game
canvas.addEventListener('contextmenu', e => e.preventDefault());

// Flash Ability
window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f' && !isGameOver) {
        const now = Date.now();
        if (now - player.lastFlash >= player.flashCooldown) {
            const dx = mouseX - player.x;
            const dy = mouseY - player.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist > 0) {
                // Flash visual burst at OLD position
                spawnParticles(player.x, player.y, '#fbbf24', 15);
                
                const flashDist = 180; // Distance of the jump
                player.x += (dx / dist) * flashDist;
                player.y += (dy / dist) * flashDist;
                
                // Clamp to bounds
                player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
                player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
                
                player.targetX = player.x;
                player.targetY = player.y;
                player.lastFlash = now;

                // Flash visual burst at NEW position
                spawnParticles(player.x, player.y, '#fef08a', 20);
            }
        }
    }
});

restartBtn.addEventListener('click', initGame);

// ==========================================
// SPAWNERS & PARTICLES
// ==========================================
function spawnSkillshot() {
    const edge = Math.floor(Math.random() * 4);
    let x, y, vx, vy, radius, speed, color, typeName;
    const rand = Math.random();

    // Archetypes
    if (rand < 0.4) {
        radius = 9; speed = 450; color = '#38bdf8'; typeName = 'fast'; 
    } else if (rand < 0.7) {
        radius = 28; speed = 160; color = '#a855f7'; typeName = 'heavy';
    } else {
        radius = 14; speed = 300; color = '#ef4444'; typeName = 'tracker'; 
    }

    // Edge placement
    if (edge === 0) { x = Math.random() * canvas.width; y = -50; }
    else if (edge === 1) { x = canvas.width + 50; y = Math.random() * canvas.height; }
    else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 50; }
    else { x = -50; y = Math.random() * canvas.height; }

    // Targeting
    let targetX, targetY;
    if (typeName === 'tracker') {
        targetX = player.x; targetY = player.y;
    } else {
        // Aim broadly at the center arena
        targetX = (canvas.width/2) + (Math.random() - 0.5) * 500;
        targetY = (canvas.height/2) + (Math.random() - 0.5) * 400;
    }

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    vx = (dx / dist) * speed;
    vy = (dy / dist) * speed;

    skillshots.push({ x, y, vx, vy, radius, color, trail: [] });
}

function spawnParticles(x, y, color, count) {
    for(let i=0; i<count; i++) {
        particles.push({
            x: x, y: y,
            vx: (Math.random() - 0.5) * 200,
            vy: (Math.random() - 0.5) * 200,
            life: 1.0,
            color: color
        });
    }
}

// ==========================================
// RENDERERS
// ==========================================
function drawEnvironment(ctx) {
    // A procedural moody dark arena floor
    const grad = ctx.createRadialGradient(canvas.width/2, canvas.height/2, 50, canvas.width/2, canvas.height/2, 600);
    grad.addColorStop(0, '#1e293b');
    grad.addColorStop(1, '#020617');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Subtle Grid lines for depth
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for(let i=0; i<canvas.width; i+=40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, canvas.height); ctx.stroke(); }
    for(let i=0; i<canvas.height; i+=40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(canvas.width, i); ctx.stroke(); }
}

function drawChampion(ctx, p) {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);

    // Animate wobble if moving
    const isMoving = Math.hypot(p.targetX - p.x, p.targetY - p.y) > 2;
    if (isMoving) p.walkCycle += 0.2;
    const wobble = isMoving ? Math.sin(p.walkCycle) * 3 : 0;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(-5, 5, 20, 0, Math.PI*2); ctx.fill();

    // Flowing Cape
    ctx.fillStyle = '#0369a1'; 
    ctx.beginPath();
    ctx.moveTo(-15, -12);
    ctx.lineTo(-30 + wobble, 0); // Cape flaps!
    ctx.lineTo(-15, 12);
    ctx.lineTo(8, 12);
    ctx.lineTo(8, -12);
    ctx.fill();

    // Gold Shoulders
    ctx.fillStyle = '#eab308'; 
    ctx.beginPath();
    ctx.arc(4, -14, 8, 0, Math.PI*2);
    ctx.arc(4, 14, 8, 0, Math.PI*2);
    ctx.fill();

    // Head / Hood
    ctx.fillStyle = '#0f172a';
    ctx.beginPath(); ctx.arc(6, 0, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fca5a5'; // Face
    ctx.beginPath(); ctx.arc(10, 0, 5, -Math.PI/2, Math.PI/2); ctx.fill();

    // Staff
    ctx.fillStyle = '#451a03'; 
    ctx.fillRect(8, 16 + wobble/2, 35, 4);
    
    // Pulsing Gem on Staff
    const pulse = Math.abs(Math.sin(Date.now() / 200)) * 4;
    ctx.shadowBlur = 15 + pulse;
    ctx.shadowColor = '#00E5FF';
    ctx.fillStyle = '#00E5FF';
    ctx.beginPath();
    ctx.arc(44, 18 + wobble/2, 6, 0, Math.PI*2);
    ctx.fill();
    
    ctx.restore();

    // Draw the exact tiny collision hitbox (so the player knows what to dodge with)
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI*2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    ctx.stroke();
}

// ==========================================
// MAIN LOOP
// ==========================================
function initGame() {
    isGameOver = false;
    skillshots = [];
    particles = [];
    clickIndicators = [];
    player.x = canvas.width / 2; player.y = canvas.height / 2;
    player.targetX = player.x; player.targetY = player.y;
    player.lastFlash = -5000;
    
    startTime = Date.now();
    lastTime = Date.now();
    lastSpawn = Date.now();
    gameOverScreen.classList.add('hidden');
    update();
}

function update() {
    if (isGameOver) return;
    const now = Date.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap dt to prevent huge jumps if tabbed out
    lastTime = now;

    // 1. Move Player
    const dx = player.targetX - player.x;
    const dy = player.targetY - player.y;
    const dist = Math.hypot(dx, dy);
    
    if (dist > 1) player.angle = Math.atan2(dy, dx); // Face movement direction

    const moveDist = player.speed * dt;
    if (dist > moveDist) {
        player.x += (dx / dist) * moveDist;
        player.y += (dy / dist) * moveDist;
    } else {
        player.x = player.targetX;
        player.y = player.targetY;
    }

    // 2. Spawn Logic (Gets harder over time)
    let currentSpawnRate = Math.max(120, spawnRate - ((now - startTime) / 80)); 
    if (now - lastSpawn > currentSpawnRate) {
        spawnSkillshot();
        lastSpawn = now;
    }

    // 3. Render Setup
    drawEnvironment(ctx);

    // 4. Draw Click Indicators
    for (let i = clickIndicators.length - 1; i >= 0; i--) {
        let ci = clickIndicators[i];
        ctx.beginPath(); ctx.arc(ci.x, ci.y, ci.radius, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(34, 197, 94, ${ci.alpha})`;
        ctx.lineWidth = 2; ctx.stroke();
        
        ci.radius += 60 * dt; ci.alpha -= 3 * dt;
        if (ci.alpha <= 0) clickIndicators.splice(i, 1);
    }

    // 5. Update & Draw Skillshots
    for (let i = skillshots.length - 1; i >= 0; i--) {
        let s = skillshots[i];
        s.x += s.vx * dt;
        s.y += s.vy * dt;

        // Trail Logic
        s.trail.push({x: s.x, y: s.y});
        if (s.trail.length > 8) s.trail.shift();

        // Draw Trail
        if (s.trail.length > 1) {
            ctx.beginPath();
            ctx.moveTo(s.trail[0].x, s.trail[0].y);
            for(let pt of s.trail) ctx.lineTo(pt.x, pt.y);
            ctx.strokeStyle = s.color;
            ctx.lineWidth = s.radius * 1.5;
            ctx.lineCap = 'round';
            ctx.globalAlpha = 0.3;
            ctx.stroke();
            ctx.globalAlpha = 1.0; // reset
        }

        // Draw Projectile Head
        ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2);
        ctx.fillStyle = '#fff'; // White hot core
        ctx.shadowBlur = 20; ctx.shadowColor = s.color;
        ctx.fill(); ctx.shadowBlur = 0;

        // Collision Check (Hitbox vs Hitbox)
        const collisionDist = Math.hypot(player.x - s.x, player.y - s.y);
        if (collisionDist < player.radius + s.radius - 2) { 
            spawnParticles(player.x, player.y, '#ef4444', 40); // Blood/Explosion
            triggerGameOver();
        }

        // Garbage Collect off-screen
        if (s.x < -100 || s.x > canvas.width + 100 || s.y < -100 || s.y > canvas.height + 100) {
            skillshots.splice(i, 1);
        }
    }

    // 6. Draw Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.life -= 2 * dt;

        if (p.life <= 0) { particles.splice(i, 1); continue; }

        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
        ctx.globalAlpha = 1.0;
    }

    // 7. Draw Player
    if (!isGameOver) drawChampion(ctx, player);

    // 8. Update HUD & Cooldowns
    const timeAlive = ((now - startTime) / 1000).toFixed(2);
    timeDisplay.innerText = timeAlive + "s";

    const cdRemaining = (player.flashCooldown - (now - player.lastFlash)) / 1000;
    if (cdRemaining <= 0) {
        flashCooldownUI.classList.add('hidden');
    } else {
        flashCooldownUI.classList.remove('hidden');
        flashCooldownUI.innerText = cdRemaining.toFixed(1);
    }

    requestAnimationFrame(update);
}

function triggerGameOver() {
    isGameOver = true;
    document.getElementById('finalTime').innerText = timeDisplay.innerText.replace('s', '');
    gameOverScreen.classList.remove('hidden');
}

// Start immediately
initGame();