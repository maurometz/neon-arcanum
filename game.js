document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');

    // --- Elementos da UI ---
    const ui = {
        healthBar: document.getElementById('health-bar'),
        healthText: document.getElementById('health-text'),
        xpBar: document.getElementById('xp-bar'),
        xpText: document.getElementById('xp-text'),
        weaponIcons: document.getElementById('weapon-icons'),
        passiveIcons: document.getElementById('passive-icons'),
        globalTooltip: document.getElementById('global-tooltip'),
        timer: document.getElementById('timer'),
        startScreen: document.getElementById('start-screen'),
        levelUpScreen: document.getElementById('level-up-screen'),
        gameOverScreen: document.getElementById('game-over-screen'),
        upgradeOptions: document.getElementById('upgrade-options'),
        startButton: document.getElementById('start-button'),
        restartButton: document.getElementById('restart-button'),
        finalTime: document.getElementById('final-time'),
        weaponSelectScreen: document.getElementById('weapon-select-screen'),
        weaponOptions: document.getElementById('weapon-options'),
    };

    // --- Carregamento de Sprites ---
    const playerSprite = new Image();
    playerSprite.src = 'ayla.png'; 
    let playerSpriteLoaded = false;
    playerSprite.onload = () => { playerSpriteLoaded = true; };
    playerSprite.onerror = () => { console.error("Erro ao carregar a sprite 'ayla.png'."); };
    const PLAYER_SPRITE_WIDTH = 64;
    const PLAYER_SPRITE_HEIGHT = 64;

    const enemySpritePaths = ['Rob.png', 'TechnoGhost.png', 'EtherealSpider.png', 'LogicGhost.png'];
    const enemySprites = [];
    enemySpritePaths.forEach(path => {
        const sprite = new Image();
        sprite.src = path;
        sprite.onerror = () => { console.error(`Erro ao carregar a sprite '${path}'.`); };
        enemySprites.push(sprite);
    });
    const ENEMY_SPRITE_SIZE = 64;

    const weaponIconMap = {
        dronelamina: 'Dronelamina.png',
        esporosSintagma: 'Sintagma.png',
        estilhacoDados: 'EstilhacoDeDados.png',
        runasOrbitais: 'RunasOrbitais.png',
        circuitoSangue: 'CircuitoDeSangue.png',
        missilEspelhado: 'MissilEspelhado.png',
        noFantasma: 'NoFantasma.png',
        lanternaDados: 'LanternaDeDados.png',
        relampagoSelo: 'RelampagoDeSelo.png',
        ferroadaAlgoritmo: 'FerroadaDeAlgoritmo.png',
        circuitoExpurgo: 'CircuitoDeExpurgo.png',
    };

    const weaponIcons = {};
    Object.keys(weaponIconMap).forEach(id => {
        const icon = new Image();
        icon.src = weaponIconMap[id];
        weaponIcons[id] = icon;
    });


    let gameRunning = false;
    let gamePaused = false;
    let gameTime = 0;
    
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    let player, enemies = [], projectiles = [], xpOrbs = [], activeEffects = [], damageNumbers = [];
    let keys = {}, enemySpawnTimer = 0, difficultyTimer = 0;

    function resetPlayerStats() {
        player = {
            x: canvas.width / 2, y: canvas.height / 2, radius: 25,
            health: 100, maxHealth: 100, moveSpeed: 3, firewall: 0,
            forcaFisica: 1, sinapse: 1, fluxoArcanet: 1, codificacao: 1, resolucao: 1,
            level: 1, xp: 0, xpToNextLevel: 10,
            isOverclocked: false, overclockEndTime: 0,
            speedBurstEndTime: 0,
            dodgeChance: 0,
            projectileCountMultiplier: 1,
            hasRevived: false,
            weapons: [],
            passives: {},
        };
    }
    
    // --- Definições de Armas e Poderes ---
    const weaponDefinitions = {
        dronelamina: { name: 'Dronelâmina', description: 'Drone orbital que dispara pulsos arcanos no inimigo mais próximo.', baseCooldown: 1, attack: (p, weapon) => { const target = findNearestEnemy(p.x, p.y); if (!target) return; const droneX = p.x + Math.cos(weapon.angle) * 40; const droneY = p.y + Math.sin(weapon.angle) * 40; const angleToTarget = Math.atan2(target.y - droneY, target.x - droneX); projectiles.push({ type: 'bullet', x: droneX, y: droneY, radius: 5, color: '#ff00ff', dx: Math.cos(angleToTarget) * 5 * p.resolucao, dy: Math.sin(angleToTarget) * 5 * p.resolucao, damage: 10 * p.forcaFisica, lifetime: 120, source: 'dronelamina' }); }, update: (p, weapon, dt) => { weapon.angle = (weapon.angle || 0) + 5 * dt; } },
        esporosSintagma: { name: 'Esporos de Sintagma', description: 'Lança esferas lentas que explodem em fragmentos.', baseCooldown: 2.5, attack: (p, weapon) => { const target = findNearestEnemy(p.x, p.y, 800); const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.random() * Math.PI * 2; projectiles.push({ type: 'spore', x: p.x, y: p.y, radius: 12, color: '#a8ffbe', dx: Math.cos(angle) * 2, dy: Math.sin(angle) * 2, damage: 20 * p.codificacao, lifetime: 120, source: 'esporosSintagma', level: weapon.level }); } },
        estilhacoDados: { name: 'Estilhaço de Dados', description: 'Dispara um cone frontal de projéteis curtos e dispersos.', baseCooldown: 1.5, attack: (p, weapon) => { const target = findNearestEnemy(p.x, p.y, 400); const angleToTarget = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.random() * Math.PI * 2; for (let i = 0; i < (5 + weapon.level) * p.projectileCountMultiplier; i++) { const angle = angleToTarget + (Math.random() - 0.5) * 0.5; projectiles.push({ type: 'bullet', x: p.x, y: p.y, radius: 4, color: '#ff5733', dx: Math.cos(angle) * 7 * p.resolucao, dy: Math.sin(angle) * 7 * p.resolucao, damage: 7 * p.forcaFisica, lifetime: 30, source: 'estilhacoDados' }); } } },
        runasOrbitais: { name: 'Runas Orbitais', description: 'Runas flutuantes causam dano por toque. Disparam feitiços.', baseCooldown: 2, attack: (p, weapon) => { const target = findNearestEnemy(p.x, p.y); if(!target) return; const runeIndex = Math.floor(Math.random() * weapon.runeCount); const runeAngle = (Math.PI * 2 / weapon.runeCount) * runeIndex + weapon.angle; const runeX = p.x + Math.cos(runeAngle) * weapon.distance; const runeY = p.y + Math.sin(runeAngle) * weapon.distance; const angleToTarget = Math.atan2(target.y - runeY, target.x - runeX); projectiles.push({ type: 'bullet', x: runeX, y: runeY, radius: 6, color: '#ffff00', dx: Math.cos(angleToTarget) * 6, dy: Math.sin(angleToTarget) * 6, damage: 15 * p.codificacao, lifetime: 80, source: 'runasOrbitais' }); }, update: (p, weapon, dt) => { weapon.angle = (weapon.angle || 0) + 1 * dt; weapon.distance = 60 * p.fluxoArcanet; weapon.runeCount = 3 + weapon.level; enemies.forEach(enemy => { if (Math.hypot(p.x - enemy.x, p.y - enemy.y) < weapon.distance + enemy.radius) { dealDamage(enemy, 5 * p.codificacao * dt, 'runasOrbitais'); } }); } },
        circuitoSangue: { name: 'Circuito de Sangue', description: 'Feixe contínuo que segue o inimigo mais próximo e cura o jogador.', baseCooldown: 0, attack: (p, weapon) => {}, update: (p, weapon, dt) => {
            if(!weapon.target || weapon.target.health <= 0 || Math.hypot(p.x - weapon.target.x, p.y - weapon.target.y) > 600) {
                weapon.target = findNearestEnemy(p.x, p.y, 600);
            }
            if (weapon.target) {
                const damage = (15 * p.sinapse) * dt;
                dealDamage(weapon.target, damage, 'circuitoSangue');
                
                weapon.damageDealt = (weapon.damageDealt || 0) + damage;
                weapon.healTimer = (weapon.healTimer || 0) + dt;

                if (weapon.healTimer >= 3) {
                    const healingAmount = weapon.damageDealt * 0.05;
                    p.health = Math.min(p.maxHealth, p.health + healingAmount);
                    weapon.damageDealt = 0;
                    weapon.healTimer = 0;
                }
                activeEffects.push({ type: 'beam', from: p, to: weapon.target, color: 'red', lifetime: 2 });
            }
        }},
        missilEspelhado: { name: 'Míssil Espelhado', description: 'Lança um míssil que ricocheteia entre inimigos.', baseCooldown: 3, attack: (p, weapon) => { const target = findNearestEnemy(p.x, p.y); if(!target) return; const angle = Math.atan2(target.y - p.y, target.x - p.x); const speed = 4 * p.resolucao; projectiles.push({ type: 'missile', x: p.x, y: p.y, radius: 8, color: '#9d00ff', speed: speed, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, damage: 25 * p.codificacao, lifetime: 300, source: 'missilEspelhado', bounces: 3 + weapon.level, bouncedFrom: [] }); } },
        noFantasma: { name: 'Nó Fantasma', description: 'Um espectro digital surge e persegue o inimigo mais próximo.', baseCooldown: 5, attack: (p, weapon) => { const target = findNearestEnemy(p.x, p.y); if (!target) return; activeEffects.push({ type: 'ghost', x: p.x, y: p.y, target: target, lifetime: 300, damage: 20 * p.codificacao, speed: 2, level: weapon.level, color: `hsla(275, 100%, 70%, 0.7)` }); } },
        lanternaDados: { name: 'Lanterna de Dados', description: 'Dispara um feixe constante que penetra todos os inimigos.', baseCooldown: 2, attack: (p, weapon) => { const target = findNearestEnemy(p.x, p.y); const angle = target ? Math.atan2(target.y - p.y, target.x - p.x) : Math.random() * Math.PI * 2; activeEffects.push({ type: 'piercing_beam', x: p.x, y: p.y, angle: angle, lifetime: 30, damage: 10 * p.resolucao, level: weapon.level, width: 10, hitEnemies: [] }); } },
        relampagoSelo: { name: 'Relâmpago de Selo', description: 'Raios caem do céu aleatoriamente próximos ao jogador.', baseCooldown: 1.5, attack: (p, weapon) => { for (let i = 0; i < weapon.level; i++) { const angle = Math.random() * Math.PI * 2; const distance = Math.random() * 250 * p.fluxoArcanet; const x = p.x + Math.cos(angle) * distance; const y = p.y + Math.sin(angle) * distance; activeEffects.push({ type: 'lightning_strike', x: x, y: y, lifetime: 40, warningTime: 30, damage: 30 * p.codificacao }); } } },
        ferroadaAlgoritmo: { name: 'Ferroada de Algoritmo', description: 'Projéteis teleguiados que perfuram até dois inimigos.', baseCooldown: 1, attack: (p, weapon) => { const target = findNearestEnemy(p.x, p.y); if (!target) return; const angle = Math.atan2(target.y - p.y, target.x - p.x); const speed = 5 * p.resolucao; projectiles.push({ type: 'homing_piercing', x: p.x, y: p.y, radius: 6, color: '#00e5e5', target: target, speed: speed, dx: Math.cos(angle) * speed, dy: Math.sin(angle) * speed, damage: 12 * p.codificacao, lifetime: 240, source: 'ferroadaAlgoritmo', pierceLeft: 2 + weapon.level, turnSpeed: 0.1, hitEnemies: [] }); } },
        circuitoExpurgo: { name: 'Circuito de Expurgo', description: 'Libera pulsos de energia circular a cada 3 segundos.', baseCooldown: 3, attack: (p, weapon) => { activeEffects.push({ type: 'purge_pulse', x: p.x, y: p.y, maxRadius: 100 * p.fluxoArcanet, lifetime: 20, damage: 15 * p.forcaFisica, level: weapon.level }); } },
    };
    const allUpgrades = [
        { id: 'esporosSintagma', type: 'weapon', title: 'Adquirir: Esporos de Sintagma', description: weaponDefinitions.esporosSintagma.description }, { id: 'estilhacoDados', type: 'weapon', title: 'Adquirir: Estilhaço de Dados', description: weaponDefinitions.estilhacoDados.description }, { id: 'runasOrbitais', type: 'weapon', title: 'Adquirir: Runas Orbitais', description: weaponDefinitions.runasOrbitais.description }, { id: 'circuitoSangue', type: 'weapon', title: 'Adquirir: Circuito de Sangue', description: weaponDefinitions.circuitoSangue.description }, { id: 'missilEspelhado', type: 'weapon', title: 'Adquirir: Míssil Espelhado', description: weaponDefinitions.missilEspelhado.description }, { id: 'noFantasma', type: 'weapon', title: 'Adquirir: Nó Fantasma', description: weaponDefinitions.noFantasma.description }, { id: 'lanternaDados', type: 'weapon', title: 'Adquirir: Lanterna de Dados', description: weaponDefinitions.lanternaDados.description }, { id: 'relampagoSelo', type: 'weapon', title: 'Adquirir: Relâmpago de Selo', description: weaponDefinitions.relampagoSelo.description }, { id: 'ferroadaAlgoritmo', type: 'weapon', title: 'Adquirir: Ferroada de Algoritmo', description: weaponDefinitions.ferroadaAlgoritmo.description }, { id: 'circuitoExpurgo', type: 'weapon', title: 'Adquirir: Circuito de Expurgo', description: weaponDefinitions.circuitoExpurgo.description },
        { id: 'hp', type: 'stat', title: 'Integridade++', description: 'Aumenta a vida máxima em 25.', apply: p => p.maxHealth += 25 }, { id: 'speed', type: 'stat', title: 'Sinapse Rápida', description: 'Aumenta a velocidade de movimento em 10%.', apply: p => p.moveSpeed *= 1.10 }, { id: 'forcaFisica', type: 'stat', title: 'Força Física Ampliada', description: 'Aumenta o dano de ataques físicos em 15%.', apply: p => p.forcaFisica *= 1.15 }, { id: 'codificacao', type: 'stat', title: 'Glitch Instável', description: 'Aumenta o dano de ataques arcanos/mágicos em 15%.', apply: p => p.codificacao *= 1.15 }, { id: 'fluxoArcanet', type: 'stat', title: 'Fluxo Arcanet Expansivo', description: 'Aumenta a área de efeito e coleta em 15%.', apply: p => p.fluxoArcanet *= 1.15 },
        { id: 'canalizacaoSombria', type: 'passive', title: 'Passivo: Canalização Sombria', description: 'A cada 10s, recupera 5% da vida máxima.', apply: (p) => p.passives.canalizacaoSombria = { timer: 10, title: 'Canalização Sombria', description: 'A cada 10s, recupera 5% da vida máxima.' } }, { id: 'anomaliaBinaria', type: 'passive', title: 'Passivo: Anomalia Binária', description: 'Abaixo de 25% de vida, causa uma explosão massiva (CD: 60s).', apply: (p) => p.passives.anomaliaBinaria = { cooldown: 0, title: 'Anomalia Binária', description: 'Abaixo de 25% de vida, causa uma explosão massiva (CD: 60s).' } }, { id: 'picoOverclock', type: 'passive', title: 'Passivo: Pico de Overclock', description: 'A cada 15s, dobra a cadência de tiro por 3s.', apply: (p) => p.passives.picoOverclock = { timer: 15, title: 'Pico de Overclock', description: 'A cada 15s, dobra a cadência de tiro por 3s.' } }, { id: 'nanoDesfragmentacao', type: 'passive', title: 'Passivo: Nano-Desfragmentação', description: 'Coletar XP restaura 2 de vida.', apply: (p) => p.passives.nanoDesfragmentacao = { title: 'Nano-Desfragmentação', description: 'Coletar XP restaura 2 de vida.' } }, { id: 'interferenciaDimensional', type: 'passive', title: 'Passivo: Interferência Dimensional', description: '5% de chance por ataque de criar uma fenda que atrai inimigos.', apply: (p) => p.passives.interferenciaDimensional = { title: 'Interferência Dimensional', description: '5% de chance por ataque de criar uma fenda que atrai inimigos.' } }, { id: 'cascaSilicio', type: 'passive', title: 'Passivo: Casca de Silício', description: 'A cada 20s, gera um escudo que absorve 50 de dano.', apply: (p) => p.passives.cascaSilicio = { timer: 0, shieldHealth: 0, maxShield: 50, cooldown: 20, title: 'Casca de Silício', description: 'A cada 20s, gera um escudo que absorve 50 de dano.' } }, { id: 'injetoresCineticos', type: 'passive', title: 'Passivo: Injetores Cinéticos', description: 'Coletar XP concede um grande bônus de velocidade por 2s.', apply: (p) => p.passives.injetoresCineticos = { title: 'Injetores Cinéticos', description: 'Coletar XP concede um grande bônus de velocidade por 2s.' } },
        { id: 'backupEspiritual', type: 'passive', title: 'Passivo: Backup Espiritual', description: 'Ao morrer pela primeira vez, revive com 30% da vida.', req: (p) => p.maxHealth > 150 || p.level >= 15, apply: (p) => p.passives.backupEspiritual = { title: 'Backup Espiritual', description: 'Ao morrer pela primeira vez, revive com 30% da vida.' } }, { id: 'discoExpansao', type: 'passive', title: 'Passivo: Disco de Expansão', description: 'Aumenta em 25% o número de projéteis de armas.', apply: (p) => { p.projectileCountMultiplier += 0.25; p.passives.discoExpansao = { title: 'Disco de Expansão', description: 'Aumenta em 25% o número de projéteis de armas.' }; } }, { id: 'reflexoNeural', type: 'passive', title: 'Passivo: Reflexo Neural', description: '+15% de chance de desviar de ataques.', apply: (p) => { p.dodgeChance += 0.15; p.passives.reflexoNeural = { title: 'Reflexo Neural', description: '+15% de chance de desviar de ataques.' }; } }, { id: 'codigoRedundante', type: 'passive', title: 'Passivo: Código Redundante', description: 'A cada 4s, repele inimigos próximos com uma onda de dados.', apply: (p) => p.passives.codigoRedundante = { timer: 4, title: 'Código Redundante', description: 'A cada 4s, repele inimigos próximos com uma onda de dados.' } }, { id: 'magnetismoArcano', type: 'passive', title: 'Passivo: Magnetismo Arcano', description: 'Aumenta a área de coleta de XP em 50%.', apply: (p) => { p.fluxoArcanet *= 1.5; p.passives.magnetismoArcano = { title: 'Magnetismo Arcano', description: 'Aumenta a área de coleta de XP em 50%.' }; } },
    ];
    
    function addWeapon(id) { const definition = weaponDefinitions[id]; if (definition) { player.weapons.push({ id: id, level: 1, cooldown: 0, ...definition }); } }
    function upgradeWeapon(id) { const weapon = player.weapons.find(w => w.id === id); if (weapon) { weapon.level++; weapon.baseCooldown *= 0.9; } }

    function applyUpgrade(upgrade) {
        if (upgrade.apply) {
            upgrade.apply(player);
        } else if (upgrade.type === 'weapon') {
            const existing = player.weapons.find(w => w.id === upgrade.id);
            if (existing) {
                upgradeWeapon(upgrade.id);
            } else {
                addWeapon(upgrade.id);
            }
        }
        updatePowerupsUI();
        ui.levelUpScreen.style.display = 'none';
        gamePaused = false;
        requestAnimationFrame(gameLoop);
    }

    function getUpgradeChoices() {
        const canGetNewWeapon = player.weapons.length < 3;
        const canGetNewPassive = Object.keys(player.passives).length < 3;

        const weaponUpgrades = [];
        player.weapons.forEach(w => {
            if (w.level < 5) {
                weaponUpgrades.push({ id: w.id, type: 'weapon', title: `Melhorar: ${w.name} Nv.${w.level + 1}`, description: `Aumenta a eficácia de ${w.name}.`, apply: () => upgradeWeapon(w.id) });
            }
        });

        const availableNewPassivesAndStats = allUpgrades.filter(u => {
            if (u.type === 'passive') {
                if (!canGetNewPassive || player.passives[u.id]) return false;
                if (u.req && !u.req(player)) return false;
                return true;
            }
            return u.type === 'stat';
        });
        
        const availableNewWeapons = allUpgrades.filter(u => u.type === 'weapon' && canGetNewWeapon && !player.weapons.some(w => w.id === u.id));

        const pool = [...weaponUpgrades, ...availableNewPassivesAndStats, ...availableNewWeapons];
        const choices = [];
        while (choices.length < 3 && pool.length > 0) {
            const randomIndex = Math.floor(Math.random() * pool.length);
            choices.push(pool.splice(randomIndex, 1)[0]);
        }
        return choices;
    }

    function showLevelUpScreen() { gamePaused = true; const choices = getUpgradeChoices(); ui.upgradeOptions.innerHTML = ''; choices.forEach(upgrade => { const card = document.createElement('div'); card.className = 'upgrade-card'; card.innerHTML = `<h3>${upgrade.title}</h3><p>${upgrade.description}</p>`; card.onclick = () => applyUpgrade(upgrade); ui.upgradeOptions.appendChild(card); }); ui.levelUpScreen.style.display = 'flex'; }

    function checkLevelUp() {
        if (player.xp >= player.xpToNextLevel) {
            player.level++;
            player.xp -= player.xpToNextLevel;
            player.xpToNextLevel = Math.floor(player.xpToNextLevel * 1.5);
            player.health = Math.min(player.maxHealth, player.health + player.health * 0.5);
            showLevelUpScreen();
        }
    }
    
    function createDamageNumber(value, x, y) { if (typeof value === 'string') { damageNumbers.push({ value: value, x: x, y: y, lifetime: 60, alpha: 1, color: '#00ffff' }); return; } const damage = Math.ceil(value); if (damage <= 0) return; damageNumbers.push({ value: damage, x: x + (Math.random() - 0.5) * 20, y: y, lifetime: 60, alpha: 1, color: 'white' }); }
    
    function dealDamage(target, amount, source) {
        if (target.health <= 0) return;
        if (target === player && Math.random() < player.dodgeChance) { createDamageNumber("Esquiva!", target.x, target.y); return; }
        target.killedBy = source;
        if (target === player && player.passives.cascaSilicio && player.passives.cascaSilicio.shieldHealth > 0) {
            const absorbed = Math.min(player.passives.cascaSilicio.shieldHealth, amount);
            player.passives.cascaSilicio.shieldHealth -= absorbed;
            amount -= absorbed;
            if (absorbed > 0) createDamageNumber(`Absorvido: ${Math.ceil(absorbed)}`, target.x, target.y);
        }
        target.health -= amount;
        if(amount > 0 && target !== player) createDamageNumber(amount, target.x, target.y);
    }
    
    function updatePowerupsUI() {
        ui.weaponIcons.innerHTML = '';
        ui.passiveIcons.innerHTML = '';
        
        player.weapons.forEach(weapon => {
            const iconContainer = document.createElement('div');
            iconContainer.className = 'powerup-icon';
            
            const iconImage = weaponIcons[weapon.id];
            if (iconImage) {
                iconContainer.appendChild(iconImage.cloneNode());
            }

            iconContainer.addEventListener('mouseenter', () => {
                const levelText = weapon.level ? ` (Nv. ${weapon.level})` : '';
                ui.globalTooltip.innerHTML = `<h4>${weapon.name}${levelText}</h4><p>${weapon.description}</p>`;
                ui.globalTooltip.style.display = 'block';
            });
            iconContainer.addEventListener('mouseleave', () => { ui.globalTooltip.style.display = 'none'; });
            ui.weaponIcons.appendChild(iconContainer);
        });

        Object.values(player.passives).forEach(passive => {
            if (!passive.title) return;
            const iconContainer = document.createElement('div');
            iconContainer.className = 'powerup-icon';
            
            const iconText = document.createElement('span');
            iconText.textContent = passive.title.substring(0, 2).toUpperCase();
            iconContainer.appendChild(iconText);

            iconContainer.addEventListener('mouseenter', () => {
                ui.globalTooltip.innerHTML = `<h4>${passive.title}</h4><p>${passive.description}</p>`;
                ui.globalTooltip.style.display = 'block';
            });
            iconContainer.addEventListener('mouseleave', () => { ui.globalTooltip.style.display = 'none'; });
            ui.passiveIcons.appendChild(iconContainer);
        });
    }

    function updatePlayer(deltaTime) {
        if (gamePaused) return;
        let currentMoveSpeed = player.moveSpeed;
        if (gameTime < player.speedBurstEndTime) { currentMoveSpeed *= 2.5; }
        let dx = 0, dy = 0;
        if (keys['w'] || keys['ArrowUp']) dy -= 1; if (keys['s'] || keys['ArrowDown']) dy += 1;
        if (keys['a'] || keys['ArrowLeft']) dx -= 1; if (keys['d'] || keys['ArrowRight']) dx += 1;
        if (dx !== 0 || dy !== 0) { const length = Math.sqrt(dx * dx + dy * dy); player.x += (dx / length) * currentMoveSpeed; player.y += (dy / length) * currentMoveSpeed; }
        player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
        player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));
        const attackSpeedMultiplier = (player.isOverclocked ? 2 : 1) * player.sinapse;
        player.weapons.forEach(weapon => {
            weapon.cooldown = (weapon.cooldown || 0) - deltaTime;
            if (weapon.cooldown <= 0) { weapon.attack(player, weapon); if (weapon.baseCooldown > 0) weapon.cooldown = weapon.baseCooldown / attackSpeedMultiplier; }
            if (weapon.update) weapon.update(player, weapon, deltaTime);
        });
        updatePassives(deltaTime);
    }
    
    function updatePassives(deltaTime) {
        if(player.passives.picoOverclock){ player.passives.picoOverclock.timer -= deltaTime; if(player.passives.picoOverclock.timer <= 0) { player.isOverclocked = true; player.overclockEndTime = gameTime + 3; player.passives.picoOverclock.timer = 15; } }
        if(player.isOverclocked && gameTime > player.overclockEndTime) player.isOverclocked = false;
        if(player.passives.canalizacaoSombria && player.health < player.maxHealth) { player.passives.canalizacaoSombria.timer -= deltaTime; if(player.passives.canalizacaoSombria.timer <= 0) { player.health = Math.min(player.maxHealth, player.health + player.maxHealth * 0.05); player.passives.canalizacaoSombria.timer = 10; activeEffects.push({ type: 'heal', x: player.x, y: player.y, radius: player.radius, lifetime: 30 }); } }
        if(player.passives.anomaliaBinaria) { player.passives.anomaliaBinaria.cooldown -= deltaTime; if(player.health <= player.maxHealth * 0.25 && player.passives.anomaliaBinaria.cooldown <= 0) { activeEffects.push({ type: 'explosion', x: player.x, y: player.y, radius: 250 * player.fluxoArcanet, damage: 200 * player.codificacao, lifetime: 20 }); enemies.forEach(enemy => { const dist = Math.hypot(player.x - enemy.x, player.y - enemy.y); if (dist < 250 * player.fluxoArcanet) { const angle = Math.atan2(enemy.y - player.y, enemy.x - player.x); enemy.x += Math.cos(angle) * 100; enemy.y += Math.sin(angle) * 100; } }); player.passives.anomaliaBinaria.cooldown = 60; } }
        if (player.passives.cascaSilicio) { const shell = player.passives.cascaSilicio; shell.timer -= deltaTime; if (shell.timer <= 0 && shell.shieldHealth <= 0) { shell.shieldHealth = shell.maxShield; shell.timer = shell.cooldown; } }
        if (player.passives.codigoRedundante) { player.passives.codigoRedundante.timer -= deltaTime; if (player.passives.codigoRedundante.timer <= 0) { activeEffects.push({ type: 'knockback_pulse', x: player.x, y: player.y, maxRadius: 150, lifetime: 10 }); player.passives.codigoRedundante.timer = 4; } }
    }

    function spawnEnemy() { const side = Math.floor(Math.random() * 4); let x, y; if (side === 0) { x = Math.random() * canvas.width; y = -ENEMY_SPRITE_SIZE; } else if (side === 1) { x = canvas.width + ENEMY_SPRITE_SIZE; y = Math.random() * canvas.height; } else if (side === 2) { x = Math.random() * canvas.width; y = canvas.height + ENEMY_SPRITE_SIZE; } else { x = -ENEMY_SPRITE_SIZE; y = Math.random() * canvas.height; } const randomSprite = enemySprites[Math.floor(Math.random() * enemySprites.length)]; enemies.push({ x, y, radius: 28, sprite: randomSprite, speed: 1.2, health: 8 + (difficultyTimer / 8), damage: 10, slowUntil: 0, confusionUntil: 0 }); }
    function findNearestEnemy(fromX, fromY, maxRange = Infinity, excludeList = []) { let nearest = null; let minDist = maxRange * maxRange; enemies.forEach(enemy => { if (enemy.health <= 0 || excludeList.includes(enemy)) return; const distSq = (fromX - enemy.x) ** 2 + (fromY - enemy.y) ** 2; if (distSq < minDist) { minDist = distSq; nearest = enemy; } }); return nearest; }
    function handleEnemyDeath(enemy, index) { if (enemy.killedBy === 'estilhacoDados') { if (Math.random() < 0.25) { activeEffects.push({ type: 'explosion', x: enemy.x, y: enemy.y, radius: 75 * player.fluxoArcanet, damage: 20 * player.forcaFisica, lifetime: 15 }); } } xpOrbs.push({ x: enemy.x, y: enemy.y, radius: 6, value: Math.ceil(1 + difficultyTimer / 30) }); enemies.splice(index, 1); }
    
    function updateEntities(deltaTime) {
        if (gamePaused) return;
        enemies.forEach((enemy, index) => { if (enemy.health <= 0) { handleEnemyDeath(enemy, index); return; } let targetX = player.x, targetY = player.y; let currentSpeed = enemy.speed; if (gameTime < enemy.confusionUntil) { if (!enemy.randomDir) enemy.randomDir = { x: (Math.random() - 0.5) * 2, y: (Math.random() - 0.5) * 2 }; enemy.x += enemy.randomDir.x * currentSpeed; enemy.y += enemy.randomDir.y * currentSpeed; } else { enemy.randomDir = null; const dx = targetX - enemy.x, dy = targetY - enemy.y; const distance = Math.hypot(dx, dy); if (gameTime < enemy.slowUntil) currentSpeed *= 0.5; if (distance > 1) { enemy.x += (dx / distance) * currentSpeed; enemy.y += (dy / distance) * currentSpeed; } } const playerDist = Math.hypot(player.x - enemy.x, player.y - enemy.y); if (playerDist < player.radius + enemy.radius) { dealDamage(player, enemy.damage, 'collision'); enemies.splice(index, 1); } });
        
        for (let pIndex = projectiles.length - 1; pIndex >= 0; pIndex--) {
            const p = projectiles[pIndex];
            
            if (p.type === 'missile' || p.type === 'homing_piercing') {
                if (!p.target || p.target.health <= 0) {
                    p.target = findNearestEnemy(p.x, p.y, 1000, p.bouncedFrom || p.hitEnemies);
                }
                if (p.target) {
                    const angle = Math.atan2(p.target.y - p.y, p.target.x - p.x);
                    const targetDx = Math.cos(angle) * p.speed;
                    const targetDy = Math.sin(angle) * p.speed;
                    p.dx += (targetDx - p.dx) * (p.turnSpeed || 0.1);
                    p.dy += (targetDy - p.dy) * (p.turnSpeed || 0.1);
                    const currentSpeed = Math.hypot(p.dx, p.dy);
                    p.dx = (p.dx / currentSpeed) * p.speed;
                    p.dy = (p.dy / currentSpeed) * p.speed;
                }
            }
            p.x += p.dx;
            p.y += p.dy;
            p.lifetime--;

            if (p.lifetime <= 0 || p.x < -10 || p.x > canvas.width + 10 || p.y < -10 || p.y > canvas.height + 10) {
                if (p.type === 'spore') {
                    activeEffects.push({ type: 'spore_explosion', x: p.x, y: p.y, damage: p.damage, level: p.level });
                }
                projectiles.splice(pIndex, 1);
                continue;
            }

            for (let i = enemies.length - 1; i >= 0; i--) {
                const enemy = enemies[i];
                if (Math.hypot(p.x - enemy.x, p.y - enemy.y) < p.radius + enemy.radius) {
                    if (p.hitEnemies && p.hitEnemies.includes(enemy)) continue;
                    
                    dealDamage(enemy, p.damage, p.source);

                    if (p.type === 'spore') {
                        activeEffects.push({ type: 'spore_explosion', x: p.x, y: p.y, damage: p.damage, level: p.level });
                        projectiles.splice(pIndex, 1);
                        break;
                    } else if (p.type === 'missile') {
                        p.bounces--;
                        p.damage *= 1.15;
                        p.bouncedFrom.push(enemy);
                        if (p.bounces >= 0) {
                            p.target = findNearestEnemy(p.x, p.y, Infinity, p.bouncedFrom);
                            if (!p.target) projectiles.splice(pIndex, 1);
                        } else {
                            projectiles.splice(pIndex, 1);
                        }
                        break;
                    } else if (p.type === 'homing_piercing') {
                        p.pierceLeft--;
                        p.hitEnemies.push(enemy);
                        if (p.pierceLeft < 0) {
                            projectiles.splice(pIndex, 1);
                            break;
                        }
                    } else {
                        projectiles.splice(pIndex, 1);
                        break;
                    }
                }
            }
        }

        activeEffects.forEach((effect, index) => { effect.lifetime--; if (effect.lifetime <= 0) { activeEffects.splice(index, 1); return; } if(effect.type === 'explosion') { enemies.forEach(enemy => { if (Math.hypot(effect.x - enemy.x, effect.y - enemy.y) < effect.radius * (1 - (effect.lifetime / 20))) { dealDamage(enemy, effect.damage * deltaTime, 'explosion'); } }); } else if (effect.type === 'spore_explosion') { for(let i=0; i < (6 + effect.level) * player.projectileCountMultiplier; i++) { const angle = Math.random() * Math.PI * 2; projectiles.push({ type: 'fragment', x: effect.x, y: effect.y, radius: 4, color: '#44c772', dx: Math.cos(angle) * 4, dy: Math.sin(angle) * 4, damage: effect.damage * 0.5, lifetime: 60, source: 'spore_fragment' }); } activeEffects.splice(index, 1); } else if (effect.type === 'rift' || effect.type === 'purge_field') { enemies.forEach(enemy => { if (Math.hypot(effect.x - enemy.x, effect.y - enemy.y) < effect.radius) { dealDamage(enemy, effect.damagePerSecond * deltaTime, effect.type); } }); } else if (effect.type === 'ghost') { if (!effect.target || effect.target.health <= 0) { effect.target = findNearestEnemy(effect.x, effect.y); } if (effect.target) { const angle = Math.atan2(effect.target.y - effect.y, effect.target.x - effect.x); effect.x += Math.cos(angle) * effect.speed; effect.y += Math.sin(angle) * effect.speed; if (Math.hypot(effect.x - effect.target.x, effect.y - effect.target.y) < 20) { dealDamage(effect.target, effect.damage * deltaTime, 'noFantasma'); if (Math.random() < 0.01) effect.target.confusionUntil = gameTime + 2; } } } else if (effect.type === 'piercing_beam') { const endX = effect.x + Math.cos(effect.angle) * 1000; const endY = effect.y + Math.sin(effect.angle) * 1000; enemies.forEach(enemy => { if (effect.hitEnemies.includes(enemy)) return; const dist = Math.abs((endY - effect.y) * enemy.x - (endX - effect.x) * enemy.y + endX * effect.y - endY * effect.x) / Math.hypot(endY - effect.y, endX - effect.x); if (dist < enemy.radius + effect.width) { dealDamage(enemy, effect.damage * (1 + effect.hitEnemies.length * 0.15), 'lanternaDados'); effect.hitEnemies.push(enemy); } }); } else if (effect.type === 'lightning_strike' && effect.lifetime < effect.warningTime - 10) { enemies.forEach(enemy => { if (Math.hypot(effect.x - enemy.x, effect.y - enemy.y) < 30) { dealDamage(enemy, effect.damage, 'relampagoSelo'); } }); effect.lifetime = 0; } else if (effect.type === 'knockback_pulse' || effect.type === 'purge_pulse') { const currentRadius = effect.maxRadius * (1 - effect.lifetime / 20); enemies.forEach(enemy => { const dist = Math.hypot(effect.x - enemy.x, effect.y - enemy.y); if (dist < currentRadius && dist > currentRadius - 20) { if (effect.type === 'purge_pulse' && effect.damage) dealDamage(enemy, effect.damage, 'purge_pulse'); const angle = Math.atan2(enemy.y - effect.y, enemy.x - effect.x); enemy.x += Math.cos(angle) * 30; enemy.y += Math.sin(angle) * 30; } }); if (effect.type === 'purge_pulse' && effect.lifetime === 1) activeEffects.push({ type: 'purge_field', x: effect.x, y: effect.y, radius: effect.maxRadius, lifetime: 120, damagePerSecond: effect.damage * 0.2 }); } });
        xpOrbs.forEach((orb, index) => { const collectDist = (player.radius + orb.radius + 50) * player.fluxoArcanet; if (Math.hypot(player.x - orb.x, player.y - orb.y) < collectDist) { player.xp += orb.value; if(player.passives.injetoresCineticos) player.speedBurstEndTime = gameTime + 2; if(player.passives.nanoDesfragmentacao) player.health = Math.min(player.maxHealth, player.health + 2 * (player.firewall + 1)); xpOrbs.splice(index, 1); checkLevelUp(); } });
        damageNumbers.forEach((dn, index) => { dn.y -= 1; dn.lifetime--; dn.alpha = dn.lifetime / 60; if (dn.lifetime <= 0) damageNumbers.splice(index, 1); });
    }
    
    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        xpOrbs.forEach(o => { ctx.fillStyle = '#ff00ff'; ctx.beginPath(); ctx.arc(o.x, o.y, o.radius, 0, 7); ctx.fill(); });
        activeEffects.forEach(e => { ctx.globalAlpha = e.lifetime / (e.initialLifetime || e.lifetime + 1 || 1); if(e.type === 'explosion') { ctx.fillStyle = '#ffc300'; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius * (1 - e.lifetime / 20), 0, 7); ctx.fill(); } else if(e.type === 'heal' || e.type === 'knockback_pulse' || e.type === 'purge_pulse') { ctx.strokeStyle = e.type === 'heal' ? '#00ff00' : '#ffffff'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(e.x, e.y, e.maxRadius * (1 - e.lifetime / (e.type === 'knockback_pulse' ? 10 : 20)), 0, 7); ctx.stroke(); } else if (e.type === 'beam') { ctx.strokeStyle = e.color; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(e.from.x, e.from.y); ctx.lineTo(e.to.x, e.to.y); ctx.stroke(); } else if (e.type === 'rift' || e.type === 'purge_field') { ctx.fillStyle = e.type === 'rift' ? '#4f0278' : 'rgba(255,0,0,0.1)'; ctx.beginPath(); ctx.arc(e.x, e.y, e.radius, 0, 7); ctx.fill(); } else if (e.type === 'ghost') { ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, 10, 0, 7); ctx.fill(); } else if (e.type === 'piercing_beam') { ctx.strokeStyle = '#00ffff'; ctx.lineWidth = e.width; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.angle) * 1000, e.y + Math.sin(e.angle) * 1000); ctx.stroke(); } else if (e.type === 'lightning_strike') { if (e.lifetime > e.warningTime - 10) { ctx.strokeStyle = 'rgba(255, 255, 0, 0.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 30, 0, 7); ctx.stroke(); } else { ctx.strokeStyle = 'yellow'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(e.x, e.y - 50); ctx.lineTo(e.x, e.y + 50); ctx.stroke(); } } ctx.globalAlpha = 1; });
        
        if (playerSpriteLoaded) {
            ctx.shadowColor = player.isOverclocked || gameTime < player.speedBurstEndTime ? '#ff8c00' : '#00ffff';
            ctx.shadowBlur = 15;
            ctx.drawImage(playerSprite, player.x - PLAYER_SPRITE_WIDTH / 2, player.y - PLAYER_SPRITE_HEIGHT / 2, PLAYER_SPRITE_WIDTH, PLAYER_SPRITE_HEIGHT);
            ctx.shadowBlur = 0;
        } else {
            const playerColor = player.isOverclocked || gameTime < player.speedBurstEndTime ? '#ff8c00' : player.color;
            drawCircle(player.x, player.y, player.radius, playerColor);
        }
        
        if (player.passives.cascaSilicio && player.passives.cascaSilicio.shieldHealth > 0) { ctx.strokeStyle = '#00ffff'; ctx.lineWidth = 2; ctx.globalAlpha = 0.5 + (player.passives.cascaSilicio.shieldHealth / player.passives.cascaSilicio.maxShield) * 0.5; ctx.beginPath(); ctx.arc(player.x, player.y, player.radius + 5, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1; }
        player.weapons.forEach(w => { if(w.id === 'dronelamina') drawCircle(player.x + Math.cos(w.angle) * 40, player.y + Math.sin(w.angle) * 40, 8, '#ff00ff'); if(w.id === 'runasOrbitais') { for(let i=0; i<w.runeCount; i++){ const angle = (Math.PI * 2 / w.runeCount) * i + w.angle; drawCircle(player.x + Math.cos(angle) * w.distance, player.y + Math.sin(angle) * w.distance, 10, 'yellow'); } } });
        projectiles.forEach(p => drawCircle(p.x, p.y, p.radius, p.color));
        
        enemies.forEach(enemy => {
            if (enemy.sprite && enemy.sprite.complete && enemy.sprite.naturalHeight !== 0) {
                ctx.drawImage(enemy.sprite, enemy.x - ENEMY_SPRITE_SIZE / 2, enemy.y - ENEMY_SPRITE_SIZE / 2, ENEMY_SPRITE_SIZE, ENEMY_SPRITE_SIZE);
            } else {
                drawCircle(enemy.x, enemy.y, enemy.radius, gameTime < enemy.confusionUntil ? '#8a2be2' : enemy.color);
            }
        });

        ctx.font = 'bold 16px Courier New'; ctx.textAlign = 'center'; damageNumbers.forEach(dn => { ctx.globalAlpha = dn.alpha; ctx.fillStyle = dn.color; ctx.fillText(dn.value, dn.x, dn.y); }); ctx.globalAlpha = 1;
    }
    
    function drawCircle(x, y, radius, color) { ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; }

    let lastTime = 0;
    function gameLoop(timestamp) {
        if (!gameRunning || gamePaused) { if(gameRunning) requestAnimationFrame(gameLoop); return; }
        const deltaTime = (timestamp - lastTime) / 1000 || 0; lastTime = timestamp; gameTime += deltaTime; difficultyTimer += deltaTime;
        enemySpawnTimer -= deltaTime;
        if (enemySpawnTimer <= 0) { const spawnRate = Math.max(0.2, 1.5 - (difficultyTimer / 120)); const numToSpawn = 1 + Math.floor(difficultyTimer / 30); for (let i = 0; i < numToSpawn; i++) spawnEnemy(); enemySpawnTimer = spawnRate; }
        
        updatePlayer(deltaTime);
        updateEntities(deltaTime);
        
        if (player.health <= 0) {
            gameOver();
        }

        draw();
        updateUI();
        requestAnimationFrame(gameLoop);
    }
    
    function showWeaponSelection() {
        ui.startScreen.style.display = 'none';
        ui.gameOverScreen.style.display = 'none';
        ui.weaponSelectScreen.style.display = 'flex';

        ui.weaponOptions.innerHTML = '';
        Object.keys(weaponDefinitions).forEach(weaponId => {
            const weapon = weaponDefinitions[weaponId];
            const card = document.createElement('div');
            card.className = 'upgrade-card';

            const iconImage = weaponIcons[weaponId].cloneNode();
            card.appendChild(iconImage);

            const title = document.createElement('h3');
            title.textContent = weapon.name;
            card.appendChild(title);

            const description = document.createElement('p');
            description.textContent = weapon.description;
            card.appendChild(description);
            
            card.onclick = () => {
                startGame(weaponId);
            };
            ui.weaponOptions.appendChild(card);
        });
    }

    function startGame(startingWeaponId) {
        ui.weaponSelectScreen.style.display = 'none';
        
        gameRunning = true; gamePaused = false; gameTime = 0;
        lastTime = performance.now();
        enemies = []; projectiles = []; xpOrbs = []; activeEffects = []; damageNumbers = [];
        enemySpawnTimer = 3; difficultyTimer = 0;
        
        resetPlayerStats();
        addWeapon(startingWeaponId);
        updatePowerupsUI();
        requestAnimationFrame(gameLoop);
    }
    
    function gameOver() {
        if (player.passives.backupEspiritual && !player.hasRevived) {
            player.hasRevived = true;
            player.health = player.maxHealth * 0.30;
            activeEffects.push({ type: 'heal', x: player.x, y: player.y, radius: player.radius * 2, lifetime: 60 });
            return;
        }
        gameRunning = false;
        ui.finalTime.textContent = Math.floor(gameTime);
        ui.gameOverScreen.style.display = 'flex';
    }
    function updateUI() { ui.healthBar.style.width = `${(player.health / player.maxHealth) * 100}%`; ui.healthText.textContent = `Integridade: ${Math.ceil(player.health)} / ${player.maxHealth}`; ui.xpBar.style.width = `${(player.xp / player.xpToNextLevel) * 100}%`; ui.xpText.textContent = `Nível: ${player.level}`; ui.timer.textContent = `Sobrevivendo por: ${Math.floor(gameTime)}s`; }
    
    ui.startButton.addEventListener('click', showWeaponSelection);
    ui.restartButton.addEventListener('click', showWeaponSelection);
    window.addEventListener('keydown', e => keys[e.key.toLowerCase()] = true);
    window.addEventListener('keyup', e => keys[e.key.toLowerCase()] = false);
    window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
});
