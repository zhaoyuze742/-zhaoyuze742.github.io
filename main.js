// 防止 window.f12 报错影响主逻辑
try {
    if (typeof window !== 'undefined' && typeof window.f12 === 'undefined') {
        window.f12 = {};
    }
} catch (e) {}

// --- 游戏常量 ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const WIDTH = canvas.width;
const HEIGHT = canvas.height;

const gameOverPanel = document.getElementById('gameOverPanel');
const gameOverText = document.getElementById('gameOverText');
const restartBtn = document.getElementById('restartBtn');

// --- 坦克和子弹参数 ---
const TANK_SIZE = 40;
const BULLET_SIZE = 8;
const PLAYER_SPEED = 3;
const ENEMY_SPEED = 2;
const BULLET_SPEED = 6;
const ENEMY_FIRE_INTERVAL = 120; // 敌人每隔多少帧射击

// --- 工具函数 ---
function rectsIntersect(a, b) {
    return a.x < b.x + b.size &&
           a.x + a.size > b.x &&
           a.y < b.y + b.size &&
           a.y + a.size > b.y;
}

// --- 坦克类 ---
class Tank {
    constructor(x, y, color, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.size = TANK_SIZE;
        this.dir = 0; // 0:上 1:右 2:下 3:左
        this.color = color;
        this.isPlayer = isPlayer;
        this.cooldown = 0;
        this.alive = true;
    }
    move(dx, dy) {
        this.x += dx;
        this.y += dy;
        // 边界检测
        this.x = Math.max(0, Math.min(WIDTH - this.size, this.x));
        this.y = Math.max(0, Math.min(HEIGHT - this.size, this.y));
    }
    draw() {
        ctx.save();
        ctx.translate(this.x + this.size/2, this.y + this.size/2);
        ctx.rotate(this.dir * Math.PI/2);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.size/2, -this.size/2, this.size, this.size);
        // 炮管
        ctx.fillStyle = '#fff';
        ctx.fillRect(-5, -this.size/2, 10, 20);
        ctx.restore();
    }
    fire() {
        if (this.cooldown === 0) {
            let bx = this.x + this.size/2 - BULLET_SIZE/2;
            let by = this.y + this.size/2 - BULLET_SIZE/2;
            let dx = 0, dy = 0;
            switch(this.dir) {
                case 0: dy = -BULLET_SPEED; break;
                case 1: dx = BULLET_SPEED; break;
                case 2: dy = BULLET_SPEED; break;
                case 3: dx = -BULLET_SPEED; break;
            }
            bullets.push(new Bullet(bx, by, dx, dy, this.isPlayer));
            this.cooldown = 30;
        }
    }
    update() {
        if (this.cooldown > 0) this.cooldown--;
    }
}

// --- 子弹类 ---
class Bullet {
    constructor(x, y, dx, dy, fromPlayer) {
        this.x = x;
        this.y = y;
        this.size = BULLET_SIZE;
        this.dx = dx;
        this.dy = dy;
        this.fromPlayer = fromPlayer;
        this.alive = true;
    }
    update() {
        this.x += this.dx;
        this.y += this.dy;
        if (this.x < 0 || this.x > WIDTH || this.y < 0 || this.y > HEIGHT) {
            this.alive = false;
        }
    }
    draw() {
        ctx.fillStyle = this.fromPlayer ? '#ff0' : '#f00';
        ctx.fillRect(this.x, this.y, this.size, this.size);
    }
}

// --- 道具类 ---
class ShieldItem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 32;
        this.active = true;
        this.type = 'shield';
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x + this.size/2, this.y + this.size/2, this.size/2, 0, 2*Math.PI);
        ctx.fillStyle = 'rgba(80,200,255,0.7)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.font = '18px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('盾', this.x + this.size/2, this.y + this.size/2 + 7);
        ctx.restore();
    }
}
class HealItem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 32;
        this.active = true;
        this.type = 'heal';
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x + this.size/2, this.y + this.size/2, this.size/2, 0, 2*Math.PI);
        ctx.fillStyle = 'rgba(255,80,80,0.7)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.font = '18px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('血', this.x + this.size/2, this.y + this.size/2 + 7);
        ctx.restore();
    }
}
class SpeedItem {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 32;
        this.active = true;
        this.type = 'speed';
    }
    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(this.x + this.size/2, this.y + this.size/2, this.size/2, 0, 2*Math.PI);
        ctx.fillStyle = 'rgba(80,255,120,0.7)';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        ctx.font = '18px Arial';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.fillText('速', this.x + this.size/2, this.y + this.size/2 + 7);
        ctx.restore();
    }
}

let player, enemies, bullets, keys, frameCount, gameState;
let shieldItem = null;
let shieldTimer = 0;
let shieldActive = false;
let healActive = false;
let speedTimer = 0;
let speedActive = false;
let gold = 0;
let shopOpen = false;
let pause = false;
let availableItems = [
    { type: 'shield', name: '无敌盾', price: 10 },
    { type: 'heal', name: '回血包', price: 8 },
    { type: 'speed', name: '加速器', price: 12 }
];
let ownedSkins = ['default'];
let currentSkin = 'default';
let availableSkins = [
    { id: 'default', name: '经典绿', color: '#0f0', price: 0 },
    { id: 'red', name: '烈焰红', color: '#f33', price: 20 },
    { id: 'blue', name: '深空蓝', color: '#39f', price: 20 }
];

let items = [];
let PLAYER_SPEED_BASE = 3;
let PLAYER_SPEED_BOOST = 5;
let playerHP = 3;
let enemiesDefeated = 0;
let enemiesToWin = 10;

function initGame() {
    player = new Tank(WIDTH/2 - TANK_SIZE/2, HEIGHT - TANK_SIZE - 10, getSkinColor(currentSkin), true);
    enemies = [
        new Tank(100, 50, '#f00'),
        new Tank(350, 50, '#f00'),
        new Tank(600, 50, '#f00')
    ];
    bullets = [];
    keys = {};
    frameCount = 0;
    gameState = 'playing';
    hideGameOverPanel();
    resetItems();
    playerHP = 3;
    enemiesDefeated = 0;
    updateHPDisplay();
    updateProgressDisplay();
    // 2~5秒后随机生成道具
    setTimeout(spawnRandomItem, 2000 + Math.random()*3000);
}

// --- 事件监听 ---
document.addEventListener('keydown', e => {
    if (e.code === 'Space' || e.key === ' ') e.preventDefault();
    keys[e.key.toLowerCase()] = true;
});
document.addEventListener('keyup', e => { keys[e.key.toLowerCase()] = false; });

if (restartBtn) {
    restartBtn.onclick = () => {
        initGame();
        requestAnimationFrame(gameLoop);
    };
}

function showGameOverPanel(text) {
    if (gameOverPanel) {
        gameOverText.textContent = text;
        gameOverPanel.classList.remove('hidden');
    }
}
function hideGameOverPanel() {
    if (gameOverPanel) {
        gameOverPanel.classList.add('hidden');
    }
}

function spawnRandomItem() {
    const margin = 60;
    const x = Math.random() * (WIDTH - margin*2 - 32) + margin;
    const y = Math.random() * (HEIGHT - margin*2 - 32) + margin;
    const r = Math.random();
    let item;
    if (r < 0.34) item = new ShieldItem(x, y);
    else if (r < 0.67) item = new HealItem(x, y);
    else item = new SpeedItem(x, y);
    items.push(item);
}

function resetItems() {
    items = [];
    shieldTimer = 0;
    shieldActive = false;
    healActive = false;
    speedTimer = 0;
    speedActive = false;
}

function getSkinColor(skinId) {
    const skin = availableSkins.find(s => s.id === skinId);
    return skin ? skin.color : '#0f0';
}

// --- 主循环 ---
function gameLoop() {
    if (pause) return;
    ctx.clearRect(0, 0, WIDTH, HEIGHT);
    if (gameState !== 'playing') return;
    player.update();
    // 玩家移动
    let moveSpeed = speedActive ? PLAYER_SPEED_BOOST : PLAYER_SPEED_BASE;
    if (keys['arrowup'] || keys['w']) { player.dir = 0; player.move(0, -moveSpeed); }
    else if (keys['arrowright'] || keys['d']) { player.dir = 1; player.move(moveSpeed, 0); }
    else if (keys['arrowdown'] || keys['s']) { player.dir = 2; player.move(0, moveSpeed); }
    else if (keys['arrowleft'] || keys['a']) { player.dir = 3; player.move(-moveSpeed, 0); }
    if (keys[' ']) player.fire();
    // --- 绘制道具 ---
    items.forEach(item => item.draw());
    // 玩家吃到道具
    items = items.filter((item, index) => {
        if (item.active && rectsIntersect({x: player.x, y: player.y, size: player.size}, {x: item.x, y: item.y, size: item.size})) {
            if (item.type === 'shield') {
                shieldActive = true;
                shieldTimer = 300;
            } else if (item.type === 'heal') {
                playerHP = Math.min(playerHP + 1, 3);
                healActive = true;
                updateHPDisplay();
            } else if (item.type === 'speed') {
                speedActive = true;
                speedTimer = 240;
            }
            return false; // 移除已使用的道具
        }
        return true; // 保留未使用的道具
    });
    // --- 玩家无敌/加速特效 ---
    if (shieldActive) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(player.x + player.size/2, player.y + player.size/2, player.size/2 + 8, 0, 2*Math.PI);
        ctx.strokeStyle = 'rgba(80,200,255,0.7)';
        ctx.lineWidth = 6;
        ctx.setLineDash([8, 6]);
        ctx.stroke();
        ctx.restore();
        shieldTimer--;
        if (shieldTimer <= 0) shieldActive = false;
    }
    if (speedActive) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(player.x + player.size/2, player.y + player.size/2, player.size/2 + 16, 0, 2*Math.PI);
        ctx.strokeStyle = 'rgba(80,255,120,0.5)';
        ctx.lineWidth = 4;
        ctx.setLineDash([4, 8]);
        ctx.stroke();
        ctx.restore();
        speedTimer--;
        if (speedTimer <= 0) speedActive = false;
    }
    player.draw();

    // 敌人AI
    enemies.forEach((enemy, idx) => {
        if (!enemy.alive) return;
        enemy.update();
        if (frameCount % 60 === 0) {
            enemy.dir = Math.floor(Math.random() * 4);
        }
        switch(enemy.dir) {
            case 0: enemy.move(0, -ENEMY_SPEED); break;
            case 1: enemy.move(ENEMY_SPEED, 0); break;
            case 2: enemy.move(0, ENEMY_SPEED); break;
            case 3: enemy.move(-ENEMY_SPEED, 0); break;
        }
        if (frameCount % ENEMY_FIRE_INTERVAL === 0) {
            enemy.fire();
        }
        enemy.draw();
    });

    bullets.forEach(bullet => bullet.update());
    bullets = bullets.filter(bullet => bullet.alive);
    bullets.forEach(bullet => bullet.draw());

    // 碰撞检测
    bullets.forEach(bullet => {
        if (!bullet.alive) return;
        if (bullet.fromPlayer) {
            enemies.forEach((enemy, idx) => {
                if (enemy.alive && rectsIntersect(bullet, enemy)) {
                    enemy.alive = false;
                    bullet.alive = false;
                    gold += 5;
                    updateGoldDisplay();
                    enemiesDefeated++;
                    updateProgressDisplay();
                    // 敌人被击败后立即刷新
                    setTimeout(() => {
                        enemies[idx] = new Tank(Math.random() * (WIDTH - TANK_SIZE), 50, '#f00');
                    }, 400);
                    if (enemiesDefeated >= enemiesToWin) {
                        showGameOverPanel('胜利！');
                        gameState = 'over';
                        return;
                    }
                }
            });
        } else {
            if (player.alive && rectsIntersect(bullet, player)) {
                if (!shieldActive) {
                    playerHP--;
                    bullet.alive = false;
                    updateHPDisplay();
                    if (playerHP <= 0) {
                        player.alive = false;
                    }
                } else {
                    bullet.alive = false;
                }
            }
        }
    });

    // 随机生成道具
    if (frameCount % 600 === 0) {
        spawnRandomItem();
    }

    if (!player.alive) {
        showGameOverPanel('游戏失败');
        gameState = 'over';
        return;
    }

    frameCount++;
    requestAnimationFrame(gameLoop);
}

function updateGoldDisplay() {
    const goldDisplay = document.getElementById('goldDisplay');
    if (goldDisplay) goldDisplay.textContent = '金币：' + gold;
}

function updateHPDisplay() {
    const hpDisplay = document.getElementById('hpDisplay');
    if (hpDisplay) hpDisplay.textContent = '生命：' + playerHP;
}

function updateProgressDisplay() {
    const progressDisplay = document.getElementById('progressDisplay');
    if (progressDisplay) progressDisplay.textContent = '进度：' + enemiesDefeated + '/' + enemiesToWin;
}

// --- 商城逻辑 ---
window.addEventListener('DOMContentLoaded', () => {
    const welcome = document.getElementById('welcomeMask');
    const okBtn = document.getElementById('welcomeOkBtn');
    if (welcome && okBtn) {
        okBtn.onclick = () => {
            welcome.classList.add('hide');
            setTimeout(() => {
                welcome.remove();
                initGame();
                gameLoop();
            }, 800);
        };
    } else {
        // 如果没有欢迎动画，直接开始
        initGame();
        gameLoop();
    }
    // 添加暂停按钮事件
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) {
        pauseBtn.onclick = () => {
            pause = !pause;
            pauseBtn.textContent = pause ? '继续' : '暂停';
            if (!pause) requestAnimationFrame(gameLoop);
        };
    }
    // 商城按钮
    const shopBtn = document.getElementById('shopBtn');
    const shopPanel = document.getElementById('shopPanel');
    if (shopBtn && shopPanel) {
        shopBtn.onclick = () => {
            renderShopPanel();
            shopPanel.classList.remove('hidden');
            shopOpen = true;
            pause = true;
        };
    }
});
function renderShopPanel() {
    const shopPanel = document.getElementById('shopPanel');
    if (!shopPanel) return;
    let html = '<div class="shop-title">商城</div>';
    html += '<div class="shop-section"><b>道具</b>';
    availableItems.forEach(item => {
        html += `<div class="shop-item"><span class="item-name">${item.name}</span><span class="item-price">${item.price}金币</span><button class="item-btn" onclick="window.buyItem('${item.type}')">购买</button></div>`;
    });
    html += '</div>';
    html += '<div class="shop-section"><b>皮肤</b>';
    availableSkins.forEach(skin => {
        html += `<div class="shop-item"><span class="item-name">${skin.name}</span><span class="item-price">${skin.price}金币</span>`;
        if (ownedSkins.includes(skin.id)) {
            html += `<button class="item-btn" onclick="window.useSkin('${skin.id}')">使用</button>`;
        } else {
            html += `<button class="item-btn" onclick="window.buySkin('${skin.id}')">购买</button>`;
        }
        html += '</div>';
    });
    html += '</div>';
    html += '<button class="close-btn" onclick="window.closeShop()">关闭</button>';
    shopPanel.innerHTML = html;
}
window.buyItem = function(type) {
    const item = availableItems.find(i => i.type === type);
    if (!item) return;
    if (gold < item.price) { alert('金币不足'); return; }
    gold -= item.price;
    updateGoldDisplay();
    // 立即生效
    if (type === 'shield') { shieldActive = true; shieldTimer = 300; }
    if (type === 'heal') { playerHP = Math.min(playerHP + 1, 3); healActive = true; updateHPDisplay(); }
    if (type === 'speed') { speedActive = true; speedTimer = 240; }
    alert('购买成功，已生效！');
};
window.buySkin = function(skinId) {
    const skin = availableSkins.find(s => s.id === skinId);
    if (!skin) return;
    if (ownedSkins.includes(skinId)) return;
    if (gold < skin.price) { alert('金币不足'); return; }
    gold -= skin.price;
    ownedSkins.push(skinId);
    updateGoldDisplay();
    renderShopPanel();
    alert('皮肤购买成功！');
};
window.useSkin = function(skinId) {
    if (!ownedSkins.includes(skinId)) return;
    currentSkin = skinId;
    player.color = getSkinColor(skinId);
    renderShopPanel();
};
window.closeShop = function() {
    const shopPanel = document.getElementById('shopPanel');
    if (shopPanel) shopPanel.classList.add('hidden');
    shopOpen = false;
    pause = false;
    const pauseBtn = document.getElementById('pauseBtn');
    if (pauseBtn) pauseBtn.textContent = '暂停';
    requestAnimationFrame(gameLoop);
}; 
