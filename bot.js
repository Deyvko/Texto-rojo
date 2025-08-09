"use strict";

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");
const { PNG } = require("pngjs");

// -------------------------
// CONFIGURATION (editable)
// -------------------------
const IMAGE_PATH = process.env.IMAGE_PATH || "laarge.png";
const TARGET_START_COORDINATES = {
  x: Number(process.env.START_X || 527),
  y: Number(process.env.START_Y || 346),
};
const PLACEMENT_STRATEGY = process.env.STRATEGY || "top-to-bottom"; // 'top-to-bottom' | 'bottom-to-top' | 'left-to-right' | 'right-to-left'
const DELAY_BETWEEN_ACTIONS = Number(process.env.ACTION_DELAY_MS || 200);
const DELAY_BETWEEN_KEYS = Number(process.env.KEY_DELAY_MS || 200);
const INITIAL_WAIT_TIME = Number(process.env.INITIAL_WAIT_MS || 30000);
const BROWSERS_TO_LAUNCH = Number(process.env.BROWSERS || 3);
const HEADLESS = String(process.env.HEADLESS || "false").toLowerCase() === "true";

// Color mapping based on the provided palette (keys: HEX color, value: keyboard char)
const COLOR_PALETTE = {
  "#000000": "1", // Black
  "#696969": "2", // Dark gray
  "#555555": "3", // Medium dark gray
  "#808080": "4", // Medium gray
  "#D3D3D3": "5", // Light gray
  "#FFFFFF": "6", // White
  "#FF9999": "7", // Light pink
  "#CC3333": "8", // Medium red
  "#DC143C": "9", // Crimson
  "#990000": "a", // Dark red
  "#800000": "b", // Maroon
  "#FF5700": "c", // Orange-red
  "#CCFF8C": "d", // Light green
  "#81DE76": "e", // Medium green
  "#006F3C": "f", // Dark green
  "#3A55B4": "g", // Medium blue
  "#6CADDF": "h", // Light blue
  "#8CD9FF": "i", // Sky blue
  "#00FFFF": "j", // Cyan
  "#B77DFF": "k", // Light purple
  "#BE45FF": "l", // Medium purple
  "#FA3983": "m", // Hot pink
  "#FF9900": "n", // Orange
  "#FFE600": "o", // Yellow
  "#573400": "p", // Brown
};

const proxyLines = `
46.203.159.107:6708:hiwaponn:ghugpjquqn6i
38.170.168.251:5526:hiwaponn:ghugpjquqn6i
136.0.103.242:5943:hiwaponn:ghugpjquqn6i
46.203.134.48:5672:hiwaponn:ghugpjquqn6i
82.22.245.130:5954:hiwaponn:ghugpjquqn6i
149.57.85.213:6181:hiwaponn:ghugpjquqn6i
184.174.28.131:5146:hiwaponn:ghugpjquqn6i
192.210.132.190:6160:hiwaponn:ghugpjquqn6i
82.21.227.115:7947:hiwaponn:ghugpjquqn6i
38.154.217.239:7430:hiwaponn:ghugpjquqn6i
209.99.135.159:6790:hiwaponn:ghugpjquqn6i
46.203.59.71:7195:hiwaponn:ghugpjquqn6i
82.22.245.130:5954:hiwaponn:ghugpjquqn6i
46.203.59.71:7195:hiwaponn:ghugpjquqn6i
209.99.135.159:6790:hiwaponn:ghugpjquqn6i
38.225.2.11:5794:hiwaponn:ghugpjquqn6i
102.212.90.224:5918:hiwaponn:ghugpjquqn6i
184.174.28.215:5230:hiwaponn:ghugpjquqn6i
38.170.168.251:5526:hiwaponn:ghugpjquqn6i
`;

const proxies = proxyLines
  .trim()
  .split("\n")
  .map((line) => {
    const [host, port, user, pass] = line.trim().split(":");
    return { host, port, user, pass };
  })
  .filter((p) => p.host && p.port);

function getRandomProxy() {
  return proxies[Math.floor(Math.random() * proxies.length)];
}

function toHex(r, g, b) {
  const hex = ((1 << 24) + (r << 16) + (g << 8) + b)
    .toString(16)
    .slice(1)
    .toUpperCase();
  return `#${hex}`;
}

function rgbToClosestColor(r, g, b, a) {
  if (a < 128) return null;
  let closestColor = "1"; // default black
  let minDistance = Number.POSITIVE_INFINITY;

  for (const [hex, colorKey] of Object.entries(COLOR_PALETTE)) {
    const hexR = parseInt(hex.slice(1, 3), 16);
    const hexG = parseInt(hex.slice(3, 5), 16);
    const hexB = parseInt(hex.slice(5, 7), 16);
    const dr = r - hexR;
    const dg = g - hexG;
    const db = b - hexB;
    const distance = Math.sqrt(dr * dr + dg * dg + db * db);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = colorKey;
    }
  }
  return closestColor;
}

async function readPng(filePath) {
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(new PNG({ filterType: 4 }))
      .on("parsed", function () {
        resolve(this);
      })
      .on("error", reject);
  });
}

async function processImage(imagePath) {
  try {
    if (!fs.existsSync(imagePath)) {
      console.error(`Image not found: ${imagePath}`);
      return null;
    }
    const png = await readPng(imagePath);
    const { width, height, data } = png;

    const pixelMap = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) << 2;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];
        const colorKey = rgbToClosestColor(r, g, b, a);
        if (colorKey !== null) {
          pixelMap.push({
            x: x + TARGET_START_COORDINATES.x,
            y: y + TARGET_START_COORDINATES.y,
            color: colorKey,
          });
        }
      }
    }

    console.log(`Processed image: ${width}x${height}, ${pixelMap.length} pixels to place`);
    return { pixelMap, width, height };
  } catch (error) {
    console.error("Error processing image:", error);
    return null;
  }
}

function generateCoordinatePath(pixelMap, width, height, strategy) {
  const byCoord = new Map();
  for (const p of pixelMap) byCoord.set(`${p.x}|${p.y}`, p);

  const pathArr = [];
  switch (strategy) {
    case "top-to-bottom":
      for (let y = 0; y < height; y++) {
        if (y % 2 === 0) {
          for (let x = 0; x < width; x++) {
            const p = byCoord.get(`${x + TARGET_START_COORDINATES.x}|${y + TARGET_START_COORDINATES.y}`);
            if (p) pathArr.push(p);
          }
        } else {
          for (let x = width - 1; x >= 0; x--) {
            const p = byCoord.get(`${x + TARGET_START_COORDINATES.x}|${y + TARGET_START_COORDINATES.y}`);
            if (p) pathArr.push(p);
          }
        }
      }
      break;
    case "bottom-to-top":
      for (let y = height - 1; y >= 0; y--) {
        if ((height - 1 - y) % 2 === 0) {
          for (let x = 0; x < width; x++) {
            const p = byCoord.get(`${x + TARGET_START_COORDINATES.x}|${y + TARGET_START_COORDINATES.y}`);
            if (p) pathArr.push(p);
          }
        } else {
          for (let x = width - 1; x >= 0; x--) {
            const p = byCoord.get(`${x + TARGET_START_COORDINATES.x}|${y + TARGET_START_COORDINATES.y}`);
            if (p) pathArr.push(p);
          }
        }
      }
      break;
    case "left-to-right":
      for (let x = 0; x < width; x++) {
        if (x % 2 === 0) {
          for (let y = 0; y < height; y++) {
            const p = byCoord.get(`${x + TARGET_START_COORDINATES.x}|${y + TARGET_START_COORDINATES.y}`);
            if (p) pathArr.push(p);
          }
        } else {
          for (let y = height - 1; y >= 0; y--) {
            const p = byCoord.get(`${x + TARGET_START_COORDINATES.x}|${y + TARGET_START_COORDINATES.y}`);
            if (p) pathArr.push(p);
          }
        }
      }
      break;
    case "right-to-left":
      for (let x = width - 1; x >= 0; x--) {
        if ((width - 1 - x) % 2 === 0) {
          for (let y = 0; y < height; y++) {
            const p = byCoord.get(`${x + TARGET_START_COORDINATES.x}|${y + TARGET_START_COORDINATES.y}`);
            if (p) pathArr.push(p);
          }
        } else {
          for (let y = height - 1; y >= 0; y--) {
            const p = byCoord.get(`${x + TARGET_START_COORDINATES.x}|${y + TARGET_START_COORDINATES.y}`);
            if (p) pathArr.push(p);
          }
        }
      }
      break;
    default:
      pathArr.push(...pixelMap);
  }
  return pathArr;
}

function calculateMovement(currentCoords, targetCoords) {
  const deltaX = targetCoords.x - currentCoords.x;
  const deltaY = targetCoords.y - currentCoords.y;
  const movements = [];
  if (deltaX > 0) for (let i = 0; i < deltaX; i++) movements.push("ArrowRight");
  else if (deltaX < 0) for (let i = 0; i < -deltaX; i++) movements.push("ArrowLeft");
  if (deltaY > 0) for (let i = 0; i < deltaY; i++) movements.push("ArrowDown");
  else if (deltaY < 0) for (let i = 0; i < -deltaY; i++) movements.push("ArrowUp");
  return movements;
}

async function sleep(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function waitBeforeStarting(browserIndex, waitTimeMs = INITIAL_WAIT_TIME) {
  console.log(`Browser ${browserIndex + 1}: Waiting ${waitTimeMs / 1000} seconds before starting pixel placement...`);
  const startTime = Date.now();
  await sleep(waitTimeMs);
  const elapsedTime = Date.now() - startTime;
  console.log(`Browser ${browserIndex + 1}: Wait completed after ${elapsedTime}ms - starting pixel placement`);
  return true;
}

async function focusCanvas(page) {
  // Try to focus the main canvas to ensure arrow keys are captured
  try {
    await page.waitForSelector("canvas", { timeout: 15000 });
    const canvasBoxes = await page.$$('canvas');
    if (canvasBoxes.length > 0) {
      const box = await canvasBoxes[0].boundingBox();
      if (box) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { delay: 50 });
      }
    }
    await page.keyboard.press("Escape").catch(() => {});
  } catch (e) {
    // ignore
  }
}

async function performPixelPlacement(page, browserIndex, coordinatePath) {
  let currentCoords = { x: TARGET_START_COORDINATES.x, y: TARGET_START_COORDINATES.y };
  let pathIndex = 0;

  console.log(`Browser ${browserIndex + 1}: Starting pixel placement with ${coordinatePath.length} pixels`);

  while (pathIndex < coordinatePath.length) {
    try {
      const targetPixel = coordinatePath[pathIndex];
      console.log(
        `Browser ${browserIndex + 1}: Placing pixel ${pathIndex + 1}/${coordinatePath.length} at (${targetPixel.x}, ${targetPixel.y}) with color ${targetPixel.color}`
      );

      const movements = calculateMovement(currentCoords, targetPixel);

      for (const movement of movements) {
        await page.keyboard.press(movement);
        await sleep(DELAY_BETWEEN_KEYS);
        switch (movement) {
          case "ArrowLeft":
            currentCoords.x--;
            break;
          case "ArrowRight":
            currentCoords.x++;
            break;
          case "ArrowUp":
            currentCoords.y--;
            break;
          case "ArrowDown":
            currentCoords.y++;
            break;
        }
      }

      await page.keyboard.press(targetPixel.color);
      await sleep(DELAY_BETWEEN_KEYS);

      await page.keyboard.press("Enter");
      console.log(`Browser ${browserIndex + 1}: Placed pixel at (${targetPixel.x}, ${targetPixel.y})`);

      pathIndex++;
      await sleep(DELAY_BETWEEN_ACTIONS);
    } catch (error) {
      console.log(`Browser ${browserIndex + 1}: Error placing pixel - ${error.message}`);
      await sleep(DELAY_BETWEEN_ACTIONS);
    }
  }

  console.log(`Browser ${browserIndex + 1}: Completed all pixel placements!`);
}

async function launchWithProxy(proxy, index, coordinatePath, windowLeft = 0, windowTop = 0, windowWidth = 1024, windowHeight = 768) {
  const url = `https://rplace.live/?x=${TARGET_START_COORDINATES.x}&y=${TARGET_START_COORDINATES.y}`;

  console.log(`Launching browser ${index + 1} with proxy: ${proxy.host}:${proxy.port}:${proxy.user}`);
  console.log(`Browser ${index + 1} will process ${coordinatePath.length} pixels`);

  let browser;
  try {
    browser = await puppeteer.launch({
      headless: HEADLESS,
      args: [
        `--proxy-server=${proxy.host}:${proxy.port}`,
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
        "--disable-infobars",
        `--window-size=${windowWidth},${windowHeight}`,
        `--window-position=${windowLeft},${windowTop}`,
      ],
      defaultViewport: null,
    });

    const page = await browser.newPage();
    await page.authenticate({ username: proxy.user, password: proxy.pass }).catch(() => {});

    page.on("console", async (msg) => {
      try {
        const args = await Promise.all(
          msg.args().map((arg) => arg.jsonValue().catch(() => "[unserializable]"))
        );
        console.log(`CONSOLE [Browser ${index + 1}]:`, ...args);
      } catch (e) {
        console.log(`CONSOLE [Browser ${index + 1}]: [console output could not be parsed]`);
      }
    });

    console.log(`Browser ${index + 1}: Navigating to ${url}...`);
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 600000 });

    await waitBeforeStarting(index);

    await focusCanvas(page);

    const tamperPath = path.resolve(process.cwd(), "cordinate.txt");
    if (fs.existsSync(tamperPath)) {
      try {
        const tamperCode = fs.readFileSync(tamperPath, "utf-8");
        await page.evaluate(tamperCode).catch(() => {});
      } catch (e) {
        // ignore tm errors
      }
    }

    let proxyWorks = false;
    try {
      await page.waitForSelector("body", { timeout: 10000 });
      proxyWorks = true;
    } catch (e) {
      proxyWorks = false;
    }

    if (proxyWorks) {
      console.log(`Browser ${index + 1}: Proxy ${proxy.host}:${proxy.port}:${proxy.user} is GOOD.`);
      await sleep(3000);
      console.log(`Browser ${index + 1}: Starting automated pixel placement`);
      performPixelPlacement(page, index, coordinatePath).catch(() => {});
    } else {
      console.log(`Browser ${index + 1}: Proxy ${proxy.host}:${proxy.port}:${proxy.user} does NOT work.`);
      await browser.close().catch(() => {});
    }
  } catch (err) {
    console.log(
      `Browser ${index + 1}: Proxy ${proxy.host}:${proxy.port}:${proxy.user} FAILED to connect (${err.message})`
    );
    if (browser) {
      try {
        await browser.close();
      } catch (_) {}
    }
  }
}

function dividePath(coordinatePath, parts) {
  const chunkSize = Math.ceil(coordinatePath.length / parts);
  const chunks = [];
  for (let i = 0; i < parts; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, coordinatePath.length);
    const chunk = coordinatePath.slice(start, end);
    if (chunk.length) chunks.push(chunk);
  }
  return chunks;
}

(async () => {
  const isCheck = process.argv.includes("--check");

  console.log(
    `Configuration:\n- Image Path: ${IMAGE_PATH}\n- Target Start Coordinates: (${TARGET_START_COORDINATES.x}, ${TARGET_START_COORDINATES.y})\n- Placement Strategy: ${PLACEMENT_STRATEGY}\n- Initial Wait Time: ${INITIAL_WAIT_TIME / 1000} seconds\n- Delay between actions: ${DELAY_BETWEEN_ACTIONS}ms\n- Delay between keys: ${DELAY_BETWEEN_KEYS}ms\n- Headless: ${HEADLESS}\n- Browsers: ${BROWSERS_TO_LAUNCH}\n`
  );

  const imageData = await processImage(IMAGE_PATH);
  if (!imageData) {
    console.error("Failed to process image. Exiting.");
    process.exitCode = 1;
    return;
  }

  const coordinatePath = generateCoordinatePath(
    imageData.pixelMap,
    imageData.width,
    imageData.height,
    PLACEMENT_STRATEGY
  );

  console.log(
    `Generated coordinate path with ${coordinatePath.length} pixels using ${PLACEMENT_STRATEGY} strategy`
  );

  if (isCheck) {
    console.log("--check complete. Exiting without launching browsers.");
    return;
  }

  const usedProxies = new Set();
  const windowWidth = 860;
  const windowHeight = 680;
  const windowLeft = 0;
  const windowTop = 0;

  const chunks = dividePath(coordinatePath, BROWSERS_TO_LAUNCH);
  for (let i = 0; i < chunks.length; i++) {
    let proxy;
    let attempts = 0;
    do {
      proxy = getRandomProxy();
      attempts++;
    } while (usedProxies.has(`${proxy.host}:${proxy.port}:${proxy.user}`) && attempts < 100);
    usedProxies.add(`${proxy.host}:${proxy.port}:${proxy.user}`);

    console.log(
      `Browser ${i + 1}: Will place ${chunks[i].length} pixels (${i * chunks[i].length} to ${(i + 1) * chunks[i].length - 1})`
    );

    // Fire and forget; do not await to run in parallel
    launchWithProxy(proxy, i, chunks[i], windowLeft, windowTop, windowWidth, windowHeight);
  }
})();