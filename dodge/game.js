// ==========================================
// GAME ENGINE & STATE (CHAMPION UPGRADE)
// ==========================================
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const timeDisplay = document.getElementById('timeDisplay');
const gameOverScreen = document.getElementById('gameOverScreen');
const champSelectScreen = document.getElementById('champSelectScreen');
const hpFill = document.getElementById('hpFill');
const hpText = document.getElementById('hpText');

const bgCanvas = document.createElement('canvas');
bgCanvas.width = canvas.width; bgCanvas.height = canvas.height;
const bgCtx = bgCanvas.getContext('2d');

// Global State
let gameState = 'select'; // 'select', 'playing', 'dead'
let hitPause = 0;      
let screenShake = 0;   
let startTime = 0, lastTime = 0, spawnRate = 1200, lastSpawn = 0;
let mouseX = canvas.width/2, mouseY = canvas.height/2;

let skillshots = [];
let lasers = []; // 🚀 NEW: Array just for beam weapons
let particles = [];
let clickIndicators = [];

// The Player Object
let player = {
    class: 'mage', x: 450, y: 325, targetX: 450, targetY: 325,
    radius: 12, speed: 280, angle: 0, walkCycle: 0,
    maxHp: 100, hp: 100, iFrames: 0,
    abilities: {}
};

// ==========================================
// MATHEMATICS (Distance from point to a Line)
// ==========================================
// Used to calculate if you are standing inside the Laser Beam
function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1)**2 + (y2 - y1)**2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projX = x1 + t * (x2 - x1);
    const projY = y1 + t * (y2 - y1);
    return Math.hypot(px - projX, py - projY);
}

// ==========================================
// CHAMPION LOGIC & ABILITIES
// ==========================================
function selectChampion(champType) {
    gameState = 'playing';
    champSelectScreen.classList.add('hidden');
    
    player.class = champType;
    if (champType === 'mage') {
        player.maxHp = 100; player.speed = 280;
        player.abilities = { f: { type: 'flash', cd: 5.0, lastUsed: -5, dist: 180 } };
        document.getElementById('slotF').classList.remove('locked');
        document.getElementById('slotQ').classList.add('locked');
    } else if (champType === 'assassin') {
        player.maxHp = 70; player.speed = 340;
        player.abilities = { q: { type: 'dash', cd: 2.5, lastUsed: -5, speed: 1200 } };
        document.getElementById('slotQ').classList.remove('locked');
        document.getElementById('slotF').classList.add('locked');
    }
    
    initGame();
}

function takeDamage(amount) {
    if (player.iFrames > 0) return; // Immune!
    
    player.hp -= amount;
    player.iFrames = 0.2; // 0.2 seconds of invulnerability
    hitPause = 0.05; 
    screenShake = 15;
    spawnParticles(player.x, player.y, '#ef4444', 30); 
    
    // Update UI
    hpFill.style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
    hpText.innerText = `${Math.max(0, player.hp)} / ${player.maxHp}`;
    
    if (player.hp <= 0) triggerDeath();
}

window.addEventListener('keydown', (e) => {
    if (gameState !== 'playing' || hitPause > 0) return;
    const key = e.key.toLowerCase();
    const now = (Date.now() - startTime) / 1000; // Game time in seconds

    if (player.abilities[key]) {
        let ability = player.abilities[key];
        if (now - ability.lastUsed >= ability.cd) {
            
            const dx = mouseX - player.x, dy = mouseY - player.y;
            const dist = Math.hypot(dx, dy);
            
            if (dist > 0) {
                if (ability.type === 'flash') {
                    spawnParticles(player.x, player.y, '#fbbf24', 15);
                    player.x += (dx / dist) * ability.dist;
                    player.y += (dy / dist) * ability.dist;
                    player.targetX = player.x; player.targetY = player.y;
                    spawnParticles(player.x, player.y, '#fef08a', 20);
                } 
                else if (ability.type === 'dash') {
                    // Assassin Dash: Sets a target slightly further, increases speed momentarily
                    player.targetX = player.x + (dx / dist) * 200;
                    player.targetY = player.y + (dy / dist) * 200;
                    spawnParticles(player.x, player.y, '#ef4444', 10);
                }
                ability.lastUsed = now;
            }
        }
    }
});

// ==========================================
// SPAWNERS (Including Lux Laser)
// ==========================================
function spawnLaser() {
    // Lux R style: Picks a random edge, aims directly at player, fires after 1 sec delay
    const edges = [[0, Math.random()*canvas.height], [canvas.width, Math.random()*canvas.height], [Math.random()*canvas.width, 0], [Math.random()*canvas.width, canvas.height]];
    const startPt = edges[Math.floor(Math.random() * 4)];
    
    // Aim at player's current predicted location
    const dx = player.x - startPt[0], dy = player.y - startPt[1];
    const dist = Math.hypot(dx, dy);
    
    // Shoot the beam way past the player to cover the screen
    const endX = startPt[0] + (dx/dist) * 2000;
    const endY = startPt[1] + (dy/dist) * 2000;

    lasers.push({
        x1: startPt[0], y1: startPt[1], x2: endX, y2: endY,
        state: 'warning', timer: 1.0, width: 60
    });
}

// ... [Keep your previous spawnSkillshot() and spawnParticles() functions exactly the same here] ...
function spawnSkillshot() {
    const edge = Math.floor(Math.random() * 4);
    let x, y, vx, vy, radius, speed, color, typeName;
    const rand = Math.random();

    if (rand < 0.4) { radius = 9; speed = 450; color = '#38bdf8'; typeName = 'fast'; } 
    else if (rand < 0.7) { radius = 28; speed = 160; color = '#a855f7'; typeName = 'heavy'; } 
    else { radius = 14; speed = 300; color = '#ef4444'; typeName = 'tracker'; }

    if (edge === 0) { x = Math.random() * canvas.width; y = -50; }
    else if (edge === 1) { x = canvas.width + 50; y = Math.random() * canvas.height; }
    else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 50; }
    else { x = -50; y = Math.random() * canvas.height; }

    let targetX = typeName === 'tracker' ? player.x : (canvas.width/2) + (Math.random() - 0.5) * 500;
    let targetY = typeName === 'tracker' ? player.y : (canvas.height/2) + (Math.random() - 0.5) * 400;

    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy);
    vx = (dx / dist) * speed; vy = (dy / dist) * speed;

    skillshots.push({ x, y, vx, vy, radius, color, typeName, trail: [] });
}

function spawnParticles(x, y, color, count) {
    for(let i=0; i<count; i++) {
        particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, life: 1.0, color: color });
    }
}

// ==========================================
// RENDERERS
// ==========================================
function drawAssassin(ctx, p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    const wobble = Math.sin(p.walkCycle) * 3;

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(-5, 5, 20, 0, Math.PI*2); ctx.fill();

    // Tattered Red Cloak
    ctx.fillStyle = '#991b1b'; 
    ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-25 + wobble, -5); ctx.lineTo(-25 - wobble, 5); ctx.lineTo(-10, 10); ctx.fill();

    // Dual Daggers
    ctx.fillStyle = '#cbd5e1'; 
    ctx.fillRect(5, -15 + wobble/2, 15, 3); // Left dagger
    ctx.fillRect(5, 12 - wobble/2, 15, 3); // Right dagger

    // Dark Hood
    ctx.fillStyle = '#020617'; ctx.beginPath(); ctx.arc(3, 0, 9, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fca5a5'; ctx.beginPath(); ctx.arc(6, 0, 4, -Math.PI/2, Math.PI/2); ctx.fill();

    ctx.restore();
}

function drawMage(ctx, p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    const wobble = Math.sin(p.walkCycle) * 3;
    
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(-5, 5, 20, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0369a1'; ctx.beginPath(); ctx.moveTo(-15, -12); ctx.lineTo(-30 + wobble, 0); ctx.lineTo(-15, 12); ctx.fill();
    ctx.fillStyle = '#eab308'; ctx.beginPath(); ctx.arc(4, -14, 8, 0, Math.PI*2); ctx.arc(4, 14, 8, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#0f172a'; ctx.beginPath(); ctx.arc(6, 0, 10, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fca5a5'; ctx.beginPath(); ctx.arc(10, 0, 5, -Math.PI/2, Math.PI/2); ctx.fill();
    ctx.fillStyle = '#451a03'; ctx.fillRect(8, 16 + wobble/2, 35, 4);
    ctx.shadowBlur = 15; ctx.shadowColor = '#00E5FF'; ctx.fillStyle = '#00E5FF';
    ctx.beginPath(); ctx.arc(44, 18 + wobble/2, 6, 0, Math.PI*2); ctx.fill();
    ctx.restore();
}

// ==========================================
// MAIN LOOP
// ==========================================
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top;
});
canvas.addEventListener('mousedown', (e) => {
    if (gameState !== 'playing' || hitPause > 0) return;
    if (e.button === 0 || e.button === 2) { 
        player.targetX = mouseX; player.targetY = mouseY;
        clickIndicators.push({ x: mouseX, y: mouseY, radius: 0, alpha: 1 });
    }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.getElementById('restartBtn').addEventListener('click', () => { gameState = 'select'; champSelectScreen.classList.remove('hidden'); gameOverScreen.classList.add('hidden'); });

function initGame() {
    player.hp = player.maxHp; player.iFrames = 0;
    hpFill.style.width = '100%'; hpText.innerText = `${player.hp} / ${player.maxHp}`;
    
    bgCtx.clearRect(0,0, canvas.width, canvas.height); // Wipe background
    hitPause = 0; screenShake = 0; skillshots = []; lasers = []; particles = [];
    player.x = canvas.width/2; player.y = canvas.height/2; player.targetX = player.x; player.targetY = player.y;
    
    startTime = Date.now(); lastTime = Date.now(); lastSpawn = Date.now();
    update();
}

function update() {
    if (gameState !== 'playing') return;
    const now = Date.now();
    const dt = Math.min((now - lastTime) / 1000, 0.1); 
    lastTime = now;
    const gameTime = (now - startTime) / 1000;

    if (hitPause > 0) {
        hitPause -= dt;
    } else {
        if (player.iFrames > 0) player.iFrames -= dt;

        // Player Movement (Dash logic overrides standard speed if target is far and Q was just used)
        let currentSpeed = player.speed;
        if (player.class === 'assassin') {
            const timeSinceDash = gameTime - player.abilities.q.lastUsed;
            if (timeSinceDash < 0.2) currentSpeed = player.abilities.q.speed; // High speed during dash
        }

        const dx = player.targetX - player.x, dy = player.targetY - player.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
            player.angle = Math.atan2(dy, dx);
            player.walkCycle += dt * 15;
            player.x += (dx / dist) * Math.min(dist, currentSpeed * dt);
            player.y += (dy / dist) * Math.min(dist, currentSpeed * dt);
            
            // Keep in bounds
            player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
            player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
        }

        // Spawners
        let currentSpawnRate = Math.max(120, spawnRate - (gameTime * 15)); 
        if (now - lastSpawn > currentSpawnRate) {
            if (Math.random() < 0.15 && gameTime > 5) spawnLaser(); // 15% chance to spawn Lux R after 5s
            else spawnSkillshot();
            lastSpawn = now;
        }

        // Update Projectiles
        for (let i = skillshots.length - 1; i >= 0; i--) {
            let s = skillshots[i];
            s.x += s.vx * dt; s.y += s.vy * dt;
            s.trail.push({x: s.x, y: s.y}); if (s.trail.length > 8) s.trail.shift();

            if (Math.hypot(player.x - s.x, player.y - s.y) < player.radius + s.radius) {
                takeDamage(20);
                skillshots.splice(i, 1); continue; // Destroy projectile on hit
            }
            if (s.x < -100 || s.x > canvas.width+100 || s.y < -100 || s.y > canvas.height+100) skillshots.splice(i, 1);
        }

        // 🚀 NEW: Update Lasers (Lux R)
        for (let i = lasers.length - 1; i >= 0; i--) {
            let l = lasers[i];
            l.timer -= dt;
            
            if (l.state === 'warning' && l.timer <= 0) {
                l.state = 'firing'; l.timer = 0.3; // Fire beam for 0.3 seconds
                screenShake = 5; // Rumble while firing
            } 
            else if (l.state === 'firing') {
                // Check Collision against the line segment!
                if (distToSegment(player.x, player.y, l.x1, l.y1, l.x2, l.y2) < player.radius + (l.width/2)) {
                    takeDamage(50); // Massive damage
                }
                if (l.timer <= 0) lasers.splice(i, 1);
            }
        }
    }

    // Update Particles
    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i];
        p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 2 * dt;
        if (p.life <= 0) particles.splice(i, 1); 
    }

    // RENDER
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (screenShake > 0.5) {
        ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake);
        screenShake *= 0.9;
    }

    ctx.globalCompositeOperation = 'lighter';

    // Draw Lasers
    for (let l of lasers) {
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2);
        if (l.state === 'warning') {
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; ctx.lineWidth = 2; // Thin red line
        } else {
            ctx.strokeStyle = '#fef08a'; ctx.lineWidth = l.width; ctx.shadowBlur = 30; ctx.shadowColor = '#fbbf24'; // Massive blast
        }
        ctx.stroke(); ctx.shadowBlur = 0;
    }

    for (let s of skillshots) {
        if (s.trail.length > 1) {
            ctx.beginPath(); ctx.moveTo(s.trail[0].x, s.trail[0].y); for(let pt of s.trail) ctx.lineTo(pt.x, pt.y);
            ctx.strokeStyle = s.color; ctx.lineWidth = s.radius*1.5; ctx.lineCap = 'round'; ctx.globalAlpha = 0.3; ctx.stroke(); ctx.globalAlpha = 1.0; 
        }
        ctx.beginPath(); ctx.arc(s.x, s.y, s.radius, 0, Math.PI*2);
        ctx.fillStyle = '#fff'; ctx.shadowBlur = 20; ctx.shadowColor = s.color; ctx.fill(); ctx.shadowBlur = 0;
    }

    for (let p of particles) {
        ctx.fillStyle = p.color; ctx.globalAlpha = Math.max(0, p.life);
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1.0;
    }

    ctx.globalCompositeOperation = 'source-over';
    
    // Blink player if invincible
    if (player.iFrames <= 0 || Math.floor(gameTime * 20) % 2 === 0) {
        if (player.class === 'mage') drawMage(ctx, player);
        else if (player.class === 'assassin') drawAssassin(ctx, player);
        
        // Draw Hitbox over player for clarity
        ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 1; ctx.stroke();
    }
    
    ctx.restore();

    // UI Updates
    timeDisplay.innerText = gameTime.toFixed(2) + "s";
    
    // Update Cooldown UI (Checking whichever skill is active)
    for (const [key, ability] of Object.entries(player.abilities)) {
        const uiSlot = document.getElementById(`cd${key.toUpperCase()}`);
        if (uiSlot) {
            const cdRemaining = ability.cd - (gameTime - ability.lastUsed);
            if (cdRemaining <= 0) uiSlot.classList.add('hidden');
            else { uiSlot.classList.remove('hidden'); uiSlot.innerText = cdRemaining.toFixed(1); }
        }
    }

    requestAnimationFrame(update);
}

function triggerDeath() {
    gameState = 'dead';
    document.getElementById('finalTime').innerText = timeDisplay.innerText.replace('s', '');
    gameOverScreen.classList.remove('hidden');
}