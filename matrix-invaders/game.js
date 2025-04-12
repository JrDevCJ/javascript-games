class GameObject {
  constructor(x, y, width, height, color) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.color = color;
  }

  draw(ctx) {
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.width, this.height);
  }
}

class MatrixTextObject extends GameObject {
  constructor(x, y, width, height, color, chars, fontStyle) {
    super(x, y, width, height, color);
    this.chars = chars;
    this.fontStyle = fontStyle;
  }

  draw(ctx) {
    const charWidth = this.width / this.chars.length;
    const charHeight = this.height;
    ctx.font = `${charHeight}px ${this.fontStyle}`;
    ctx.textAlign = "center";
    this.chars.forEach((char, index) => {
      ctx.fillStyle = this.color;
      ctx.fillText(
        char,
        this.x + (index + 0.5) * charWidth,
        this.y + charHeight * 0.8
      );
    });
  }
}

class Player extends MatrixTextObject {
  constructor(
    x,
    y,
    width,
    height,
    color,
    chars,
    fontStyle,
    speed,
    canvasWidth
  ) {
    super(x, y, width, height, color, chars, fontStyle);
    this.speed = speed;
    this.canvasWidth = canvasWidth;
  }

  moveLeft() {
    if (this.x > 0) {
      this.x -= this.speed;
    }
  }

  moveRight() {
    if (this.x < this.canvasWidth - this.width) {
      this.x += this.speed;
    }
  }
}

class Bullet extends MatrixTextObject {
  constructor(x, y, width, height, color, char, fontStyle, speed) {
    super(x, y, width, height, color, [char], fontStyle);
    this.speed = speed;
  }

  update() {
    this.y -= this.speed;
  }
}

class Alien extends MatrixTextObject {
  constructor(x, y, width, height, color, chars, fontStyle, speedX) {
    super(x, y, width, height, color, chars, fontStyle);
    this.speedX = speedX;
    this.alive = true;
  }

  move(direction, speedY) {
    this.x += this.speedX * direction;
    this.y += speedY;
  }
}

class Game {
  constructor(config) {
    this.canvas = document.getElementById("gameCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.overlay = document.getElementById("overlay");
    this.messageDisplay = document.getElementById("message");
    this.restartButton = document.getElementById("restartButton");
    this.playAgainButton = document.getElementById("playAgainButton");
    this.highScoresDiv = document.getElementById("highScores");
    this.highScoreList = document.getElementById("highScoreList");
    this.shootSound = document.getElementById("shootSound");
    this.explosionSound = document.getElementById("explosionSound");
    this.winSound = document.getElementById("winSound");
    this.loseSound = document.getElementById("loseSound");
    this.levelUpSound = document.getElementById("levelUpSound");
    this.backgroundSound = document.getElementById("backgroundSound");

    this.config = { ...config }; // Create a copy to avoid direct modification
    this.canvas.width = this.config.canvasWidth;
    this.canvas.height = this.config.canvasHeight;

    this.alienDirection = 1;
    this.score = 0;
    this.gameActive = true;
    this.level = 1;
    this.player = this.createPlayer();
    this.bullets = [];
    this.aliens = [];
    this.highScores = this.loadHighScores();
    this.keys = {};

    this.shootSound.volume = 0.3;
    this.explosionSound.volume = 0.2;
    this.winSound.volume = 0.3;
    this.loseSound.volume = 0.3;
    this.levelUpSound.volume = 0.3;
    this.backgroundSound.volume = 0.3;
    this.backgroundSound.play();

    this.setupEventListeners();
    this.resetLevel();
    this.update();
  }

  createPlayer() {
    return new Player(
      this.config.canvasWidth / 2 - 20,
      this.config.canvasHeight - 30,
      40,
      20,
      this.config.matrixColor,
      this.config.playerChars,
      this.config.fontStyle,
      this.config.playerSpeed,
      this.config.canvasWidth
    );
  }

  createAlien(x, y) {
    return new Alien(
      x,
      y,
      30,
      20,
      this.config.matrixColor,
      this.config.alienChars,
      this.config.fontStyle,
      this.config.alienSpeedX
    );
  }

  createAliens() {
    this.aliens.length = 0;
    const rows =
      this.config.initialAlienRows + Math.floor((this.level - 1) * 0.5);
    const cols = this.config.aliensPerRow + Math.floor((this.level - 1) * 0.2);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        this.aliens.push(this.createAlien(30 + col * 50, 30 + row * 40));
      }
    }
    this.alienDirection = 1;
  }

  resetLevel() {
    this.bullets = [];
    this.createAliens();
  }

  loadHighScores() {
    const scoresString = localStorage.getItem(this.config.highScoreStorageKey);
    return scoresString ? JSON.parse(scoresString) : [];
  }

  saveHighScores() {
    this.highScores.sort((a, b) => b - a);
    this.highScores = this.highScores.slice(0, this.config.maxHighScores);
    localStorage.setItem(
      this.config.highScoreStorageKey,
      JSON.stringify(this.highScores)
    );
  }

  getTopFiveHighScores() {
    return this.highScores.slice(0, 5);
  }

  displayHighScores() {
    this.highScoreList.innerHTML = "";
    const topFiveScores = this.getTopFiveHighScores();
    topFiveScores.forEach((score, index) => {
      const listItem = document.createElement("li");
      listItem.textContent = `${index + 1}. ${score}`;
      this.highScoreList.appendChild(listItem);
    });
    this.messageDisplay.style.display = "none";
    this.highScoresDiv.style.display = "flex";
    this.restartButton.style.display = "none";
    this.playAgainButton.style.display = "block";
  }

  getRank() {
    for (const threshold in this.config.rankThresholds) {
      if (this.score < parseInt(threshold)) {
        return this.config.rankThresholds[
          threshold === "Infinity"
            ? Object.keys(this.config.rankThresholds)[
                Object.keys(this.config.rankThresholds).length - 2
              ]
            : threshold
        ];
      }
    }
    return this.config.rankThresholds.Infinity;
  }

  createBullet() {
    if (this.gameActive) {
      this.bullets.push(
        new Bullet(
          this.player.x + this.player.width / 2 - 5,
          this.player.y - 10,
          10,
          15,
          this.config.matrixColor,
          this.config.bulletChar,
          this.config.fontStyle,
          this.config.bulletSpeed
        )
      );
      this.playSound(this.shootSound);
    }
  }

  showMessage(message, sound) {
    this.gameActive = false;
    this.messageDisplay.textContent = message;
    this.messageDisplay.style.display = "block";
    this.highScoresDiv.style.display = "none";
    this.restartButton.style.display = "block";
    this.playAgainButton.style.display = "none";
    this.overlay.style.display = "flex";
    if (sound) {
      this.playSound(sound);
    }
  }

  nextLevel() {
    this.level++;
    if (this.level > this.config.maxLevels) {
      this.gameActive = false;
      this.highScores.push(this.score);
      this.saveHighScores();
      this.messageDisplay.textContent = this.config.gameWonMessage;
      this.displayHighScores();
    } else {
      this.showMessage(
        `${this.config.levelText} ${this.level}`,
        this.levelUpSound
      );
      setTimeout(() => {
        this.overlay.style.display = "none";
        this.gameActive = true;
        this.resetLevel();
      }, 2000);
    }
  }

  resetGame() {
    this.score = 0;
    this.level = 1;
    this.resetLevel();
    this.gameActive = true;
    this.overlay.style.display = "none";
  }

  playSound(audio) {
    if (audio) {
      audio.currentTime = 0;
      audio.play();
    }
  }

  setupEventListeners() {
    document.addEventListener("keydown", (e) => {
      this.keys[e.key] = true;
    });
    document.addEventListener("keyup", (e) => {
      this.keys[e.key] = false;
    });
    this.restartButton.addEventListener("click", () => this.resetGame());
    this.playAgainButton.addEventListener("click", () => this.resetGame());
    this.restartButton.textContent = this.config.restartButtonText;
    this.playAgainButton.textContent = this.config.playAgainButtonText;
  }

  update() {
    if (!this.gameActive) {
      requestAnimationFrame(() => this.update());
      return;
    }

    // Player Movement
    if (this.keys["ArrowLeft"]) {
      this.player.moveLeft();
    }
    if (this.keys["ArrowRight"]) {
      this.player.moveRight();
    }
    if (this.keys[" "] || this.keys["Spacebar"]) {
      this.createBullet();
      this.keys[" "] = false;
      this.keys["Spacebar"] = false;
    }

    // Bullets Movement and Removal
    this.bullets.forEach((bullet) => bullet.update());
    this.bullets = this.bullets.filter((bullet) => bullet.y > 0);

    // Aliens Movement
    let moveDown = false;
    this.aliens.forEach((alien) => {
      if (alien.alive) {
        alien.move(this.alienDirection * this.level, 0);
        if (alien.x + alien.width > this.config.canvasWidth || alien.x < 0) {
          this.alienDirection *= -1;
          moveDown = true;
        }
      }
    });

    if (moveDown) {
      this.aliens.forEach((alien) => {
        if (alien.alive) {
          alien.move(0, this.config.alienSpeedY);
        }
      });
    }

    // Collision Detection
    this.bullets.forEach((bullet) => {
      this.aliens.forEach((alien) => {
        if (
          alien.alive &&
          bullet.x < alien.x + alien.width &&
          bullet.x + bullet.width > alien.x &&
          bullet.y < alien.y + alien.height &&
          bullet.y + bullet.height > alien.y
        ) {
          alien.alive = false;
          bullet.y = -bullet.height;
          this.score += 10 * this.level;
          this.playSound(this.explosionSound);
        }
      });
    });

    this.aliens = this.aliens.filter((alien) => alien.alive);
    this.bullets = this.bullets.filter((bullet) => bullet.y > 0);

    // Check for Level Completion
    if (this.aliens.length === 0) {
      this.gameActive = false;
      setTimeout(() => this.nextLevel(), 1000);
    }

    // Check for Game Over
    if (this.aliens.some((alien) => alien.y + alien.height > this.player.y)) {
      this.gameActive = false;
      this.highScores.push(this.score);
      this.saveHighScores();
      this.showMessage(this.config.gameOverMessage, this.loseSound);
      this.displayHighScores();
    }

    this.draw();
    requestAnimationFrame(() => this.update());
  }

  draw() {
    this.ctx.fillStyle = this.config.backgroundColor;
    this.ctx.fillRect(0, 0, this.config.canvasWidth, this.config.canvasHeight);
    this.player.draw(this.ctx);
    this.bullets.forEach((bullet) => bullet.draw(this.ctx));
    this.aliens.forEach((alien) => alien.draw(this.ctx));

    this.ctx.fillStyle = this.config.matrixColor;
    this.ctx.font = "1rem " + this.config.fontStyle;
    this.ctx.textAlign = "left";
    this.ctx.fillText(
      `${this.config.scoreText}: ${this.score} | ${this.config.levelText}: ${
        this.level
      } | ${this.config.rankText}: ${this.getRank()}`,
      10,
      20
    );
    this.ctx.fillText(``, 10, 40);
  }
}

// Game Configuration
const gameConfig = {
  canvasWidth: 480,
  canvasHeight: 320,
  playerSpeed: 5,
  bulletSpeed: 10,
  initialAlienRows: 3,
  aliensPerRow: 8,
  alienSpeedX: 1,
  alienSpeedY: 20,
  maxLevels: 5,
  matrixColor: "#00ff00", // Matrix Green
  backgroundColor: "#000",
  bulletChar: "0",
  playerChars: ["01", "11", "11", "10"],
  alienChars: ["0", "1", "0"],
  fontStyle: "monospace",
  scoreText: "SCORE",
  levelText: "LEVEL",
  rankText: "RANK",
  gameOverMessage: "Game Over!",
  gameWonMessage: "You won the game!",
  restartButtonText: "Back to the Game",
  playAgainButtonText: "Play Again",
  highScoresTitle: "Top Players",
  rankThresholds: {
    500: "Recruit",
    1500: "Soldier",
    3000: "Veteran",
    5000: "Elite",
    Infinity: "Legend",
  },
  highScoreStorageKey: "spaceInvadersHighScores",
  maxHighScores: 10,
};

const game = new Game(gameConfig);
