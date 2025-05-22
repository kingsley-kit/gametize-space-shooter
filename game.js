// --- SUPABASE SETUP --- 
const SUPABASE_URL = 'https://pdrsqbwqkgoqlmaqqraz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcnNxYndxa2dvcWxtYXFxcmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjI4MDEsImV4cCI6MjA2MDUzODgwMX0._JOdIOhJXDyDjSE8CTjg0GzCKws5hbh8bsuhusoXAiw';

// Initialize Supabase client
let supabase = null;

function initializeSupabase() {
    return new Promise((resolve, reject) => {
        try {
            // Wait for Supabase to be available
            if (typeof window.createClient !== 'undefined') {
                supabase = window.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('Supabase client initialized with createClient');
                resolve(supabase);
            } else if (typeof window.supabase !== 'undefined') {
                supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                console.log('Supabase client initialized with window.supabase');
                resolve(supabase);
            } else {
                // Wait a bit and try again
                setTimeout(() => {
                    if (typeof window.supabase !== 'undefined') {
                        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
                        console.log('Supabase client initialized after delay');
                        resolve(supabase);
                    } else {
                        reject(new Error('Supabase client not available after delay'));
                    }
                }, 1000); // Wait 1 second and try again
            }
        } catch (error) {
            console.error('Error initializing Supabase client:', error);
            reject(error);
        }
    });
}

// Test the connection
async function testSupabaseConnection() {
    if (!supabase) {
        console.error('Cannot test connection: Supabase client not initialized');
        return false;
    }
    try {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('count')
            .limit(1);
            
        if (error) {
            console.error('Supabase connection test failed:', error);
            return false;
        } else {
            console.log('Supabase connection test successful');
            return true;
        }
    } catch (error) {
        console.error('Error testing Supabase connection:', error);
        return false;
    }
}

// Initialize the game when the page loads
window.addEventListener('load', async () => {
    console.log('Window loaded, initializing Supabase...');
    try {
        await initializeSupabase();
        const connectionSuccessful = await testSupabaseConnection();
        if (connectionSuccessful) {
            console.log('Supabase connection verified, initializing game...');
            window.spaceShooterGame = new SpaceShooter();
            console.log('Game initialized successfully');
        } else {
            console.error('Failed to verify Supabase connection');
            alert('Warning: Leaderboard functionality may be limited');
            window.spaceShooterGame = new SpaceShooter();
        }
    } catch (error) {
        console.error('Error during initialization:', error);
        alert('Warning: Leaderboard functionality may be limited');
        window.spaceShooterGame = new SpaceShooter();
    }
});

class SpaceShooter {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d', { alpha: false }); // Disable alpha for better performance
        
        // Enable hardware acceleration
        this.canvas.style.transform = 'translateZ(0)';
        this.canvas.style.backfaceVisibility = 'hidden';
        this.canvas.style.perspective = '1000px';
        
        // Detect mobile device
        this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth <= 480;
        
        // Initialize star system first
        this.backgroundStars = {
            small: [],
            medium: [],
            large: []
        };
        
        // Star configuration
        this.starConfig = {
            small: { count: 20, size: 1, speed: 1, color: 'rgba(255, 255, 255, 0.5)' },
            medium: { count: 10, size: 1.5, speed: 2, color: 'rgba(255, 255, 255, 0.7)' },
            large: { count: 5, size: 2, speed: 3, color: 'rgba(255, 255, 255, 0.9)' }
        };

        // Initialize canvas and other properties
        this.resizeCanvas();
        
        // Add resize throttling
        this.resizeTimeout = null;
        this.lastResizeTime = 0;
        this.resizeThrottleDelay = 250; // 250ms throttle delay
        
        // Image assets
        this.assetPaths = {
            player: './assets/player.webp', 
            enemy: './assets/enemy.webp',   
            star: './assets/star.webp',     
            bullet: './assets/bullet.webp', 
            background: './assets/background.webp',
            powerup: './assets/powerup.webp'
        };
        this.assets = {}; 
        this.assetsLoaded = 0;
        this.totalAssets = Object.keys(this.assetPaths).length;
        
        // Offscreen canvas for pre-rendered sprites
        this.enemyOffscreen = null;
        this.powerupOffscreen = null;
        // Offscreen canvases for pre-rotated bullets
        this.bulletOffscreen = {
            '-0.2': null,
            '0': null,
            '0.2': null
        };
        
        // Audio elements
        this.backgroundMusic = document.getElementById('backgroundMusic');
        this.musicToggleBtn = document.getElementById('musicToggleBtn');
        this.laserSound = document.getElementById('laserSound');
        this.powerupSound = document.getElementById('powerupSound');
        this.startGameSound = document.getElementById('startGameSound');
        this.isMusicPlaying = false;
        this.soundEnabled = true;
        
        // Web Audio API for mobile laser sound
        this.audioContext = null;
        this.laserAudioBuffer = null;
        if (this.isMobile) {
            try {
                this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
                fetch('assets/space-laser-38082 (mp3cut.net).mp3')
                    .then(response => response.arrayBuffer())
                    .then(arrayBuffer => this.audioContext.decodeAudioData(arrayBuffer))
                    .then(audioBuffer => {
                        this.laserAudioBuffer = audioBuffer;
                        console.log('Laser sound loaded and decoded for Web Audio API (mobile)');
                    })
                    .catch(err => console.error('Web Audio API laser sound error:', err));
            } catch (err) {
                console.error('Web Audio API not supported or failed to initialize:', err);
            }
        }
        
        // Initialize audio pool
        this.laserSoundPool = [];
        this.currentLaserSoundIndex = 0;
        this.initializeLaserSoundPool();
        
        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 80,
            size: 55
        };
        
        this.bulletPoolSize = 100;
        this.bulletPool = [];
        this.initBulletPool();
        this.bullets = [];
        this.enemies = [];
        this.stars = [];
        this.score = 0;
        this.lastScore = 0;
        this.level = 1;
        this.gameTime = 0;
        this.timeLeft = 60;
        this.isGameOver = false;
        this.isTriviaActive = false;
        this.hasActiveStar = false;
        this.lastStarSpawnTime = 0;
        this.isShooting = false;
        this.shootTimeoutId = null;
        this.animationFrameId = null;
        
        this.saveScoreModal = document.getElementById('saveScoreModal');
        this.saveScoreForm = document.getElementById('saveScoreForm');
        this.cancelScoreBtn = document.getElementById('cancelScoreBtn');
        this.finalScoreDisplay = document.getElementById('finalScoreDisplay');
        
        this.triviaSystem = new TriviaSystem();
        
        // Initialize starfield after canvas setup
        this.initializeStarfield();
        
        // Add after other game state variables
        this.powerups = [];
        this.hasMultiShot = false;
        this.multiShotEndTime = 0;
        this.lastPowerupTime = 0;
        
        this.activePopups = [];
        
        // Add laser sound cooldown properties
        this.lastLaserSoundTime = 0;
        this.laserSoundCooldown = this.isMobile ? 300 : 100; // 150ms for mobile, 100ms for desktop
        
        this.loadAssets();
        this.setupEventListeners();
        this.updateLeaderboardDisplay(false);
        this.setupMusic();
    }

    resizeCanvas() {
        // Get the container dimensions
        const container = this.canvas.parentElement;
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;

        // Only resize if dimensions actually changed
        if (this.canvas.width === containerWidth && this.canvas.height === containerHeight) {
            return;
        }

        // Make canvas fill the container exactly
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;

        // Update player position when canvas is resized
        if (this.player) {
            // Move player higher from bottom on mobile
            const isMobile = window.innerWidth <= 480;
            this.player.y = this.canvas.height - (isMobile ? 120 : 80);
            // Ensure player stays within bounds after resize
            this.player.x = Math.min(Math.max(this.player.x, this.player.size/2), this.canvas.width - this.player.size/2);
        }

        // Reinitialize starfield after resize
        this.initializeStarfield();

        console.log(`Canvas resized to ${this.canvas.width}x${this.canvas.height}`);
    }

    loadAssets() {
        console.log('Loading assets...');
        for (const key in this.assetPaths) {
            this.assets[key] = new Image();
            this.assets[key].onload = async () => {
                this.assetsLoaded++;
                console.log(`Asset loaded: ${key} (${this.assetsLoaded}/${this.totalAssets})`);
                
                // Convert to ImageBitmap for better performance
                try {
                    this.assets[`${key}Bitmap`] = await createImageBitmap(this.assets[key]);
                    console.log(`Created ImageBitmap for ${key}`);
                } catch (error) {
                    console.error(`Failed to create ImageBitmap for ${key}:`, error);
                }

                // Pre-render enemy and powerup when loaded
                if (key === 'enemy') this.createEnemyOffscreen();
                if (key === 'powerup') this.createPowerupOffscreen();
                if (key === 'bullet') this.createBulletOffscreens();
                if (this.assetsLoaded === this.totalAssets) {
                    console.log('All assets loaded!');
                }
            };
            this.assets[key].onerror = () => {
                console.error(`Failed to load asset: ${key} at ${this.assetPaths[key]}`);
            };
            this.assets[key].src = this.assetPaths[key];
        }
    }

    createEnemyOffscreen() {
        // Create an offscreen canvas for the enemy sprite
        const size = 40; // Default enemy size
        this.enemyOffscreen = document.createElement('canvas');
        this.enemyOffscreen.width = size;
        this.enemyOffscreen.height = size;
        const ctx = this.enemyOffscreen.getContext('2d');
        ctx.drawImage(this.assets.enemy, 0, 0, size, size);
    }

    createPowerupOffscreen() {
        // Create an offscreen canvas for the powerup sprite
        const size = 35; // Default powerup size
        this.powerupOffscreen = document.createElement('canvas');
        this.powerupOffscreen.width = size;
        this.powerupOffscreen.height = size;
        const ctx = this.powerupOffscreen.getContext('2d');
        ctx.drawImage(this.assets.powerup, 0, 0, size, size);
    }

    createBulletOffscreens() {
        // Pre-render bullet at -0.2, 0, 0.2 radians
        const bulletSize = 20;
        const angles = [-0.2, 0, 0.2];
        
        // Use ImageBitmap if available, otherwise fallback to Image
        const bulletSource = this.assets.bulletBitmap || this.assets.bullet;
        if (!bulletSource) return;

        angles.forEach(angle => {
            const canvas = document.createElement('canvas');
            canvas.width = bulletSize;
            canvas.height = bulletSize;
            const ctx = canvas.getContext('2d');
            ctx.save();
            ctx.translate(bulletSize / 2, bulletSize / 2);
            ctx.rotate(angle);
            ctx.drawImage(bulletSource, -bulletSize / 2, -bulletSize / 2, bulletSize, bulletSize);
            ctx.restore();
            this.bulletOffscreen[angle.toString()] = canvas;
        });
    }

    // Ensure game starts only after assets are loaded
    startGameIfReady() {
        if (this.assetsLoaded === this.totalAssets) {
            console.log('Assets ready, starting game...');
            this.startNewGame();
        } else {
            console.log('Waiting for assets to load...');
            // Optionally show a loading indicator
            // Retry after a short delay
            setTimeout(() => this.startGameIfReady(), 100); 
        }
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');
        
        // Replace direct resize listener with throttled version
        window.addEventListener('resize', () => this.handleResize(), { passive: true });
        
        // Use passive event listeners for better touch performance
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isGameOver && !this.isTriviaActive) {
                const rect = this.canvas.getBoundingClientRect();
                this.player.x = e.clientX - rect.left;
            }
        }, { passive: true });

        this.canvas.addEventListener('mousedown', () => this.startShooting(), { passive: true });
        this.canvas.addEventListener('mouseup', () => this.stopShooting(), { passive: true });
        this.canvas.addEventListener('mouseleave', () => this.stopShooting(), { passive: true });

        // Optimize touch events
        let touchStartX = 0;
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            touchStartX = e.touches[0].clientX;
            this.startShooting();
        }, { passive: false });

        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.isGameOver && !this.isTriviaActive) {
                e.preventDefault();
                const rect = this.canvas.getBoundingClientRect();
                const touchX = e.touches[0].clientX;
                this.player.x = touchX - rect.left;
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => this.stopShooting(), { passive: true });
        this.canvas.addEventListener('touchcancel', () => this.stopShooting(), { passive: true });

        // Music Toggle Button Listener
        if (this.musicToggleBtn) {
            console.log('Music toggle button found');
            this.musicToggleBtn.addEventListener('click', () => this.toggleMusic());
        } else {
            console.error('Music toggle button not found');
        }

        const startGameBtn = document.getElementById('startGameBtn');
        if (startGameBtn) {
            console.log('Start game button found');
            startGameBtn.addEventListener('click', () => {
                console.log('Start Game button clicked');
                // Play start game sound
                if (this.startGameSound && this.soundEnabled) {
                    this.startGameSound.currentTime = 0;
                    this.startGameSound.volume = 0.5;
                    this.startGameSound.play().catch(error => {
                        console.warn('Error playing start game sound:', error);
                    });
                }
                document.getElementById('homeScreen').style.display = 'none';
                document.getElementById('gameScreen').style.display = 'flex';
                this.startGameIfReady();
            });
        } else {
            console.error('Start game button not found');
        }

        const showLeaderboardBtn = document.getElementById('showLeaderboardBtn');
        if (showLeaderboardBtn) {
            console.log('Leaderboard button found');
            showLeaderboardBtn.addEventListener('click', () => {
                console.log('Leaderboard button clicked');
                this.showLeaderboardModal();
            });
        } else {
            console.error('Leaderboard button not found');
        }

        const howToPlayBtn = document.getElementById('howToPlayBtn');
        if (howToPlayBtn) {
            console.log('How to play button found');
            howToPlayBtn.addEventListener('click', () => {
                console.log('How to play button clicked');
                document.getElementById('howToPlayModal').style.display = 'flex';
            });
        } else {
            console.error('How to play button not found');
        }

        const closeHowToPlayBtn = document.getElementById('closeHowToPlayBtn');
        if (closeHowToPlayBtn) {
            console.log('Close how to play button found');
            closeHowToPlayBtn.addEventListener('click', () => {
                console.log('Close how to play button clicked');
                document.getElementById('howToPlayModal').style.display = 'none';
            });
        } else {
            console.error('Close how to play button not found');
        }

        const endGameBtn = document.getElementById('endGameBtn');
        if (endGameBtn) {
            console.log('End game button found');
            endGameBtn.addEventListener('click', () => {
                console.log('End game button clicked');
                this.endGame();
                document.getElementById('gameScreen').style.display = 'none';
                document.getElementById('homeScreen').style.display = 'flex';
                this.updateLeaderboardDisplay(false);
            });
        } else {
            console.error('End game button not found');
        }

        if (this.saveScoreForm) {
            console.log('Save score form found');
            this.saveScoreForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                console.log('Save score form submitted.');

                if (!supabase) {
                    console.error('Cannot save score, Supabase not initialized.');
                    alert('Error: Unable to save score. Please try again later.');
                    this.closeScoreModalAndReturnHome();
                    return;
                }

                const nickname = e.target.nickname.value.trim();
                if (!nickname) {
                    alert('Please enter a nickname.');
                    return;
                }

                const scoreToSave = this.lastScore;
                console.log(`Attempting to save: Nick: ${nickname}, Score: ${scoreToSave}`);

                try {
                    // Get current timestamp in ISO format
                    const timestamp = new Date().toISOString();

                    const { data, error } = await supabase
                        .from('leaderboard')
                        .insert([{ 
                            nickname: nickname, 
                            score: scoreToSave,
                            created_at: timestamp
                        }])
                        .select(); // Add this to get the response with the generated ID

                    if (error) {
                        console.error('Error saving score to Supabase:', error);
                        alert(`Error saving score: ${error.message}`);
                    } else {
                        console.log('Score saved successfully to Supabase:', data);
                        alert('Score submitted successfully!');
                        // Update the leaderboard display
                        this.updateLeaderboardDisplay(false);
                    }
                } catch (error) {
                    console.error('Error during score submission:', error);
                    alert('An unexpected error occurred while submitting your score.');
                }
                
                this.closeScoreModalAndReturnHome();
            });
        } else {
            console.error('Save score form not found');
        }

        this.cancelScoreBtn.addEventListener('click', () => {
            console.log('Score submission skipped.');
            this.closeScoreModalAndReturnHome();
        });
    }

    handleResize() {
        const now = performance.now();
        
        // Clear any pending resize
        if (this.resizeTimeout) {
            clearTimeout(this.resizeTimeout);
        }
        
        // Throttle resize operations
        if (now - this.lastResizeTime < this.resizeThrottleDelay) {
            // Schedule resize for later
            this.resizeTimeout = setTimeout(() => {
                this.resizeCanvas();
                this.lastResizeTime = performance.now();
            }, this.resizeThrottleDelay);
            return;
        }
        
        // Perform resize immediately if enough time has passed
        this.resizeCanvas();
        this.lastResizeTime = now;
    }

    showLeaderboardModal() {
        // Remove existing modal if it exists
        const existingModal = document.getElementById('leaderboardModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'leaderboardModal';
        modal.style.display = 'flex';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        // Create modal body
        const modalBody = document.createElement('div');
        modalBody.className = 'modal-body';
        modalBody.innerHTML = `
            <h2>Leaderboard</h2>
            <div id="leaderboardListContainer">
                <ol id="leaderboardList"></ol>
            </div>
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'CLOSE';
        closeBtn.className = 'close-modal-btn';
        closeBtn.onclick = () => modal.remove();
        
        content.appendChild(modalBody);
        content.appendChild(closeBtn);
        modal.appendChild(content);
        document.body.appendChild(modal);
        
        this.updateLeaderboardDisplay(true);
    }

    startNewGame() {
        console.log('Starting new game...');
        // Reset all game state
        this.score = 0;
        this.level = 1;
        this.gameTime = 0;
        this.timeLeft = 60;
        this.isGameOver = false;
        this.bullets = [];
        this.enemies = [];
        this.stars = [];
        this.hasActiveStar = false;
        this.lastStarSpawnTime = 0;
        this.isShooting = false;
        this.lastScore = 0;
        
        this.resizeCanvas();
        console.log(`Canvas dimensions: ${this.canvas.width}x${this.canvas.height}`);

        // Initialize player position with mobile-friendly offset
        const isMobile = window.innerWidth <= 480;
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height - (isMobile ? 120 : 80);
        
        this.updateScore();
        
        // Clear any existing game loop/timeouts
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            console.log('Cleared existing animation frame on new game');
        }
        if (this.shootTimeoutId) {
            clearTimeout(this.shootTimeoutId);
        }
        
        // Start new game loop
        console.log('Starting game loop...');
        this.gameLoop();
    }

    endGame() {
        if (this.isGameOver) return; // Prevent running multiple times
        this.isGameOver = true;
        console.log('Game Over! Final Score:', this.score);

        // Stop the game loop explicitly
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        // Clear shooting timeout
        if (this.shootTimeoutId) {
            clearTimeout(this.shootTimeoutId);
            this.shootTimeoutId = null;
        }

        this.saveScore(); // Save score to leaderboard

        // --- Draw Game Over Screen --- 
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'; // Darker overlay
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#ff0000'; // Red Game Over text
        this.ctx.font = 'bold 60px Arial';
        this.ctx.textAlign = 'center';
        
        if (!this.isMobile) {
            // Only apply text effects on non-mobile devices
            this.ctx.shadowColor = '#000';
            this.ctx.shadowBlur = 10;
        }
        
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);
        
        this.ctx.fillStyle = '#ffffff'; // White score text
        this.ctx.font = 'bold 30px Arial';
        
        if (!this.isMobile) {
            this.ctx.shadowBlur = 5;
        }
        
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 30);
        this.ctx.restore();
        // ------------------------------

        // Show score submission prompt after a delay
        setTimeout(() => {
            this.promptToSaveScore(); 
        }, 2000); // Show Game Over for 2 seconds before prompt
    }

    startShooting() {
        if (!this.isGameOver && !this.isTriviaActive) { // Check trivia state
            this.isShooting = true;
            this.shoot();
        }
    }

    stopShooting() {
        this.isShooting = false;
        if (this.shootTimeoutId) {
            clearTimeout(this.shootTimeoutId);
            this.shootTimeoutId = null;
        }
    }

    shoot() {
        if (this.shootTimeoutId) {
            clearTimeout(this.shootTimeoutId);
        }

        if (this.isShooting && !this.isGameOver && !this.isTriviaActive) {
            if (this.hasMultiShot) {
                // Shoot three bullets at different angles
                this.activateBullet(this.player.x, this.player.y, 5, -0.2); // Left bullet
                this.activateBullet(this.player.x, this.player.y, 5, 0);    // Center bullet
                this.activateBullet(this.player.x, this.player.y, 5, 0.2);  // Right bullet
            } else {
                // Normal single bullet
                this.activateBullet(this.player.x, this.player.y, 5, 0);
            }

            // Play laser sound using the pool
            this.playLaserSound();

            // Use different shoot rates for mobile and desktop
            const shootDelay = this.isMobile ? 350 : 300;
            this.shootTimeoutId = setTimeout(() => this.shoot(), shootDelay);
        }
    }

    activateBullet(x, y, speed, angle) {
        // Limit active bullets on mobile
        if (this.isMobile) {
            let activeCount = 0;
            for (let i = 0; i < this.bulletPool.length; i++) {
                if (this.bulletPool[i].active) activeCount++;
            }
            if (activeCount >= 30) return; // Do not activate more than 40
        }
        const bullet = this.getBulletFromPool();
        bullet.x = x;
        bullet.y = y;
        bullet.speed = speed;
        bullet.angle = angle;
        bullet.active = true;
    }

    getBulletFromPool() {
        for (let i = 0; i < this.bulletPool.length; i++) {
            if (!this.bulletPool[i].active) {
                return this.bulletPool[i];
            }
        }
        // If all bullets are active, reuse the first one (fallback)
        return this.bulletPool[0];
    }

    spawnEnemy() {
        const size = 40;
        const isDasher = Math.random() < 0.2; // 20% chance for a dasher
        const isLate = this.timeLeft <= 20; // Last 20 seconds of game
        
        const baseSpeed = isLate ? 2 : 1; // Increase base speed in last 20 seconds
        const levelSpeed = this.level * 0.5;
        const speed = isDasher ? (baseSpeed + levelSpeed) * 2.5 : baseSpeed + levelSpeed;

        this.enemies.push({
            x: Math.random() * (this.canvas.width - size),
            y: -size,
            size: size,
            speed: speed,
            isDasher: isDasher,
            dashTimer: isDasher ? 0 : null,
            originalX: null
        });
    }

    spawnStar() {
        if (this.hasActiveStar) return;
        
        const size = 30;
        this.stars.push({
            x: Math.random() * (this.canvas.width - size),
            y: -size,
            size: size,
            speed: 2
        });
        this.hasActiveStar = true;
        this.lastStarSpawnTime = this.gameTime;
    }

    createPointPopup(x, y, points, color = '#FFD700') {
        // Add a popup object to the activePopups array
        this.activePopups.push({
            x,
            y,
            points,
            color,
            startTime: performance.now(),
            duration: 1000 // ms
        });
    }

    update(deltaTime) {
        if (this.isGameOver || this.isTriviaActive) return;

        // Update starfield
        this.updateStarfield();
        
        // Update game time based on actual delta time
        this.gameTime += deltaTime;

        // Calculate level based on game time (every 30 seconds)
        const newLevel = Math.floor(this.gameTime / 30000) + 1;
        if (newLevel > this.level) {
            this.level = newLevel;
            console.log('Level increased to:', this.level);
        }

        // Update power-up status
        if (this.hasMultiShot && this.gameTime > this.multiShotEndTime) {
            this.hasMultiShot = false;
            console.log('Multi-shot expired');
        }

        // Spawn power-up every 20-30 seconds
        if (this.gameTime - this.lastPowerupTime > 20000) {
            if (Math.random() < 0.02) {
                this.spawnPowerup();
                this.lastPowerupTime = this.gameTime;
            }
        }

        // Update power-ups
        this.powerups = this.powerups.filter(powerup => {
            powerup.y += powerup.speed;
            
            const dx = powerup.x - this.player.x;
            const dy = powerup.y - this.player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < (this.player.size / 2 + powerup.size / 2)) {
                this.activateMultiShot();
                return false;
            }
            
            return powerup.y < this.canvas.height;
        });

        // Update timer
        if (this.timeLeft > 0) {
            this.timeLeft = Math.max(0, 60 - Math.floor(this.gameTime / 1000));
            const timeLeft = document.getElementById('timeLeft');
            if (timeLeft) {
                timeLeft.textContent = this.timeLeft;
                if (this.timeLeft <= 10) {
                    timeLeft.style.color = '#ff0000';
                } else {
                    timeLeft.style.color = '#fff';
                }
            }
            
            if (this.timeLeft === 0) {
                this.endGame();
                return;
            }
        }

        // Spawn enemies based on level and time left
        const spawnRate = this.timeLeft <= 20 ? 0.03 * this.level : 0.02 * this.level;
        if (Math.random() < spawnRate) {
            this.spawnEnemy();
        }

        // Spawn stars every 10-15 seconds if no active star
        if (!this.hasActiveStar && this.gameTime - this.lastStarSpawnTime > 10000) {
            if (Math.random() < 0.1) {
                this.spawnStar();
            }
        }

        // Update bullets with angles (object pool version)
        this.bullets = [];
        for (let i = 0; i < this.bulletPool.length; i++) {
            const bullet = this.bulletPool[i];
            if (bullet.active) {
                bullet.x += Math.sin(bullet.angle) * bullet.speed * 3;
                bullet.y -= bullet.speed;
                // Deactivate if out of bounds
                if (bullet.y <= 0 || bullet.x <= 0 || bullet.x >= this.canvas.width) {
                    bullet.active = false;
                } else {
                    this.bullets.push(bullet);
                }
            }
        }

        // Update enemies
        this.enemies = this.enemies.filter(enemy => {
            // Update dasher movement
            if (enemy.isDasher) {
                enemy.dashTimer = (enemy.dashTimer + 1) % 60; // Reset every 60 frames
                
                if (enemy.dashTimer === 0) {
                    // Store original X position when starting a new dash
                    enemy.originalX = enemy.x;
                }
                
                // Sinusoidal horizontal movement for dashers
                if (enemy.originalX !== null) {
                    const dashAmplitude = 100; // Maximum horizontal dash distance
                    const dashProgress = enemy.dashTimer / 60; // Progress through the dash cycle
                    enemy.x = enemy.originalX + Math.sin(dashProgress * Math.PI * 2) * dashAmplitude;
                }
            }
            
            enemy.y += enemy.speed;
            
            if (enemy.y > this.canvas.height) {
                this.score = Math.max(0, this.score - 10);
                this.updateScore();
                return false;
            }
            
            for (let i = 0; i < this.bullets.length; i++) {
                const bullet = this.bullets[i];
                if (this.checkCollision(bullet, enemy)) {
                    bullet.active = false;
                    // Dashers give more points
                    const points = enemy.isDasher ? 20 : 10;
                    this.score += points;
                    this.updateScore();
                    this.createPointPopup(enemy.x, enemy.y, `+${points}`, enemy.isDasher ? '#ff00ff' : '#00ff00');
                    return false;
                }
            }
            
            return true;
        });

        // Update stars
        this.stars = this.stars.filter(star => {
            star.y += star.speed;
            
            if (star.y > this.canvas.height) {
                this.hasActiveStar = false;
                return false;
            }
            
            for (let i = 0; i < this.bullets.length; i++) {
                const bullet = this.bullets[i];
                if (this.checkCollision(bullet, star)) {
                    bullet.active = false;
                    
                    this.isTriviaActive = true;
                    console.log('Pausing for trivia...');
                    if (this.animationFrameId) {
                        cancelAnimationFrame(this.animationFrameId);
                        this.animationFrameId = null;
                        console.log('Animation frame cancelled for trivia.');
                    }
                    if (this.shootTimeoutId) {
                        clearTimeout(this.shootTimeoutId);
                        this.shootTimeoutId = null;
                    }

                    this.hasActiveStar = false;
                    this.triviaSystem.showQuestion((isCorrect) => {
                        console.log('Trivia answered. Correct:', isCorrect);
                        if (isCorrect) {
                            this.score += 50;
                            this.updateScore();
                            this.createPointPopup(star.x, star.y, '+50', '#ffff00');
                        }
                        this.isTriviaActive = false;
                        console.log('Resuming game after trivia...');
                        this.gameLoop();
                    });
                    return false;
                }
            }
            
            return true;
        });

        // Update popups: remove expired ones
        const now = performance.now();
        this.activePopups = this.activePopups.filter(popup => (now - popup.startTime) < popup.duration);
    }

    checkCollision(obj1, obj2) {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        // Use half sizes for radius approx. obj1 might be a bullet (smaller)
        const obj1Radius = (obj1.size || 10) / 2; 
        const obj2Radius = obj2.size / 2;
        return distance < obj1Radius + obj2Radius;
    }

    draw() {
        if (this.assetsLoaded !== this.totalAssets) return;
        
        // Use a single clearRect call
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw solid background
        this.ctx.fillStyle = '#000033';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw starfield before other elements
        this.drawStarfield();

        // Batch draw bullets
        this.ctx.save();
        const bulletSize = 20;
        this.bullets.forEach(bullet => {
            let angleKey = bullet.angle.toFixed(1); // '-0.2', '0.0', '0.2'
            if (!this.bulletOffscreen[angleKey]) angleKey = '0'; // fallback
            const bulletImg = this.bulletOffscreen[angleKey];
            if (bulletImg) {
                this.ctx.drawImage(
                    bulletImg,
                    bullet.x - bulletSize / 2,
                    bullet.y - bulletSize / 2,
                    bulletSize,
                    bulletSize
                );
            } else if (this.assets.bulletBitmap) {
                // Use ImageBitmap if available
                this.ctx.drawImage(
                    this.assets.bulletBitmap,
                    bullet.x - bulletSize / 2,
                    bullet.y - bulletSize / 2,
                    bulletSize,
                    bulletSize
                );
            } else if (this.assets.bullet) {
                // fallback to unrotated Image
                this.ctx.drawImage(
                    this.assets.bullet,
                    bullet.x - bulletSize / 2,
                    bullet.y - bulletSize / 2,
                    bulletSize,
                    bulletSize
                );
            }
        });
        this.ctx.restore();

        // Draw player using ImageBitmap if available
        if (this.assets.playerBitmap) {
            this.ctx.drawImage(
                this.assets.playerBitmap,
                this.player.x - this.player.size / 2,
                this.player.y - this.player.size / 2,
                this.player.size,
                this.player.size
            );
        } else if (this.assets.player) {
            this.ctx.drawImage(
                this.assets.player,
                this.player.x - this.player.size / 2,
                this.player.y - this.player.size / 2,
                this.player.size,
                this.player.size
            );
        }

        // Batch draw enemies using ImageBitmap if available
        if (this.enemyOffscreen) {
            this.ctx.save();
            this.enemies.forEach(enemy => {
                this.ctx.drawImage(
                    this.enemyOffscreen,
                    0, 0, this.enemyOffscreen.width, this.enemyOffscreen.height,
                    enemy.x - enemy.size / 2,
                    enemy.y - enemy.size / 2,
                    enemy.size,
                    enemy.size
                );
            });
            this.ctx.restore();
        } else if (this.assets.enemyBitmap) {
            this.ctx.save();
            this.enemies.forEach(enemy => {
                this.ctx.drawImage(
                    this.assets.enemyBitmap,
                    enemy.x - enemy.size / 2,
                    enemy.y - enemy.size / 2,
                    enemy.size,
                    enemy.size
                );
            });
            this.ctx.restore();
        } else if (this.assets.enemy) {
            this.ctx.save();
            this.enemies.forEach(enemy => {
                this.ctx.drawImage(
                    this.assets.enemy,
                    enemy.x - enemy.size / 2,
                    enemy.y - enemy.size / 2,
                    enemy.size,
                    enemy.size
                );
            });
            this.ctx.restore();
        }

        // Batch draw stars using ImageBitmap if available
        if (this.assets.starBitmap) {
            this.ctx.save();
            this.stars.forEach(star => {
                this.ctx.drawImage(
                    this.assets.starBitmap,
                    star.x - star.size / 2,
                    star.y - star.size / 2,
                    star.size,
                    star.size
                );
            });
            this.ctx.restore();
        } else if (this.assets.star) {
            this.ctx.save();
            this.stars.forEach(star => {
                this.ctx.drawImage(
                    this.assets.star,
                    star.x - star.size / 2,
                    star.y - star.size / 2,
                    star.size,
                    star.size
                );
            });
            this.ctx.restore();
        }

        // Batch draw power-ups using ImageBitmap if available
        if (this.powerupOffscreen) {
            this.ctx.save();
            this.powerups.forEach(powerup => {
                this.ctx.drawImage(
                    this.powerupOffscreen,
                    0, 0, this.powerupOffscreen.width, this.powerupOffscreen.height,
                    powerup.x - powerup.size / 7,
                    powerup.y - powerup.size / 7,
                    powerup.size,
                    powerup.size
                );
            });
            this.ctx.restore();
        } else if (this.assets.powerupBitmap) {
            this.ctx.save();
            this.powerups.forEach(powerup => {
                this.ctx.drawImage(
                    this.assets.powerupBitmap,
                    powerup.x - powerup.size / 7,
                    powerup.y - powerup.size / 7,
                    powerup.size,
                    powerup.size
                );
            });
            this.ctx.restore();
        } else if (this.assets.powerup) {
            this.ctx.save();
            this.powerups.forEach(powerup => {
                this.ctx.drawImage(
                    this.assets.powerup,
                    powerup.x - powerup.size / 7,
                    powerup.y - powerup.size / 7,
                    powerup.size,
                    powerup.size
                );
            });
            this.ctx.restore();
        }

        // Draw power-up status if active
        if (this.hasMultiShot) {
            const timeLeft = Math.ceil((this.multiShotEndTime - this.gameTime) / 1000);
            this.ctx.save();
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = 'bold 20px Arial';
            this.ctx.fillText(`Multi-shot: ${timeLeft}s`, 10, 120);
            this.ctx.restore();
        }

        // Draw canvas-based point popups
        const now = performance.now();
        this.ctx.save();
        this.activePopups.forEach(popup => {
            const elapsed = now - popup.startTime;
            const progress = Math.min(elapsed / popup.duration, 1);
            const y = popup.y - progress * 60; // Move up
            const alpha = 1 - progress; // Fade out
            this.ctx.globalAlpha = alpha;
            this.ctx.font = 'bold 32px Arial Black, Arial, sans-serif';
            this.ctx.textAlign = 'center';
            
            if (!this.isMobile) {
                // Only apply text effects on non-mobile devices
                this.ctx.lineWidth = 4;
                this.ctx.strokeStyle = '#654321';
                this.ctx.strokeText(`+${popup.points}`, popup.x, y);
            }
            
            this.ctx.fillStyle = popup.color || '#FFD700';
            this.ctx.fillText(`+${popup.points}`, popup.x, y);
        });
        this.ctx.restore();
    }

    updateScore() {
        document.getElementById('currentScore').textContent = this.score;
    }

    updateLeaderboardDisplay(isModal = false) {
        const listElementId = isModal ? 'leaderboardList' : 'leaderboardListHome';
        const leaderboardList = document.getElementById(listElementId);
        
        if (!leaderboardList) {
            if (isModal) console.error(`Element with ID ${listElementId} not found for modal.`);
            return;
        }

        leaderboardList.innerHTML = '<li><div class="loading">Loading...</div></li>';

        this.getLeaderboard().then(scores => {
            leaderboardList.innerHTML = '';

            if (!supabase) {
                leaderboardList.innerHTML = '<li><div class="error">Leaderboard disabled (Supabase not configured).</div></li>';
                return;
            }

            if (scores.length === 0) {
                leaderboardList.innerHTML = '<li><div class="empty">No scores yet! Play a game.</div></li>';
            } else {
                scores.forEach((entry, index) => {
                    const li = document.createElement('li');
                    li.setAttribute('data-rank', (index + 4)); // For entries after top 3
                    
                    // Create score-name container
                    const scoreNameDiv = document.createElement('div');
                    scoreNameDiv.className = 'score-name';
                    
                    // Add score
                    const scoreSpan = document.createElement('span');
                    scoreSpan.className = 'score-value';
                    scoreSpan.textContent = entry.score;
                    
                    // Add name
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'player-name';
                    nameSpan.textContent = entry.nickname;
                    
                    // Add score and name to container
                    scoreNameDiv.appendChild(scoreSpan);
                    scoreNameDiv.appendChild(nameSpan);
                    
                    // Format date (19 Apr style)
                    const date = new Date(entry.created_at);
                    const day = date.getDate();
                    const month = date.toLocaleString('default', { month: 'short' });
                    const formattedDate = `${day} ${month}`;
                    
                    // Add date
                    const dateSpan = document.createElement('span');
                    dateSpan.className = 'date';
                    dateSpan.textContent = formattedDate;
                    
                    // Add all elements to list item
                    li.appendChild(scoreNameDiv);
                    li.appendChild(dateSpan);
                    
                    leaderboardList.appendChild(li);
                });
            }

            // Update high score display
            const highScoreDisplay = document.getElementById('highScore');
            if (highScoreDisplay && scores.length > 0) {
                highScoreDisplay.textContent = scores[0].score;
            }
        }).catch(error => {
            console.error("Failed to update leaderboard display:", error);
            leaderboardList.innerHTML = '<li><div class="error">Error loading leaderboard.</div></li>';
        });
    }

    async getLeaderboard() {
        try {
            const { data, error } = await supabase
                .from('leaderboard')
                .select('*')
                .order('score', { ascending: false })
                .limit(10);

            if (error) {
                console.error('Error fetching leaderboard:', error);
                return [];
            }
            return data || [];
        } catch (error) {
            console.error('Error in getLeaderboard:', error);
            return [];
        }
    }

    saveScore() {
        if (this.score <= 0) return; // Don't save zero scores
        this.lastScore = this.score; // Store score temporarily for submission
        console.log('Score ready for submission:', this.lastScore);
    }

    gameLoop() {
        if (this.isGameOver || this.isTriviaActive) {
            console.log(`Game loop stopped: isGameOver=${this.isGameOver}, isTriviaActive=${this.isTriviaActive}`);
            return;
        }

        // Use requestAnimationFrame timestamp for more accurate timing
        const now = performance.now();
        const deltaTime = now - (this.lastFrameTime || now);
        this.lastFrameTime = now;

        // Update game state
        this.update(deltaTime);
        
        // Draw every frame for smooth animation
        this.draw();

        this.animationFrameId = requestAnimationFrame((timestamp) => this.gameLoop());
    }

    // Removing duplicate getLeaderboard method
    async promptToSaveScore() {
        if (this.score <= 0) { // Don't prompt if score is 0
            this.returnToHome();
            return;
        }
        
        console.log('Prompting user to save score:', this.score);
        this.lastScore = this.score; // Store score temporarily
        this.finalScoreDisplay.textContent = this.lastScore;
        this.saveScoreModal.style.display = 'flex'; // Show the modal
    }

    closeScoreModalAndReturnHome() {
         this.saveScoreModal.style.display = 'none'; 
         this.saveScoreForm.reset(); 
         this.returnToHome(); 
    }

    returnToHome() {
        document.getElementById('gameScreen').style.display = 'none';
        document.getElementById('homeScreen').style.display = 'flex';
        // Update leaderboard on home screen (no await/catch needed now)
        this.updateLeaderboardDisplay(false); 
    }

    setupMusic() {
        // Set initial state (off)
        this.backgroundMusic = document.getElementById('backgroundMusic');
        this.laserSound = document.getElementById('laserSound');
        this.powerupSound = document.getElementById('powerupSound');
        
        // Check if audio elements exist
        if (!this.backgroundMusic) {
            console.error('Background music element not found');
            return;
        }

        if (!this.laserSound) {
            console.error('Laser sound element not found');
        }

        if (!this.powerupSound) {
            console.error('Power-up sound element not found');
        }

        this.musicToggleBtn = document.getElementById('musicToggleBtn');
        
        // Check if button element exists
        if (!this.musicToggleBtn) {
            console.error('Music toggle button not found');
            return;
        }

        // Set initial volume and state
        this.backgroundMusic.volume = 0.3;
        if (this.laserSound) {
            this.laserSound.volume = 0.3;
        }
        if (this.powerupSound) {
            this.powerupSound.volume = 0.4;
        }
        this.backgroundMusic.pause();
        this.isMusicPlaying = false;
        this.soundEnabled = true;
        this.updateMusicButtonState();
    }

    updateMusicButtonState() {
        // Update button image based on state
        if (this.musicToggleBtn) {
            console.log('Updating music button state:', this.isMusicPlaying ? 'ON' : 'OFF');
            const newSrc = this.isMusicPlaying ? './assets/music_on.png' : './assets/music_off.png';
            console.log('Setting button image to:', newSrc);
            this.musicToggleBtn.src = newSrc;
            this.musicToggleBtn.alt = this.isMusicPlaying ? "Music On" : "Music Off";
        }
    }

    toggleMusic() {
        if (!this.backgroundMusic || !this.musicToggleBtn) {
            console.error('Music elements not initialized');
            return;
        }

        if (this.isMusicPlaying) {
            this.backgroundMusic.pause();
            this.isMusicPlaying = false;
            this.updateMusicButtonState();
        } else {
            // Create a new promise to handle the play attempt
            const playAttempt = this.backgroundMusic.play();
            
            if (playAttempt !== undefined) {
                playAttempt
                    .then(() => {
                        this.isMusicPlaying = true;
                        this.updateMusicButtonState();
                        console.log('Music started successfully');
                    })
                    .catch(error => {
                        console.warn('Audio playback failed:', error);
                        this.isMusicPlaying = false;
                        this.updateMusicButtonState();
                        // Optionally show a message to the user about needing interaction
                    });
            } else {
                // Older browsers might not return a promise
                this.isMusicPlaying = true;
                this.updateMusicButtonState();
            }
        }
    }

    initializeStarfield() {
        // Clear existing stars
        this.backgroundStars.small = [];
        this.backgroundStars.medium = [];
        this.backgroundStars.large = [];

        // Create stars for each layer
        Object.keys(this.starConfig).forEach(size => {
            const config = this.starConfig[size];
            for (let i = 0; i < config.count; i++) {
                this.backgroundStars[size].push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    size: config.size,
                    speed: config.speed,
                    color: config.color
                });
            }
        });
    }

    updateStarfield() {
        Object.keys(this.backgroundStars).forEach(size => {
            const stars = this.backgroundStars[size];
            const config = this.starConfig[size];
            
            stars.forEach(star => {
                // Move star downward
                star.y += config.speed;
                
                // Reset star to top when it goes off screen
                if (star.y > this.canvas.height) {
                    star.y = 0;
                    star.x = Math.random() * this.canvas.width;
                }
            });
        });
    }

    drawStarfield() {
        Object.keys(this.backgroundStars).forEach(size => {
            const stars = this.backgroundStars[size];
            
            this.ctx.save();
            stars.forEach(star => {
                this.ctx.fillStyle = star.color;
                this.ctx.beginPath();
                this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
                this.ctx.fill();
            });
            this.ctx.restore();
        });
    }

    spawnPowerup() {
        const size = 35;
        this.powerups.push({
            x: Math.random() * (this.canvas.width - size),
            y: -size,
            size: size,
            speed: 2,
            type: 'multishot'
        });
        console.log('Power-up spawned');
    }

    activateMultiShot() {
        this.hasMultiShot = true;
        this.multiShotEndTime = this.gameTime + 6000; // 5 seconds duration
        
        // Play power-up sound
        if (this.soundEnabled && this.powerupSound) {
            this.powerupSound.currentTime = 0;
            this.powerupSound.volume = 0.4;
            this.powerupSound.play().catch(error => {
                console.warn('Error playing power-up sound:', error);
            });
        }
        
        console.log('Multi-shot activated');
    }

    initializeLaserSoundPool() {
        // Create a larger pool for better sound overlap handling
        const poolSize = this.isMobile ? 6 : 8;
        if (this.laserSound) {
            for (let i = 0; i < poolSize; i++) {
                const sound = this.laserSound.cloneNode();
                sound.volume = 0.3;
                // Preload the audio
                sound.load();
                this.laserSoundPool.push(sound);
            }
            console.log(`Initialized laser sound pool with ${poolSize} sounds`);
        }
    }

    playLaserSound() {
        if (!this.soundEnabled) return;

        const now = performance.now();
        if (now - this.lastLaserSoundTime < this.laserSoundCooldown) return;
        this.lastLaserSoundTime = now;

        // Mobile: Use Web Audio API
        if (this.isMobile && this.audioContext && this.laserAudioBuffer) {
            try {
                // Some browsers require context to be resumed after user gesture
                if (this.audioContext.state === 'suspended') {
                    this.audioContext.resume();
                }
                const source = this.audioContext.createBufferSource();
                source.buffer = this.laserAudioBuffer;
                source.connect(this.audioContext.destination);
                source.start(0);
            } catch (err) {
                console.warn('Web Audio API laser sound playback error:', err);
            }
            return;
        }

        // Desktop: Use audio pool
        if (!this.laserSoundPool.length) return;
        // Find the next available sound in the pool
        let soundToPlay = null;
        for (let i = 0; i < this.laserSoundPool.length; i++) {
            const sound = this.laserSoundPool[this.currentLaserSoundIndex];
            if (sound.paused || sound.ended) {
                soundToPlay = sound;
                break;
            }
            this.currentLaserSoundIndex = (this.currentLaserSoundIndex + 1) % this.laserSoundPool.length;
        }
        // If no sound is available, use the next one in sequence
        if (!soundToPlay) {
            soundToPlay = this.laserSoundPool[this.currentLaserSoundIndex];
        }
        soundToPlay.currentTime = 0;
        soundToPlay.play().catch(error => {
            console.warn('Error playing laser sound:', error);
        });
        this.currentLaserSoundIndex = (this.currentLaserSoundIndex + 1) % this.laserSoundPool.length;
    }

    initBulletPool() {
        for (let i = 0; i < this.bulletPoolSize; i++) {
            this.bulletPool.push({
                x: 0,
                y: 0,
                speed: 0,
                angle: 0,
                active: false
            });
        }
    }
} 