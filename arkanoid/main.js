// Constantes de configuração
const BALL_SPEED_MULTIPLIER = 1.2;
const INITIAL_LIVES = 1;
const MAX_LEVELS = 5;
const PADDLE_SPEED = 7;
const PARTICLE_COUNT = 15;

// Elementos do DOM
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const menu = document.getElementById("menu");
const startButton = document.getElementById("startButton");
const gameOverMenu = document.getElementById("gameOver");
const gameOverScore = document.getElementById("gameOverScore");
const restartButton = document.getElementById("restartButton");
const levelUpMenu = document.getElementById("levelUp");
const nextLevelButton = document.getElementById("nextLevelButton");
const toggleSoundButton = document.getElementById("toggleSound");
const volumeControl = document.getElementById("volumeControl");
const volumeControlLabel = document.getElementById("volumeControlLabel");
const recordsList = document.getElementById("recordsList");

// Controle de som
let soundOn = true;

// Sons do jogo
const music = new Audio("sounds/background.mp3");
music.loop = true;
music.volume = 0.3;

class Ball {
  constructor(x, y, radius, dx, dy, color = "#0095DD") {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.dx = dx;
    this.dy = dy;
    this.color = color;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
  }

  move() {
    this.x += this.dx;
    this.y += this.dy;
  }

  reset(x, y, dx, dy) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
  }
}

class Paddle {
  constructor(width, height, canvasWidth, color = "#0095DD") {
    this.width = width;
    this.height = height;
    this.canvasWidth = canvasWidth;
    this.x = (canvasWidth - width) / 2;
    this.color = color;
    this.speed = PADDLE_SPEED;
  }

  draw(ctx) {
    ctx.beginPath();
    ctx.rect(this.x, canvas.height - this.height, this.width, this.height);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
  }

  move(direction) {
    if (direction === "right" && this.x < this.canvasWidth - this.width) {
      this.x += this.speed;
    } else if (direction === "left" && this.x > 0) {
      this.x -= this.speed;
    }
  }

  reset() {
    this.x = (this.canvasWidth - this.width) / 2;
  }
}

class Brick {
  constructor(x, y, width, height, status = 1, color = "rgb(166, 247, 80)") {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.status = status;
    this.color = color;
  }

  draw(ctx) {
    if (this.status === 1) {
      ctx.beginPath();
      ctx.rect(this.x, this.y, this.width, this.height);
      ctx.fillStyle = this.color;
      ctx.fill();
      ctx.closePath();
    }
  }
}

class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    this.color = color;
    this.size = Math.random() * 3 + 1;
    this.speedX = Math.random() * 2 - 1;
    this.speedY = Math.random() * 2 - 1;
    this.alpha = 1;
  }

  draw(ctx) {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.fill();
    ctx.closePath();
    ctx.restore();
  }

  update() {
    this.x += this.speedX;
    this.y += this.speedY;
    this.alpha -= 0.02;
  }
}

class SoundManager {
  constructor() {
    this.sounds = {
      bounce: new Audio("sounds/bounce.wav"),
      brick: new Audio("sounds/brick.wav"),
      gameOver: new Audio("sounds/gameover.wav"),
      levelUp: new Audio("sounds/levelup.wav"),
    };
    this.soundOn = true;
  }

  playSound(soundName) {
    const sound = this.sounds[soundName];
    sound.volume = 0.1;
    if (this.soundOn && sound) {
      sound.currentTime = 0;
      sound
        .play()
        .catch((error) => console.error("Erro ao reproduzir som:", error));
    }
  }

  toggleSound() {
    this.soundOn = !this.soundOn; // Alterna entre ativar/desativar o som
  }
}

// Classe principal do jogo
class Game {
  constructor() {
    this.ball = new Ball(canvas.width / 2, canvas.height - 30, 10, 2, -2);
    this.paddle = new Paddle(75, 10, canvas.width);
    this.bricks = [];
    this.particles = [];
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.level = 1;
    this.maxLevels = MAX_LEVELS;
    this.rightPressed = false;
    this.leftPressed = false;
    this.isRunning = false;
    this.bricks = this.createBricks();
    this.soundManager = new SoundManager();
    this.musicManager = new SoundManager();

    this.addEventListeners();
    this.setRecords();
    this.showStartMenu();
  }

  createBricks() {
    const brickRowCount = 3;
    const brickColumnCount = 5;
    const brickWidth = 75;
    const brickHeight = 20;
    const brickPadding = 10;
    const brickOffsetTop = 30;
    const brickOffsetLeft = 30;

    const bricks = [];

    for (let r = 0; r < brickRowCount; r++) {
      for (let c = 0; c < brickColumnCount; c++) {
        const brickX = c * (brickWidth + brickPadding) + brickOffsetLeft;
        const brickY = r * (brickHeight + brickPadding) + brickOffsetTop;
        const brick = new Brick(brickX, brickY, brickWidth, brickHeight);
        bricks.push(brick);
      }
    }

    console.log(bricks);
    return bricks; // Retorna uma lista plana de tijolos
  }

  addEventListeners() {
    document.addEventListener("keydown", this.handleKey.bind(this), false);
    document.addEventListener("keyup", this.handleKey.bind(this), false);
  }

  handleKey(e, isKeyDown) {
    const keyActions = {
      Right: "rightPressed",
      ArrowRight: "rightPressed",
      Left: "leftPressed",
      ArrowLeft: "leftPressed",
    };

    const action = keyActions[e.key];

    if (action) {
      e.preventDefault();
      // Define o estado com base no tipo do evento (keydown = true, keyup = false)
      this[action] = e.type === "keydown";
    }
  }

  collisionDetection() {
    // Filtra apenas os tijolos ativos para colisão
    const activeBricks = this.bricks.filter((brick) => brick.status === 1);

    // Verifica colisão dos tijolos ativos
    activeBricks.forEach((brick) => {
      if (this.isCollidingWithBrick(brick)) {
        this.handleBrickCollision(brick);
      }
    });
  }

  isCollidingWithBrick(brick) {
    // Verifica se a bola está colidindo com o tijolo
    return (
      this.ball.x > brick.x &&
      this.ball.x < brick.x + brick.width &&
      this.ball.y > brick.y &&
      this.ball.y < brick.y + brick.height
    );
  }

  handleBrickCollision(brick) {
    // Reage à colisão: atualiza o status, incrementa a pontuação e trata efeitos
    this.soundManager.playSound("brick");
    this.ball.dy = -this.ball.dy;
    brick.status = 0;
    this.score++;
    this.createParticles(brick.x + brick.width / 2, brick.y + brick.height / 2);
    this.checkLevelCompletion();
  }

  createParticles(x, y) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      this.particles.push(new Particle(x, y, "#0095DD"));
    }
  }

  updateParticles() {
    this.particles = this.particles.filter((particle) => {
      particle.update();
      return particle.alpha > 0;
    });
  }

  drawParticles() {
    this.particles.forEach((particle) => particle.draw(ctx));
  }

  checkLevelCompletion() {
    const totalBricks = this.bricks.filter(
      (brick) => brick.status === 1
    ).length;
    if (totalBricks < 1) {
      this.showLevelUpMenu();
    }
  }

  saveHighScore() {
    let scores = JSON.parse(localStorage.getItem("highScores")) || [];
    scores.push(this.score);
    scores.sort((a, b) => b - a);
    if (scores.length > 5) {
      scores.pop();
    }
    localStorage.setItem("highScores", JSON.stringify(scores));
  }

  displayHighScores() {
    const highScoresList = document.createElement("div");

    const scores = JSON.parse(localStorage.getItem("highScores")) || [];

    const userScore = document.createElement("h2");
    userScore.textContent = `Your Score: ${this.score}`;
    highScoresList.appendChild(userScore);

    const bestScoreValue = scores.length > 0 ? Math.max(...scores) : this.score;
    const bestScore = document.createElement("h2");
    bestScore.textContent = `Best Score: ${bestScoreValue}`;
    highScoresList.appendChild(bestScore);

    gameOverScore.innerHTML = "";
    gameOverScore.appendChild(highScoresList);
  }

  showGameOverMenu() {
    this.stopGame();
    this.saveHighScore();
    this.toggleMenu(gameOverMenu, true);
    this.displayHighScores();
    this.setRecords();
  }

  showLevelUpMenu() {
    this.stopGame();
    this.toggleMenu(levelUpMenu, true);
    this.soundManager.playSound("levelUp");
  }

  showStartMenu() {
    this.toggleMenu(menu, true);
  }

  stopGame() {
    this.isRunning = false;
    music.pause();
  }

  resetBallAndPaddle() {
    this.ball.reset(canvas.width / 2, canvas.height - 30, 2, -2);
    this.paddle.reset();
  }

  resetBricks() {
    this.bricks = this.createBricks();
  }

  resetGame() {
    this.toggleMenu(menu, false);
    this.toggleMenu(gameOverMenu, false);
    this.toggleMenu(levelUpMenu, false);
    canvas.style.display = "block";

    this.isRunning = true;
    music.play();

    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.level = 1;

    this.resetBricks();
    this.resetBallAndPaddle();
    this.draw();
    this.setRecords();
  }

  drawText(text, x, y, font = "16px Arial", color = "#0095DD") {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
  }

  drawScore() {
    this.drawText(`Level: ${this.level} | Score: ${this.score} `, 8, 20);
  }

  drawLives() {
    this.drawText(`Lifes: ${this.lives}`, canvas.width - 65, 20);
  }

  drawBricks(ctx) {
    this.bricks.forEach((brick) => brick.draw(ctx));
  }

  draw() {
    if (!this.isRunning) {
      return;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.drawBricks(ctx);
    this.ball.draw(ctx);
    this.paddle.draw(ctx);
    this.drawScore();
    this.drawLives();
    this.drawParticles();
    this.collisionDetection();

    // Movimentação da bola
    this.ball.move();

    // Colisão com as paredes
    if (
      this.ball.x + this.ball.dx > canvas.width - this.ball.radius ||
      this.ball.x + this.ball.dx < this.ball.radius
    ) {
      this.ball.dx = -this.ball.dx;
      this.soundManager.playSound("bounce");
    }
    if (this.ball.y + this.ball.dy < this.ball.radius) {
      this.ball.dy = -this.ball.dy;
      this.soundManager.playSound("bounce");
    } else if (this.ball.y + this.ball.dy > canvas.height - this.ball.radius) {
      if (
        this.ball.x > this.paddle.x &&
        this.ball.x < this.paddle.x + this.paddle.width
      ) {
        // Ajustar a direção da bola com base no ponto de impacto na raquete
        const relativeHit =
          (this.ball.x - (this.paddle.x + this.paddle.width / 2)) /
          (this.paddle.width / 2);
        this.ball.dx = relativeHit * 5;
        this.ball.dy = -this.ball.dy;
        this.soundManager.playSound("bounce");
      } else {
        this.lives--;
        this.soundManager.playSound("gameOver");
        if (this.lives === 0) {
          this.showGameOverMenu();
        } else {
          this.resetBallAndPaddle();
        }
      }
    }

    // Movimentação da raquete
    if (this.rightPressed) {
      this.paddle.move("right");
    } else if (this.leftPressed) {
      this.paddle.move("left");
    }

    this.updateParticles();

    requestAnimationFrame(this.draw.bind(this));
  }

  nextLevel() {
    this.toggleMenu(levelUpMenu, false);
    this.level++;
    if (this.level > this.maxLevels) {
      alert("Parabéns! Você completou todos os níveis!");
      document.location.reload();
    } else {
      // Aumentar a velocidade da bola
      this.ball.dx *= BALL_SPEED_MULTIPLIER;
      this.ball.dy *= BALL_SPEED_MULTIPLIER;
      // Resetar os tijolos
      this.resetBricks();
      // Resetar a posição da bola e raquete
      this.resetBallAndPaddle();
      this.isRunning = true;
      music.play();
      this.draw();
    }
  }

  setRecords() {
    const scores = JSON.parse(localStorage.getItem("highScores")) || [];
    const listItems = scores
      .map((score, index) => `<li>${index + 1}º - ${score} Points</li>`)
      .join("");
    recordsList.innerHTML = listItems;
  }

  toggleSound() {
    this.soundManager.toggleSound();
  }

  // Funções de interface
  toggleMenu(selectedMenu, show) {
    selectedMenu.style.display = show ? "flex" : "none";
    canvas.style.display = show ? "none" : "block";
  }
}

function updateVolumeControlLabel() {
  const volumeValue = volumeControl.value * 100;
  volumeControlLabel.innerText = `Music Volume: ${volumeValue}%`;
}

// Controle de som
toggleSoundButton.addEventListener("click", () => {
  soundOn = !soundOn;
  music.muted = !soundOn;
  game.toggleSound();
  toggleSoundButton.textContent = soundOn ? "Turn OFF" : "Turn ON";
});

// Controle do volume
volumeControl.addEventListener("input", () => {
  music.volume = volumeControl.value;
  updateVolumeControlLabel();
});

// Eventos dos botões
startButton.addEventListener("click", () => game.resetGame());
restartButton.addEventListener("click", () => game.resetGame());
nextLevelButton.addEventListener("click", () => game.nextLevel());

// Instanciar o jogo
const game = new Game();
updateVolumeControlLabel();
