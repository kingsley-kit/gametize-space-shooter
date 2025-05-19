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
        this.ctx = this.canvas.getContext('2d');
        
        // Initialize star system first
        this.backgroundStars = {
            small: [],
            medium: [],
            large: []
        };
        
        // Star configuration
        this.starConfig = {
            small: { count: 100, size: 1, speed: 1, color: 'rgba(255, 255, 255, 0.5)' },
            medium: { count: 50, size: 1.5, speed: 2, color: 'rgba(255, 255, 255, 0.7)' },
            large: { count: 25, size: 2, speed: 3, color: 'rgba(255, 255, 255, 0.9)' }
        };

        // Initialize canvas and other properties
        this.resizeCanvas();
        
        // Image assets
        this.assetPaths = {
            player: './assets/player.png', 
            enemy: './assets/enemy.png',   
            star: './assets/star.png',     
            bullet: './assets/bullet.png', 
            background: './assets/background.png',
            powerup: './assets/powerup.png'
        };
        this.assets = {}; 
        this.assetsLoaded = 0;
        this.totalAssets = Object.keys(this.assetPaths).length;
        
        // Audio elements
        this.backgroundMusic = document.getElementById('backgroundMusic');
        this.musicToggleBtn = document.getElementById('musicToggleBtn');
        this.laserSound = document.getElementById('laserSound');
        this.powerupSound = document.getElementById('powerupSound');
        this.startGameSound = document.getElementById('startGameSound');
        this.isMusicPlaying = false;
        this.soundEnabled = true;
        
        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 80,
            size: 55,
            flames: []
        };
        
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
        
        this.loadAssets();
        this.setupEventListeners();
        this.updateLeaderboardDisplay(false);
        this.setupMusic();
        this.setupFlames();
    }

    resizeCanvas() {
        // Get the container dimensions
        const container = this.canvas.parentElement;
        const containerWidth = container.offsetWidth;
        const containerHeight = container.offsetHeight;

        // Set canvas size to match container while maintaining 4:5 aspect ratio
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;

        // Update player position when canvas is resized
        if (this.player) {
            // Keep player higher from bottom on mobile
            const isMobile = window.innerWidth <= 480;
            this.player.y = this.canvas.height - (isMobile ? 80 : 50);
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
            this.assets[key].onload = () => {
                this.assetsLoaded++;
                console.log(`Asset loaded: ${key} (${this.assetsLoaded}/${this.totalAssets})`);
                if (this.assetsLoaded === this.totalAssets) {
                    console.log('All assets loaded!');
                    // You could trigger an event or set a flag here if needed
                    // For now, we assume the home screen waits for user input
                }
            };
            this.assets[key].onerror = () => {
                console.error(`Failed to load asset: ${key} at ${this.assetPaths[key]}`);
                 // Optionally handle error, e.g., use fallback shapes
            };
            this.assets[key].src = this.assetPaths[key];
        }
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
        
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isGameOver && !this.isTriviaActive) {
                const rect = this.canvas.getBoundingClientRect();
                this.player.x = e.clientX - rect.left;
            }
        });

        this.canvas.addEventListener('mousedown', () => this.startShooting());
        this.canvas.addEventListener('mouseup', () => this.stopShooting());
        this.canvas.addEventListener('mouseleave', () => this.stopShooting());

        this.canvas.addEventListener('touchmove', (e) => {
            if (!this.isGameOver && !this.isTriviaActive) {
                e.preventDefault();
                const rect = this.canvas.getBoundingClientRect();
                this.player.x = e.touches[0].clientX - rect.left;
            }
        });

        this.canvas.addEventListener('touchstart', () => this.startShooting());
        this.canvas.addEventListener('touchend', () => this.stopShooting());

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
        this.player.y = this.canvas.height - (isMobile ? 80 : 50);
        
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
        this.ctx.shadowColor = '#000';
        this.ctx.shadowBlur = 10;
        this.ctx.fillText('GAME OVER', this.canvas.width / 2, this.canvas.height / 2 - 40);
        
        this.ctx.fillStyle = '#ffffff'; // White score text
        this.ctx.font = 'bold 30px Arial';
        this.ctx.shadowBlur = 5;
        this.ctx.fillText(`Final Score: ${this.score}`, this.canvas.width / 2, this.canvas.height / 2 + 30);
        this.ctx.restore();
        // ------------------------------

        // Show score submission prompt after a delay
        setTimeout(() => {
            this.promptToSaveScore(); 
        }, 2000); // Show Game Over for 2 seconds before prompt

        // Hide flames
        if (this.player.flames && this.player.flames.container) {
            this.player.flames.container.style.display = 'none';
        }
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
                this.bullets.push({
                    x: this.player.x,
                    y: this.player.y,
                    speed: 5,
                    angle: -0.2 // Left bullet
                });
                this.bullets.push({
                    x: this.player.x,
                    y: this.player.y,
                    speed: 5,
                    angle: 0 // Center bullet
                });
                this.bullets.push({
                    x: this.player.x,
                    y: this.player.y,
                    speed: 5,
                    angle: 0.2 // Right bullet
                });
            } else {
                // Normal single bullet
                this.bullets.push({
                    x: this.player.x,
                    y: this.player.y,
                    speed: 5,
                    angle: 0
                });
            }

            if (this.soundEnabled && this.laserSound) {
                const laser = this.laserSound.cloneNode();
                this.laserSound.volume = 0.3;
                laser.play().catch(error => {
                    console.warn('Error playing laser sound:', error);
                });
            }

            this.shootTimeoutId = setTimeout(() => this.shoot(), 200);
        }
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
        const gameArea = document.querySelector('.game-area');
        if (!gameArea) return;

        const popup = document.createElement('div');
        popup.className = 'point-popup';
        popup.textContent = `+${points}`;
        popup.style.left = `${x}px`;
        popup.style.top = `${y}px`;

        // Use gold color for +50 from stars, green for +10 from enemies
        if (points === 50) {
            popup.style.color = '#FFD700'; // Gold for star bonus
        } else {
            popup.style.color = '#00ff00'; // Green for enemy score
        }

        gameArea.appendChild(popup);

        // Remove the element after the animation finishes
        popup.addEventListener('animationend', () => {
            popup.remove();
        });
    }

    update() {
        if (this.isGameOver || this.isTriviaActive) return;

        // Update starfield
        this.updateStarfield();
        
        this.gameTime += 16;

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

        // Update bullets with angles
        this.bullets = this.bullets.filter(bullet => {
            bullet.x += Math.sin(bullet.angle) * bullet.speed * 3;
            bullet.y -= bullet.speed;
            return bullet.y > 0 && bullet.x > 0 && bullet.x < this.canvas.width;
        });

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
                    this.bullets.splice(i, 1);
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
                    this.bullets.splice(i, 1);
                    
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

        // Update flames position
        this.updateFlamesPosition();
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
        if (this.isTriviaActive) return;
        if (this.assetsLoaded !== this.totalAssets) return;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw solid background
        this.ctx.fillStyle = '#000033'; // Dark blue background
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw starfield before other elements
        this.drawStarfield();

        // Draw Player
        if (this.assets.player) {
            this.ctx.drawImage(
                this.assets.player, 
                this.player.x - this.player.size / 2,
                this.player.y - this.player.size / 2, 
                this.player.size, 
                this.player.size
            );
        }

        // Draw power-ups
        if (this.assets.powerup) {
            this.powerups.forEach(powerup => {
                this.ctx.drawImage(
                    this.assets.powerup,
                    powerup.x - powerup.size / 5,
                    powerup.y - powerup.size / 5,
                    powerup.size,
                    powerup.size
                );
            });
        }

        // Draw bullets with rotation based on angle
        if (this.assets.bullet) {
            this.bullets.forEach(bullet => {
                const bulletSize = 20;
                this.ctx.save();
                this.ctx.translate(bullet.x, bullet.y);
                this.ctx.rotate(bullet.angle);
                this.ctx.drawImage(
                    this.assets.bullet,
                    -bulletSize / 2,
                    -bulletSize / 2,
                    bulletSize,
                    bulletSize
                );
                this.ctx.restore();
            });
        } else { // Fallback shapes
             this.ctx.fillStyle = '#ffff00';
             this.bullets.forEach(bullet => {
                 this.ctx.beginPath();
                 this.ctx.arc(bullet.x, bullet.y, 10, 0, Math.PI * 2); // Increased from 5 to 10
                 this.ctx.fill();
             });
        }

        // Draw Enemies
        if (this.assets.enemy) {
            this.enemies.forEach(enemy => {
                this.ctx.drawImage(
                    this.assets.enemy, 
                    enemy.x - enemy.size / 2, 
                    enemy.y - enemy.size / 2, 
                    enemy.size, 
                    enemy.size
                );
            });
        } // Add fallback shape drawing if needed

        // Draw Stars
        if (this.assets.star) {
             this.stars.forEach(star => {
                this.ctx.drawImage(
                    this.assets.star, 
                    star.x - star.size / 2, 
                    star.y - star.size / 2, 
                    star.size, 
                    star.size
                );
                // Optional: Add glow effect over the image if desired
            });
        } // Add fallback shape drawing if needed

        // Draw power-up status if active
        if (this.hasMultiShot) {
            const timeLeft = Math.ceil((this.multiShotEndTime - this.gameTime) / 1000);
            this.ctx.fillStyle = '#ffff00';
            this.ctx.font = '20px Arial';
            this.ctx.fillText(`Multi-shot: ${timeLeft}s`, 10, 80);
        }
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
        if (this.isGameOver || this.isTriviaActive) { // Check trivia state
             console.log(`Game loop stopped: isGameOver=${this.isGameOver}, isTriviaActive=${this.isTriviaActive}`);
             return;
        }

        this.update();
        this.draw();
        this.animationFrameId = requestAnimationFrame(() => this.gameLoop());
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

    setupFlames() {
        // Create container for flames
        const gameArea = document.querySelector('.game-area');
        if (!gameArea) {
            console.error('Game area not found');
            return;
        }

        // Remove any existing flame container
        const existingContainer = gameArea.querySelector('.flame-container');
        if (existingContainer) {
            existingContainer.remove();
        }

        const flameContainer = document.createElement('div');
        flameContainer.className = 'flame-container';
        flameContainer.style.position = 'absolute';
        flameContainer.style.width = '100%';
        flameContainer.style.height = '100%';
        flameContainer.style.pointerEvents = 'none';
        flameContainer.style.zIndex = '1'; // Ensure container is visible
        gameArea.appendChild(flameContainer);

        // Create flames
        const centerFlame = document.createElement('div');
        centerFlame.className = 'flame center';
        flameContainer.appendChild(centerFlame);

        const leftFlame = document.createElement('div');
        leftFlame.className = 'flame side';
        flameContainer.appendChild(leftFlame);

        const rightFlame = document.createElement('div');
        rightFlame.className = 'flame side';
        flameContainer.appendChild(rightFlame);

        this.player.flames = {
            container: flameContainer,
            center: centerFlame,
            left: leftFlame,
            right: rightFlame
        };

        // Log to confirm setup
        console.log('Flames setup complete', this.player.flames);
    }

    updateFlamesPosition() {
        if (!this.player.flames) {
            console.log('No flames to update');
            return;
        }

        // Calculate base size relative to player size
        const playerSize = this.player.size;
        const flameBaseSize = playerSize * 0.15; // Flame size relative to player

        // Position flames relative to player's center and size
        const playerCenterX = this.player.x;
        const playerBottomY = this.player.y + (playerSize / 2) - 2;

        // Center flame
        const centerFlame = this.player.flames.center;
        centerFlame.style.left = `${playerCenterX - (playerSize * 0.10)}px`;
        centerFlame.style.top = `${playerBottomY}px`;
        centerFlame.style.width = `${flameBaseSize * 1.25}px`; // Center flame slightly larger
        centerFlame.style.height = `${flameBaseSize * 2}px`;
        centerFlame.style.transform = 'translate(-50%, 0)';

        // Left flame
        const leftFlame = this.player.flames.left;
        leftFlame.style.left = `${playerCenterX - (playerSize * 0.35)}px`;
        leftFlame.style.top = `${playerBottomY}px`;
        leftFlame.style.width = `${flameBaseSize}px`;
        leftFlame.style.height = `${flameBaseSize * 1.75}px`;
        leftFlame.style.transform = 'translate(-50%, 0)';

        // Right flame
        const rightFlame = this.player.flames.right;
        rightFlame.style.left = `${playerCenterX + (playerSize * 0.20)}px`;
        rightFlame.style.top = `${playerBottomY}px`;
        rightFlame.style.width = `${flameBaseSize}px`;
        rightFlame.style.height = `${flameBaseSize * 1.75}px`;
        rightFlame.style.transform = 'translate(-50%, 0)';
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
        const size = 30;
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
        this.multiShotEndTime = this.gameTime + 5000; // 5 seconds duration
        
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
} 