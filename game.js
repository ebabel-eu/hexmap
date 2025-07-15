async function loadApp() {
  const response = await fetch('./data.json');
  if (!response.ok) {
    console.error('Failed to load JSON data.');
    return;
  }
  const jsonData = await response.json();
  initApp(jsonData);
}

function initApp(data) {
  console.log('App started with data:', data);

  const canvas = document.getElementById('hexMap');
  const ctx = canvas.getContext('2d');
  const contextMenu = document.getElementById('contextMenu');
  const toggleColorMode = document.getElementById('toggleColorMode');
  const newMapButton = document.getElementById('newMapButton');
  const toggleDangerButton = document.getElementById('toggleDangerButton');
  const poiListDiv = document.getElementById('poiList');

  const HEX_RADIUS = 44;
  const MAP_RADIUS = 6;
  const HEX_COLOR = '#000000';

  let useGrayscale = false;
  let showDanger = true;
  let seed = Math.floor(Math.random() * 99999);

  let terrainMap = new Map();
  let dangerMap = new Map();
  let poiMap = new Map();
  let hexNumberMap = new Map();

  const poiDescriptions = data.poiDescriptions;
  const villageNames = data.villageNames;
  const townNames = data.townNames;
  const cityNames = data.cityNames;
  const poiDevelopments = data.poiDevelopments;
  const cataclysmTypes = data.cataclysmTypes;
  const baseTerrainTypes = data.baseTerrainTypes;

  // --- RANDOM UTILITIES ---
  function seededRandom(seed) {
    let x = Math.sin(seed++) * 10000;
    return x - Math.floor(x);
  }
  function seededChoice(seedRef, list) {
    const val = seededRandom(seedRef.value);
    seedRef.value++;
    return list[Math.floor(val * list.length)];
  }
  function seededDie(seedRef, sides) {
    return Math.floor(seededRandom(seedRef.value++) * sides) + 1;
  }
  function randomDie(sides) {
    return Math.floor(Math.random() * sides) + 1;
  }

  // --- DRAWING ---
  function hexToPixel(q, r, size) {
    const x = size * Math.sqrt(3) * (q + r / 2);
    const y = size * 3 / 2 * r;
    return [x, y];
  }
  function drawHex(x, y, size, fillColor, label, terrainName, dangerSymbol, hasPOI) {
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = Math.PI / 180 * (60 * i - 30);
      const px = x + size * Math.cos(angle);
      const py = y + size * Math.sin(angle);
      i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = HEX_COLOR;
    ctx.lineWidth = 2;
    ctx.stroke();

    const blackTextTerrains = ["Desert", "Swamp"];
    const textColor = (!useGrayscale || blackTextTerrains.includes(terrainName)) ? '#000' : '#fff';
    ctx.fillStyle = textColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = '11px sans-serif';
    ctx.fillText(label, x, y - 10);
    ctx.font = '10px sans-serif';
    ctx.fillText(showDanger ? `${terrainName} - ${dangerSymbol}` : terrainName, x, y + 6);
    if (showDanger && hasPOI) {
      ctx.font = 'bold 9px sans-serif';
      ctx.fillText("PoI", x, y + 20);
    }
  }
  function getHexSpiral(radius) {
    const results = [{ q: 0, r: 0 }];
    const dirs = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];
    for (let k = 1; k <= radius; k++) {
      let q = dirs[4].q * k;
      let r = dirs[4].r * k;
      for (let side = 0; side < 6; side++) {
        const dir = dirs[side];
        for (let step = 0; step < k; step++) {
          results.push({ q, r });
          q += dir.q;
          r += dir.r;
        }
      }
    }
    return results;
  }
  function getTerrainColor(terrain) {
    return useGrayscale ? terrain.grayscale : terrain.color;
  }
  function updateLegendSwatches() {
    baseTerrainTypes.forEach(t => {
      const el = document.getElementById(`swatch-${t.name.toLowerCase()}`);
      if (el) el.style.background = getTerrainColor(t);
    });
  }

  // --- DANGER & DRAWGRID ---
  function dangerLevelSymbol(roll) {
    if (roll === 1) return 'S';
    if (roll <= 3) return 'U';
    if (roll <= 5) return 'R';
    return 'D';
  }
  function drawGrid(drawOnly = false) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!drawOnly) {
      dangerMap.clear();
      poiMap.clear();
      hexNumberMap.clear();
      poiListDiv.innerHTML = '';
    }

    const coords = getHexSpiral(MAP_RADIUS);
    const seedRef = { value: seed };
    let previousTerrain = seededChoice(seedRef, baseTerrainTypes);

    coords.forEach(({ q, r }, index) => {
      const hexId = index + 1;
      const key = `${q},${r}`;
      hexNumberMap.set(key, hexId);

      let terrain = terrainMap.get(key);
      if (!terrain) {
        if (seededRandom(seedRef.value++) < 1 / 36) {
          let newTerrain;
          do {
            newTerrain = seededChoice(seedRef, baseTerrainTypes);
          } while (newTerrain === previousTerrain);
          previousTerrain = newTerrain;
        }
        terrain = previousTerrain;
        terrainMap.set(key, terrain);
      }

      let danger = dangerMap.get(key);
      if (!drawOnly || !danger) {
        const dangerRoll = seededDie(seedRef, 6);
        danger = dangerLevelSymbol(dangerRoll);
        dangerMap.set(key, danger);
      }

      let hasPOI = poiMap.has(key);
      if (!drawOnly && randomDie(6) === 1) {
        let poiType = poiDescriptions[randomDie(poiDescriptions.length) - 1];
        if (poiType === "Village") poiType += ": " + villageNames[randomDie(villageNames.length) - 1];
        else if (poiType === "Town") poiType += ": " + townNames[randomDie(townNames.length) - 1];
        else if (poiType === "City") poiType += ": " + cityNames[randomDie(cityNames.length) - 1];

        let development = poiDevelopments[randomDie(poiDevelopments.length) - 1];
        if (development === "Cataclysm") {
          const cataclysm = cataclysmTypes[randomDie(cataclysmTypes.length) - 1];
          development = `Cataclysm: ${cataclysm}`;
        }

        const fullPOI = `${poiType} (${development})`;
        poiMap.set(key, fullPOI);
        hasPOI = true;
      }

      const [x, y] = hexToPixel(q, r, HEX_RADIUS);
      drawHex(x + canvas.width / 2, y + canvas.height / 2, HEX_RADIUS, getTerrainColor(terrain), hexId, terrain.name, danger, hasPOI);
    });

    if (showDanger && poiMap.size > 0) {
      const listItems = [...poiMap.entries()].map(([key, val]) => {
        const id = hexNumberMap.get(key);
        return `<li><strong>${id}</strong>: ${val}</li>`;
      });
      poiListDiv.innerHTML = `<h3>Points of Interest (DM only)</h3><ul>${listItems.join('')}</ul>`;
      poiListDiv.style.display = 'block';
    } else {
      poiListDiv.innerHTML = '';
      poiListDiv.style.display = 'none';
    }
  }

  // --- EVENT HANDLERS ---
  toggleColorMode.addEventListener('click', () => {
    useGrayscale = !useGrayscale;
    updateLegendSwatches();
    drawGrid(true);
  });
  toggleDangerButton.addEventListener('click', () => {
    showDanger = !showDanger;
    drawGrid(true);
  });
  newMapButton.addEventListener('click', () => {
    seed = Math.floor(Math.random() * 99999);
    terrainMap.clear();
    drawGrid(false);
  });

  canvas.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const size = HEX_RADIUS;
    const q = ((mouseX - canvas.width / 2) * Math.sqrt(3) / 3 - (mouseY - canvas.height / 2) / 3) / size;
    const r = ((mouseY - canvas.height / 2) * 2 / 3) / size;
    const rounded = hexRound(q, r);
    const key = `${rounded.q},${rounded.r}`;
    if (!terrainMap.has(key)) return;

    contextMenu.innerHTML = '';
    baseTerrainTypes.forEach(t => {
      const item = document.createElement('div');
      item.className = 'context-menu-item';
      item.innerHTML = `<span class="swatch" style="background:${getTerrainColor(t)}"></span>${t.name}`;
      item.onclick = () => {
        terrainMap.set(key, t);
        redrawHex(rounded.q, rounded.r);
        contextMenu.style.display = 'none';
      };
      contextMenu.appendChild(item);
    });

    contextMenu.style.left = `${e.pageX}px`;
    contextMenu.style.top = `${e.pageY}px`;
    contextMenu.style.display = 'block';
  });

  window.addEventListener('click', () => {
    contextMenu.style.display = 'none';
  });
  function redrawHex(q, r) {
    const key = `${q},${r}`;
    const terrain = terrainMap.get(key);
    const danger = dangerMap.get(key);
    const hasPOI = poiMap.has(key);
    const hexId = hexNumberMap.get(key);
    const [x, y] = hexToPixel(q, r, HEX_RADIUS);
    drawHex(x + canvas.width / 2, y + canvas.height / 2, HEX_RADIUS, getTerrainColor(terrain), hexId, terrain.name, danger, hasPOI);
  }
  function hexRound(qf, rf) {
    const sf = -qf - rf;
    let q = Math.round(qf);
    let r = Math.round(rf);
    let s = Math.round(sf);
    const dq = Math.abs(q - qf);
    const dr = Math.abs(r - rf);
    const ds = Math.abs(s - sf);
    if (dq > dr && dq > ds) q = -r - s;
    else if (dr > ds) r = -q - s;
    return { q, r };
  }

  // Initial draw.
  drawGrid();
  updateLegendSwatches();
}

loadApp();