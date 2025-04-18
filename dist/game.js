// --- SUPABASE SETUP --- 
const SUPABASE_URL = 'https://pdrsqbwqkgoqlmaqqraz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBkcnNxYndxa2dvcWxtYXFxcmF6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ5NjI4MDEsImV4cCI6MjA2MDUzODgwMX0._JOdIOhJXDyDjSE8CTjg0GzCKws5hbh8bsuhusoXAiw';

// Initialize Supabase client
let supabase = null;
try {
    // Wait for Supabase to be available
    if (typeof supabaseClient !== 'undefined') {
        supabase = supabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else if (typeof window.supabase !== 'undefined') {
        supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
        throw new Error('Supabase client not available');
    }
    console.log('Supabase client initialized successfully');
} catch (error) {
    console.error('Error initializing Supabase client:', error);
    supabase = null; // Ensure it's null if initialization failed
}

// Test the connection
async function testSupabaseConnection() {
    if (!supabase) {
        console.error('Cannot test connection: Supabase client not initialized');
        return;
    }
    try {
        const { data, error } = await supabase
            .from('leaderboard')
            .select('count')
            .limit(1);
            
        if (error) {
            console.error('Supabase connection test failed:', error);
        } else {
            console.log('Supabase connection test successful');
        }
    } catch (error) {
        console.error('Error testing Supabase connection:', error);
    }
}

// Run the test when initializing
testSupabaseConnection();
// ------------------------

class SpaceShooter {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
        
        // Image assets (Replace placeholders with your actual file paths)
        this.assetPaths = {
            player: './assets/player.png', 
            enemy: './assets/enemy.png',   
            star: './assets/star.png',     
            bullet: './assets/bullet.png', 
            background: './assets/background.png' 
        };
        this.assets = {}; // To store loaded Image objects
        this.assetsLoaded = 0;
        this.totalAssets = Object.keys(this.assetPaths).length;
        
        // Audio elements
        this.backgroundMusic = document.getElementById('backgroundMusic');
        this.musicToggleBtn = document.getElementById('musicToggleBtn');
        this.laserSound = document.getElementById('laserSound');
        this.isMusicPlaying = false; // Track music state
        this.soundEnabled = true; // Track sound effects state
        
        this.player = {
            x: this.canvas.width / 2,
            y: this.canvas.height - 50,
            size: 55, // Increased from 40 to 55
        };
        
        this.bullets = [];
        this.enemies = [];
        this.stars = [];
        this.score = 0;
        this.lastScore = 0; // To hold score before submitting to DB
        this.level = 1;
        this.gameTime = 0;
        this.timeLeft = 60; // 60 seconds timer
        this.isGameOver = false;
        this.isTriviaActive = false; // New property to track trivia state
        this.hasActiveStar = false;
        this.lastStarSpawnTime = 0;
        this.isShooting = false;
        this.shootTimeoutId = null; // To manage the shooting timeout
        this.animationFrameId = null; // To manage the game loop
        
        // UI Elements for Score Modal
        this.saveScoreModal = document.getElementById('saveScoreModal');
        this.saveScoreForm = document.getElementById('saveScoreForm');
        this.cancelScoreBtn = document.getElementById('cancelScoreBtn');
        this.finalScoreDisplay = document.getElementById('finalScoreDisplay');
        
        this.triviaSystem = new TriviaSystem();
        
        this.loadAssets(); // Start loading assets
        
        this.setupEventListeners();
        this.updateLeaderboardDisplay(false); // Update leaderboard on initial load (no await/catch needed now)
        this.setupMusic(); // Setup initial music state
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
            this.player.y = this.canvas.height - 50; // Keep player near bottom
            // Ensure player stays within bounds after resize
            this.player.x = Math.min(Math.max(this.player.x, this.player.size/2), this.canvas.width - this.player.size/2);
        }

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

        // Initialize player position
        this.player.x = this.canvas.width / 2;
        this.player.y = this.canvas.height - 50;
        
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
        // Clear previous timeout just in case
        if (this.shootTimeoutId) {
            clearTimeout(this.shootTimeoutId);
        }

        if (this.isShooting && !this.isGameOver && !this.isTriviaActive) {
            this.bullets.push({
                x: this.player.x,
                y: this.player.y,
                speed: 5
            });

            // Play shooting sound if sound is enabled
            if (this.soundEnabled && this.laserSound) {
                // Reset the sound to the beginning if it's already playing
                this.laserSound.currentTime = 0;
                // Set volume for the laser sound (adjust as needed)
                this.laserSound.volume = 0.3;
                // Play the sound
                this.laserSound.play().catch(error => {
                    console.warn('Error playing laser sound:', error);
                });
            }

            // Set new timeout
            this.shootTimeoutId = setTimeout(() => this.shoot(), 200);
        }
    }

    spawnEnemy() {
        const size = 40;
        this.enemies.push({
            x: Math.random() * (this.canvas.width - size),
            y: -size,
            size: size,
            speed: 1 + this.level * 0.5
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

        this.gameTime += 16;
        const levelTime = this.gameTime / 60000;

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

        // Spawn enemies
        if (Math.random() < 0.02 * this.level) {
            this.spawnEnemy();
        }

        // Spawn stars every 10-15 seconds if no active star
        if (!this.hasActiveStar && this.gameTime - this.lastStarSpawnTime > 10000) {
            if (Math.random() < 0.1) { // 10% chance to spawn a star each frame after 10 seconds
                this.spawnStar();
            }
        }

        // Update bullets
        this.bullets = this.bullets.filter(bullet => {
            bullet.y -= bullet.speed;
            return bullet.y > 0;
        });

        // Update enemies
        this.enemies = this.enemies.filter(enemy => {
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
                    this.score += 10;
                    this.updateScore();
                    this.createPointPopup(enemy.x, enemy.y, '+10', '#00ff00');
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
                    
                    // --- Pause game for trivia --- 
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
                    // --------------------------

                    this.hasActiveStar = false;
                    this.triviaSystem.showQuestion((isCorrect) => {
                        console.log('Trivia answered. Correct:', isCorrect);
                        if (isCorrect) {
                            this.score += 50;
                            this.updateScore();
                            this.createPointPopup(star.x, star.y, '+50', '#ffff00');
                        }
                        // --- Resume game after trivia --- 
                        this.isTriviaActive = false;
                        console.log('Resuming game after trivia...');
                        this.gameLoop(); // Restart the game loop
                        // -------------------------------
                    });
                    return false;
                }
            }
            
            return true;
        });

        if (levelTime > this.level) {
            this.level++;
        }
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

        // Draw Background
        if (this.assets.background) {
            this.ctx.drawImage(this.assets.background, 0, 0, this.canvas.width, this.canvas.height);
        } else {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

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

        // Draw Bullets
        if (this.assets.bullet) {
            this.bullets.forEach(bullet => {
                const bulletSize = 20; // Increased from 10 to 20
                this.ctx.drawImage(
                    this.assets.bullet, 
                    bullet.x - bulletSize / 2, 
                    bullet.y - bulletSize / 2, 
                    bulletSize, 
                    bulletSize
                );
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

        leaderboardList.innerHTML = '<li>Loading...</li>'; 
        leaderboardList.style.listStyleType = 'none'; // Hide numbers while loading

        // Call the async function and handle its result with .then()
        this.getLeaderboard().then(scores => {
            // This code runs once the scores are fetched
            leaderboardList.innerHTML = ''; // Clear loading/existing list

            if (!supabase) {
                leaderboardList.innerHTML = '<li>Leaderboard disabled (Supabase not configured).</li>';
                leaderboardList.style.listStyleType = 'none';
                return;
            }

            if (scores.length === 0) {
                leaderboardList.innerHTML = '<li>No scores yet! Play a game.</li>';
                leaderboardList.style.listStyleType = 'none';
            } else {
                leaderboardList.style.listStyleType = 'decimal';
                scores.forEach((entry) => { 
                    const li = document.createElement('li');
                    const date = new Date(entry.created_at).toLocaleDateString();
                    li.textContent = `${entry.score} - ${entry.nickname} (${date})`; 
                    leaderboardList.appendChild(li);
                });
            }

            // Update high score display (this is synchronous)
            const highScoreDisplay = document.getElementById('highScore');
            if (highScoreDisplay && scores.length > 0) {
                highScoreDisplay.textContent = scores[0].score;
            }

        }).catch(error => {
            console.error("Failed to update leaderboard display:", error);
            leaderboardList.innerHTML = '<li>Error loading leaderboard.</li>';
            leaderboardList.style.listStyleType = 'none';
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
        
        // Check if audio elements exist
        if (!this.backgroundMusic) {
            console.error('Background music element not found');
            return;
        }

        if (!this.laserSound) {
            console.error('Laser sound element not found');
            // Don't return here as we can still proceed without the laser sound
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
}

// Initialize the game when the page loads
window.addEventListener('load', () => {
    console.log('Window loaded, checking Supabase...');
    if (typeof window.supabase !== 'undefined') {
        console.log('Supabase library loaded, initializing game...');
        try {
            window.spaceShooterGame = new SpaceShooter();
            console.log('Game initialized successfully');
        } catch (error) {
            console.error('Error initializing game:', error);
        }
    } else {
        console.error('Supabase library not found! Make sure the script is loaded correctly.');
    }
}); 