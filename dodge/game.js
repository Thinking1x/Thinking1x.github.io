// ==========================================
// GAME ENGINE & STATE (FULL MOBA UPGRADE)
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

let gameState = 'select'; 
let hitPause = 0, screenShake = 0;   
let startTime = 0, lastTime = 0, spawnRate = 1200, lastSpawn = 0;
let mouseX = canvas.width/2, mouseY = canvas.height/2;

let skillshots = [];
let lasers = []; 
let particles = [];
let clickIndicators = [];

let player = {
    class: 'mage', x: 450, y: 325, targetX: 450, targetY: 325,
    radius: 12, baseSpeed: 280, speed: 280, angle: 0, walkCycle: 0,
    maxHp: 100, hp: 100, iFrames: 0, buffTimer: 0,
    abilities: {}
};

// ==========================================
// 🚀 NEW: SUMMONER'S RIFT ENVIRONMENT
// ==========================================
function initBackground() {
    // 1. Grass Base
    bgCtx.fillStyle = '#1e3323';
    bgCtx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. The River
    bgCtx.fillStyle = 'rgba(30, 90, 120, 0.5)';
    bgCtx.beginPath();
    bgCtx.moveTo(0, 500);
    bgCtx.quadraticCurveTo(450, 400, 900, 100);
    bgCtx.lineTo(900, 250);
    bgCtx.quadraticCurveTo(450, 550, 0, 650);
    bgCtx.fill();

    // 3. Dirt Path
    bgCtx.strokeStyle = '#4a3623';
    bgCtx.lineWidth = 60;
    bgCtx.lineCap = 'round'; bgCtx.lineJoin = 'round';
    bgCtx.beginPath(); bgCtx.moveTo(100, 0); bgCtx.lineTo(300, 300); bgCtx.lineTo(800, 550); bgCtx.stroke();
    
    // 4. Brush / Bushes
    bgCtx.fillStyle = '#132415';
    for (let i = 0; i < 40; i++) {
        bgCtx.beginPath();
        bgCtx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 15 + 10, 0, Math.PI * 2);
        bgCtx.fill();
    }
}

function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1)**2 + (y2 - y1)**2;
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
}

// ==========================================
// CHAMPION & ABILITY LOGIC
// ==========================================
function selectChampion(champType) {
    gameState = 'playing';
    champSelectScreen.classList.add('hidden');
    player.class = champType;
    
    if (champType === 'mage') {
        player.maxHp = 100; player.baseSpeed = 280; player.speed = 280;
        player.abilities = { 
            q: { type: 'pulse', cd: 4.0, lastUsed: -10, color: '#0ea5e9' },
            w: { type: 'shield', cd: 8.0, lastUsed: -10, color: '#fcd34d' },
            e: { type: 'speed', cd: 6.0, lastUsed: -10, color: '#10b981' },
            r: { type: 'nuke', cd: 15.0, lastUsed: -20, color: '#c026d3' },
            f: { type: 'flash', cd: 5.0, lastUsed: -10, dist: 180, color: '#eab308' } 
        };
    } else {
        player.maxHp = 70; player.baseSpeed = 340; player.speed = 340;
        player.abilities = { 
            q: { type: 'dash', cd: 2.5, lastUsed: -10, color: '#ef4444' },
            w: { type: 'vanish', cd: 6.0, lastUsed: -10, color: '#64748b' },
            e: { type: 'deflect', cd: 8.0, lastUsed: -10, color: '#f97316' },
            r: { type: 'overdrive', cd: 12.0, lastUsed: -20, color: '#dc2626' },
            f: { type: 'flash', cd: 5.0, lastUsed: -10, dist: 180, color: '#eab308' } 
        };
    }

    // Update UI Colors to represent skills
    for (const key in player.abilities) {
        document.getElementById(`icon${key.toUpperCase()}`).style.backgroundColor = player.abilities[key].color;
    }
    
    initGame();
}

// 🚀 NEW: Executing the 8 Unique Abilities
window.addEventListener('keydown', (e) => {
    if (gameState !== 'playing' || hitPause > 0) return;
    const key = e.key.toLowerCase();
    const now = (Date.now() - startTime) / 1000;

    if (player.abilities[key]) {
        let ability = player.abilities[key];
        
        // Overdrive Logic (Assassin R resets Q)
        if (key === 'q' && player.buffTimer > 0 && player.class === 'assassin') {
            ability.lastUsed = -10; // Instant reset!
        }

        if (now - ability.lastUsed >= ability.cd) {
            const dx = mouseX - player.x, dy = mouseY - player.y;
            const dist = Math.hypot(dx, dy);
            
            // MOVEMENT SKILLS
            if (dist > 0 && (ability.type === 'flash' || ability.type === 'dash')) {
                spawnParticles(player.x, player.y, ability.color, 15);
                const jumpDist = ability.type === 'flash' ? ability.dist : 150;
                player.x += (dx / dist) * jumpDist; player.y += (dy / dist) * jumpDist;
                player.targetX = player.x; player.targetY = player.y;
                spawnParticles(player.x, player.y, '#fff', 20);
                screenShake = 5;
            } 
            // DEFENSIVE SKILLS
            else if (ability.type === 'shield' || ability.type === 'vanish') {
                player.iFrames = ability.type === 'shield' ? 2.0 : 1.0;
                spawnParticles(player.x, player.y, ability.color, 40);
            } 
            // UTILITY SKILLS
            else if (ability.type === 'speed' || ability.type === 'overdrive') {
                player.buffTimer = 3.0; // Buff lasts 3 seconds
                spawnParticles(player.x, player.y, ability.color, 30);
            }
            // OFFENSIVE/CLEAR SKILLS
            else if (ability.type === 'pulse') {
                skillshots = skillshots.filter(s => Math.hypot(player.x - s.x, player.y - s.y) > 150); // Clear close by
                spawnParticles(player.x, player.y, ability.color, 50); screenShake = 8;
            }
            else if (ability.type === 'deflect') {
                for (let s of skillshots) { s.vx *= -1; s.vy *= -1; } // Send projectiles backward!
                spawnParticles(player.x, player.y, ability.color, 50); screenShake = 8;
            }
            else if (ability.type === 'nuke') {
                skillshots = []; lasers = []; // Clear entire screen!
                spawnParticles(player.x, player.y, ability.color, 100); screenShake = 20;
            }
            
            ability.lastUsed = now;
        }
    }
});

function takeDamage(amount) {
    if (player.iFrames > 0) return; 
    player.hp -= amount; player.iFrames = 0.2; hitPause = 0.05; screenShake = 15;
    spawnParticles(player.x, player.y, '#ef4444', 30); 
    hpFill.style.width = Math.max(0, (player.hp / player.maxHp) * 100) + '%';
    hpText.innerText = `${Math.max(0, player.hp)} / ${player.maxHp}`;
    if (player.hp <= 0) triggerDeath();
}

// ... [Keep spawnLaser(), spawnSkillshot(), and spawnParticles() exactly the same here] ...
function spawnLaser() {
    const edges = [[0, Math.random()*canvas.height], [canvas.width, Math.random()*canvas.height], [Math.random()*canvas.width, 0], [Math.random()*canvas.width, canvas.height]];
    const startPt = edges[Math.floor(Math.random() * 4)];
    const dx = player.x - startPt[0], dy = player.y - startPt[1];
    const dist = Math.hypot(dx, dy);
    lasers.push({ x1: startPt[0], y1: startPt[1], x2: startPt[0] + (dx/dist)*2000, y2: startPt[1] + (dy/dist)*2000, state: 'warning', timer: 1.0, width: 60 });
}

function spawnSkillshot() {
    const edge = Math.floor(Math.random() * 4);
    let x, y, vx, vy, radius, speed, color, typeName;
    if (Math.random() < 0.4) { radius = 9; speed = 450; color = '#38bdf8'; typeName = 'fast'; } 
    else if (Math.random() < 0.7) { radius = 28; speed = 160; color = '#a855f7'; typeName = 'heavy'; } 
    else { radius = 14; speed = 300; color = '#ef4444'; typeName = 'tracker'; }

    if (edge === 0) { x = Math.random() * canvas.width; y = -50; }
    else if (edge === 1) { x = canvas.width + 50; y = Math.random() * canvas.height; }
    else if (edge === 2) { x = Math.random() * canvas.width; y = canvas.height + 50; }
    else { x = -50; y = Math.random() * canvas.height; }

    let targetX = typeName === 'tracker' ? player.x : (canvas.width/2) + (Math.random() - 0.5) * 500;
    let targetY = typeName === 'tracker' ? player.y : (canvas.height/2) + (Math.random() - 0.5) * 400;
    const dx = targetX - x, dy = targetY - y, dist = Math.hypot(dx, dy);
    skillshots.push({ x, y, vx: (dx / dist)*speed, vy: (dy / dist)*speed, radius, color, typeName, trail: [] });
}

function spawnParticles(x, y, color, count) {
    for(let i=0; i<count; i++) particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 300, vy: (Math.random() - 0.5) * 300, life: 1.0, color: color });
}

// ==========================================
// RENDERERS
// ==========================================
function drawAssassin(ctx, p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
    const wobble = Math.sin(p.walkCycle) * 3;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.arc(-5, 5, 20, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#991b1b'; ctx.beginPath(); ctx.moveTo(-10, -10); ctx.lineTo(-25 + wobble, -5); ctx.lineTo(-25 - wobble, 5); ctx.lineTo(-10, 10); ctx.fill();
    ctx.fillStyle = '#cbd5e1'; ctx.fillRect(5, -15 + wobble/2, 15, 3); ctx.fillRect(5, 12 - wobble/2, 15, 3); 
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
    ctx.shadowBlur = 15; ctx.shadowColor = '#00E5FF'; ctx.fillStyle = '#00E5FF'; ctx.beginPath(); ctx.arc(44, 18 + wobble/2, 6, 0, Math.PI*2); ctx.fill();
    ctx.restore();
}

// ==========================================
// MAIN LOOP
// ==========================================
canvas.addEventListener('mousemove', (e) => { const rect = canvas.getBoundingClientRect(); mouseX = e.clientX - rect.left; mouseY = e.clientY - rect.top; });
canvas.addEventListener('mousedown', (e) => {
    if (gameState !== 'playing' || hitPause > 0) return;
    if (e.button === 0 || e.button === 2) { player.targetX = mouseX; player.targetY = mouseY; clickIndicators.push({ x: mouseX, y: mouseY, radius: 0, alpha: 1 }); }
});
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.getElementById('restartBtn').addEventListener('click', () => { gameState = 'select'; champSelectScreen.classList.remove('hidden'); gameOverScreen.classList.add('hidden'); });

function initGame() {
    initBackground(); // Draw Summoner's Rift!
    player.hp = player.maxHp; player.iFrames = 0; player.buffTimer = 0;
    hpFill.style.width = '100%'; hpText.innerText = `${player.hp} / ${player.maxHp}`;
    
    hitPause = 0; screenShake = 0; skillshots = []; lasers = []; particles = []; clickIndicators = [];
    player.x = canvas.width/2; player.y = canvas.height/2; player.targetX = player.x; player.targetY = player.y;
    
    startTime = Date.now(); lastTime = Date.now(); lastSpawn = Date.now();
    update();
}

function update() {
    if (gameState !== 'playing') return;
    const now = Date.now(), dt = Math.min((now - lastTime) / 1000, 0.1); lastTime = now; const gameTime = (now - startTime) / 1000;

    if (hitPause > 0) {
        hitPause -= dt;
    } else {
        if (player.iFrames > 0) player.iFrames -= dt;
        
        // 🚀 Speed Buff Logic
        if (player.buffTimer > 0) {
            player.buffTimer -= dt;
            player.speed = player.class === 'mage' ? player.baseSpeed + 200 : player.baseSpeed; 
            spawnParticles(player.x, player.y, player.class === 'mage' ? '#10b981' : '#dc2626', 1); // Trail effect
        } else {
            player.speed = player.baseSpeed;
        }

        const dx = player.targetX - player.x, dy = player.targetY - player.y, dist = Math.hypot(dx, dy);
        if (dist > 1) {
            player.angle = Math.atan2(dy, dx); player.walkCycle += dt * 15;
            player.x += (dx / dist) * Math.min(dist, player.speed * dt); player.y += (dy / dist) * Math.min(dist, player.speed * dt);
            player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
            player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
        }

        let currentSpawnRate = Math.max(120, spawnRate - (gameTime * 15)); 
        if (now - lastSpawn > currentSpawnRate) {
            if (Math.random() < 0.15 && gameTime > 5) spawnLaser(); else spawnSkillshot();
            lastSpawn = now;
        }

        for (let i = skillshots.length - 1; i >= 0; i--) {
            let s = skillshots[i]; s.x += s.vx * dt; s.y += s.vy * dt;
            s.trail.push({x: s.x, y: s.y}); if (s.trail.length > 8) s.trail.shift();
            if (Math.hypot(player.x - s.x, player.y - s.y) < player.radius + s.radius) {
                takeDamage(20); skillshots.splice(i, 1); continue; 
            }
            if (s.x < -100 || s.x > canvas.width+100 || s.y < -100 || s.y > canvas.height+100) skillshots.splice(i, 1);
        }

        for (let i = lasers.length - 1; i >= 0; i--) {
            let l = lasers[i]; l.timer -= dt;
            if (l.state === 'warning' && l.timer <= 0) { l.state = 'firing'; l.timer = 0.3; screenShake = 5; } 
            else if (l.state === 'firing') {
                if (distToSegment(player.x, player.y, l.x1, l.y1, l.x2, l.y2) < player.radius + (l.width/2)) takeDamage(50);
                if (l.timer <= 0) lasers.splice(i, 1);
            }
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        let p = particles[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.life -= 2 * dt;
        if (p.life <= 0) particles.splice(i, 1); 
    }

    // RENDER
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    if (screenShake > 0.5) { ctx.translate((Math.random()-0.5)*screenShake, (Math.random()-0.5)*screenShake); screenShake *= 0.9; }

    ctx.drawImage(bgCanvas, 0, 0); // Draw Summoner's Rift Background!

    for (let i = clickIndicators.length - 1; i >= 0; i--) {
        let ci = clickIndicators[i]; ctx.beginPath(); ctx.arc(ci.x, ci.y, ci.radius, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(34, 197, 94, ${ci.alpha})`; ctx.lineWidth = 2; ctx.stroke();
        ci.radius += 60 * dt; ci.alpha -= 3 * dt; if (ci.alpha <= 0) clickIndicators.splice(i, 1);
    }

    ctx.globalCompositeOperation = 'lighter';
    for (let l of lasers) {
        ctx.beginPath(); ctx.moveTo(l.x1, l.y1); ctx.lineTo(l.x2, l.y2);
        if (l.state === 'warning') { ctx.strokeStyle = 'rgba(239, 68, 68, 0.4)'; ctx.lineWidth = 2; } 
        else { ctx.strokeStyle = '#fef08a'; ctx.lineWidth = l.width; ctx.shadowBlur = 30; ctx.shadowColor = '#fbbf24'; }
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
    
    if (player.iFrames <= 0 || Math.floor(gameTime * 20) % 2 === 0) {
        if (player.class === 'mage') drawMage(ctx, player); else drawAssassin(ctx, player);
        ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI*2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'; ctx.lineWidth = 1; ctx.stroke();
    }
    ctx.restore();

    timeDisplay.innerText = gameTime.toFixed(2) + "s";
    
    // Update Cooldown UI
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