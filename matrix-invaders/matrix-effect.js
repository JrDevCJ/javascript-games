class MatrixRain {
  constructor(containerId, chars, numChars) {
    this.container = document.getElementById(containerId);
    this.chars = chars;
    this.numChars = numChars;
  }

  create() {
    for (let i = 0; i < this.numChars; i++) {
      const charSpan = document.createElement("span");
      charSpan.className = "matrixChar";
      charSpan.textContent = this.chars.charAt(
        Math.floor(Math.random() * this.chars.length)
      );
      charSpan.style.left = `${Math.random() * 100}vw`;
      charSpan.style.top = `${Math.random() * 100}vh - 100vh`;
      charSpan.style.animationDelay = `${Math.random() * 2}s`;
      charSpan.style.fontSize = `${0.8 + Math.random() * 0.6}rem`;
      this.container.appendChild(charSpan);
    }
  }
}

const matrixRain = new MatrixRain(
  "matrixRainContainer",
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
  300
);
matrixRain.create();
