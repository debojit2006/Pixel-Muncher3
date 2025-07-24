document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const canvas = document.getElementById('gameCanvas');
    const ctx = canvas.getContext('2d');
    const scoreEl = document.getElementById('score');
    const highscoreEl = document.getElementById('highscore');
    const livesEl = document.getElementById('lives');
    const startMenu = document.getElementById('start-menu');
    const gameOverMenu = document.getElementById('game-over-menu');
    const finalScoreEl = document.getElementById('final-score');
    const finalHighscoreEl = a= document.getElementById('final-highscore');
    const gameOverTitleEl = document.getElementById('game-over-title');

    // --- Game Configuration ---
    const TILE_SIZE = 20;
    canvas.width = TILE_SIZE * 20;
    canvas.height = TILE_SIZE * 20;
    const V = 4; // Base Speed Unit
    const PLAYER_SPEED = 0.8 * V;
    let ghostSpeed;

    // --- Maze Layout ---
    const initialMap = [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
        [1,3,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,3,1],
        [1,0,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,0,1,0,1,1,1,1,1,1,0,1,0,1,1,0,1],
        [1,0,0,0,0,1,0,0,0,1,1,0,0,0,1,0,0,0,0,1],
        [1,1,1,1,0,1,1,1,2,1,1,2,1,1,1,0,1,1,1,1],
        [1,1,1,1,0,1,2,9,9,9,9,9,9,2,1,0,1,1,1,1],
        [1,1,1,1,0,1,2,9,1,1,1,1,9,2,1,0,1,1,1,1],
        [0,0,0,0,0,2,2,9,1,2,2,1,9,2,2,0,0,0,0,0],
        [1,1,1,1,0,1,2,9,1,1,1,1,9,2,1,0,1,1,1,1],
        [1,1,1,1,0,1,2,9,9,9,9,9,9,2,1,0,1,1,1,1],
        [1,1,1,1,0,1,2,1,1,1,1,1,1,2,1,0,1,1,1,1],
        [1,0,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1],
        [1,3,1,1,0,1,1,1,0,1,1,0,1,1,1,0,1,1,3,1],
        [1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,1],
        [1,1,0,1,0,1,0,1,1,1,1,1,1,0,1,0,1,0,1,1],
        [1,0,0,0,0,1,0,0,0,1,1,0,0,0,1,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
    ];
    let map;

    // --- Game State ---
    let gameState = 'menu'; // menu, playing, paused, gameOver
    let score, lives, highScore;
    let player, ghost;
    let boundaries, dots, powerPellets;
    let lastKey = '';
    let animationFrameId;

    // --- High Score Management ---
    const loadHighScore = () => {
        const storedHighScore = localStorage.getItem('pixelMuncherHighScore') || '0';
        highScore = parseInt(storedHighScore, 10);
        highscoreEl.textContent = highScore;
    };

    const saveHighScore = () => {
        if (score > highScore) {
            highScore = score;
            localStorage.setItem('pixelMuncherHighScore', highScore);
            highscoreEl.textContent = highScore;
        }
    };

    // --- Classes ---
    class Boundary {
        constructor({ position }) {
            this.position = position;
            this.width = TILE_SIZE;
            this.height = TILE_SIZE;
        }
        draw() {
            ctx.fillStyle = '#3498db'; // Wall color
            ctx.fillRect(this.position.x, this.position.y, this.width, this.height);
        }
    }

    class Character {
        constructor({ position, velocity, color }) {
            this.position = position;
            this.velocity = velocity;
            this.radius = TILE_SIZE / 2.5;
            this.color = color;
            this.prevCollisions = [];
        }

        draw() {
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.closePath();
        }

        update() {
            this.draw();
            this.position.x += this.velocity.x;
            this.position.y += this.velocity.y;
        }
    }
    
    class Player extends Character {
        constructor(options) {
            super(options);
            this.speed = PLAYER_SPEED;
        }
    }

    class Ghost extends Character {
        constructor(options) {
            super(options);
            this.speed = options.speed;
        }

        update() {
            this.aiMove();
            super.update();
        }

        aiMove() {
            const collisions = [];
            boundaries.forEach(boundary => {
                // Check for potential collisions in all 4 directions
                const directions = [
                    { x: 0, y: -this.speed }, // Up
                    { x: this.speed, y: 0 },  // Right
                    { x: 0, y: this.speed },  // Down
                    { x: -this.speed, y: 0 }  // Left
                ];
                directions.forEach(dir => {
                    if (!this.isCollidingWithBoundary(boundary, { ...this, velocity: dir })) {
                        collisions.push(dir);
                    }
                });
            });
            
            // Filter out the direction the ghost just came from
            if (this.prevCollisions.length > 2) {
                const oppositeDirection = { x: -this.velocity.x, y: -this.velocity.y };
                const pathways = this.prevCollisions.filter(collision => {
                    return (collision.x !== oppositeDirection.x || collision.y !== oppositeDirection.y);
                });
                this.prevCollisions = pathways;
            } else {
                 this.prevCollisions = collisions.filter((value, index, self) =>
                    index === self.findIndex((t) => (t.x === value.x && t.y === value.y))
                );
            }

            // At an intersection, decide where to go
            if (this.prevCollisions.length > 1) {
                let bestPath = this.prevCollisions[0];
                let minDistance = Infinity;

                this.prevCollisions.forEach(path => {
                    const futureX = this.position.x + path.x;
                    const futureY = this.position.y + path.y;
                    const distance = Math.hypot(player.position.x - futureX, player.position.y - futureY);

                    if (distance < minDistance) {
                        minDistance = distance;
                        bestPath = path;
                    }
                });
                this.velocity = bestPath;
            }
        }
        
        isCollidingWithBoundary(boundary, character) {
             const padding = TILE_SIZE / 2 - character.radius - 1;
             return (
                character.position.y - character.radius + character.velocity.y <= boundary.position.y + boundary.height + padding &&
                character.position.x + character.radius + character.velocity.x >= boundary.position.x - padding &&
                character.position.y + character.radius + character.velocity.y >= boundary.position.y - padding &&
                character.position.x - character.radius + character.velocity.x <= boundary.position.x + boundary.width + padding
            );
        }
    }

    class Pellet {
        constructor({ position, color, radius }) {
            this.position = position;
            this.radius = radius;
            this.color = color;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.position.x, this.position.y, this.radius, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            ctx.closePath();
        }
    }


    // --- Game Setup Functions ---
    const createMap = () => {
        map = initialMap.map(row => [...row]); // Create a mutable copy
        boundaries = [];
        dots = [];
        powerPellets = [];
        map.forEach((row, i) => {
            row.forEach((symbol, j) => {
                const position = {
                    x: TILE_SIZE * j + TILE_SIZE / 2,
                    y: TILE_SIZE * i + TILE_SIZE / 2
                };
                switch (symbol) {
                    case 1: // Wall
                        boundaries.push(new Boundary({ position: { x: TILE_SIZE * j, y: TILE_SIZE * i } }));
                        break;
                    case 0: // Dot
                        dots.push(new Pellet({ position, color: '#ecf0f1', radius: 3 }));
                        break;
                    case 3: // Power Pellet
                        powerPellets.push(new Pellet({ position, color: '#f1c40f', radius: 8 }));
                        break;
                }
            });
        });
    };
    
    const initGame = (difficulty) => {
        gameState = 'playing';
        startMenu.classList.add('hidden');
        
        // Set ghost speed based on difficulty
        if (difficulty === 'easy') {
            ghostSpeed = 0.75 * V * 0.75;
        } else { // hard
            ghostSpeed = 0.75 * V * 1.25;
        }

        score = 0;
        lives = 3;
        lastKey = '';
        updateUI();
        createMap();

        player = new Player({
            position: { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 },
            velocity: { x: 0, y: 0 },
            color: '#f1c40f'
        });

        ghost = new Ghost({
            position: { x: TILE_SIZE * 10.5, y: TILE_SIZE * 9.5 },
            velocity: { x: 0, y: -ghostSpeed },
            color: '#e74c3c',
            speed: ghostSpeed
        });
        
        if (animationFrameId) cancelAnimationFrame(animationFrameId);
        animate();
    };
    
    const resetPlayerAndGhost = () => {
        player.position = { x: TILE_SIZE * 1.5, y: TILE_SIZE * 1.5 };
        player.velocity = { x: 0, y: 0 };
        ghost.position = { x: TILE_SIZE * 10.5, y: TILE_SIZE * 9.5 };
        ghost.velocity = { x: 0, y: -ghostSpeed };
        lastKey = '';
    };

    // --- Collision Detection ---
    const circleCollidesWithRectangle = ({ circle, rectangle }) => {
        const padding = TILE_SIZE / 2 - circle.radius - 1;
        return (
            circle.position.y - circle.radius + circle.velocity.y <= rectangle.position.y + rectangle.height + padding &&
            circle.position.x + circle.radius + circle.velocity.x >= rectangle.position.x - padding &&
            circle.position.y + circle.radius + circle.velocity.y >= rectangle.position.y - padding &&
            circle.position.x - circle.radius + circle.velocity.x <= rectangle.position.x + rectangle.width + padding
        );
    };

    // --- UI Update ---
    const updateUI = () => {
        scoreEl.textContent = score;
        livesEl.textContent = '♥ '.repeat(lives).trim();
    };

    // --- Game Loop ---
    const animate = () => {
        animationFrameId = requestAnimationFrame(animate);
        if (gameState !== 'playing') return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // --- Handle Buffered Input ---
        if (lastKey) {
             const newVelocity = getVelocityForKey(lastKey);
             const potentialPlayer = { ...player, velocity: newVelocity };
             let collisionDetected = false;
             for (const boundary of boundaries) {
                 if (circleCollidesWithRectangle({ circle: potentialPlayer, rectangle: boundary })) {
                     collisionDetected = true;
                     break;
                 }
             }
             if (!collisionDetected) {
                 player.velocity = newVelocity;
             }
        }
        
        // Check for wall collisions for the current path
        for (const boundary of boundaries) {
            if (circleCollidesWithRectangle({ circle: player, rectangle: boundary })) {
                player.velocity.x = 0;
                player.velocity.y = 0;
                break;
            }
        }

        // Draw boundaries
        boundaries.forEach(boundary => boundary.draw());
        
        // Eat dots
        for (let i = dots.length - 1; i >= 0; i--) {
            const dot = dots[i];
            dot.draw();
            if (Math.hypot(dot.position.x - player.position.x, dot.position.y - player.position.y) < dot.radius + player.radius) {
                dots.splice(i, 1);
                score += 10;
                updateUI();
            }
        }

        // Eat power pellets
        for (let i = powerPellets.length - 1; i >= 0; i--) {
            const pellet = powerPellets[i];
            pellet.draw();
            if (Math.hypot(pellet.position.x - player.position.x, pellet.position.y - player.position.y) < pellet.radius + player.radius) {
                powerPellets.splice(i, 1);
                score += 50;
                updateUI();
                // Note: Ghost frightening logic would go here
            }
        }

        player.update();
        ghost.update();
        
        // Ghost collision
        if (Math.hypot(ghost.position.x - player.position.x, ghost.position.y - player.position.y) < ghost.radius + player.radius) {
            lives--;
            updateUI();
            if (lives <= 0) {
                endGame(false); // Game Over
            } else {
                gameState = 'paused';
                setTimeout(() => {
                    resetPlayerAndGhost();
                    gameState = 'playing';
                }, 1500); // Pause for 1.5 seconds
            }
        }

        // Win condition
        if (dots.length === 0 && powerPellets.length === 0) {
            endGame(true); // You Win!
        }
    };
    
    // --- End Game ---
    const endGame = (isWin) => {
        gameState = 'gameOver';
        cancelAnimationFrame(animationFrameId);
        saveHighScore();
        
        gameOverTitleEl.textContent = isWin ? "YOU WIN!" : "GAME OVER";
        finalScoreEl.textContent = score;
        finalHighscoreEl.textContent = highScore;
        gameOverMenu.classList.remove('hidden');
    };

    // --- Controls ---
    const getVelocityForKey = (key) => {
        switch (key) {
            case 'w':
            case 'ArrowUp': return { x: 0, y: -PLAYER_SPEED };
            case 'a':
            case 'ArrowLeft': return { x: -PLAYER_SPEED, y: 0 };
            case 's':
            case 'ArrowDown': return { x: 0, y: PLAYER_SPEED };
            case 'd':
            case 'ArrowRight': return { x: PLAYER_SPEED, y: 0 };
            default: return { x: 0, y: 0 };
        }
    };

    window.addEventListener('keydown', (e) => {
        if (['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            lastKey = e.key;
        }
    });

    // Mobile swipe controls
    let touchStartX = 0;
    let touchStartY = 0;
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        handleSwipe(touchEndX - touchStartX, touchEndY - touchStartY);
    }, { passive: false });

    function handleSwipe(dx, dy) {
        const absDx = Math.abs(dx);
        const absDy = Math.abs(dy);

        if (Math.max(absDx, absDy) < 30) return; // Ignore small taps

        if (absDx > absDy) {
            lastKey = dx > 0 ? 'd' : 'a'; // 'd' is ArrowRight, 'a' is ArrowLeft
        } else {
            lastKey = dy > 0 ? 's' : 'w'; // 's' is ArrowDown, 'w' is ArrowUp
        }
    }
    
    // --- Event Listeners for Menus ---
    document.getElementById('easy-btn').addEventListener('click', () => initGame('easy'));
    document.getElementById('hard-btn').addEventListener('click', () => initGame('hard'));
    document.getElementById('play-again-btn').addEventListener('click', () => {
        gameOverMenu.classList.add('hidden');
        startMenu.classList.remove('hidden');
        gameState = 'menu';
        loadHighScore(); // Refresh high score display on menu
    });
    
    // --- Initial Load ---
    loadHighScore();
});
