/* Pyörivä maapallo, joka kohdistuu Suomeen ja Ouluun.
 * Toimii verkossa (NASA GIBS + Copernicus Sentinel-2 -tiilet) ja offline-tilassa
 * (paikalliset tiilet kansiossa tiles/, tai Cesiumin oma Natural Earth -pohjakartta). */
(function () {
  "use strict";

  const C = window.GLOBE_CONFIG;
  const params = new URLSearchParams(location.search);
  const forceOffline = params.has("offline");
  const LOCAL = window.LOCAL_TILES || null; // tiles/manifest.js määrittää tämän, jos tiilet on ladattu

  const $ = (id) => document.getElementById(id);
  const ui = {
    phase: $("phase"),
    card: $("card"),
    source: $("source"),
    mode: $("mode"),
    panel: $("panel"),
    epic: $("epic"),
    epicImg: document.querySelector("#epic img"),
    epicCap: document.querySelector("#epic .epic-cap"),
    fps: $("fps"),
  };

  // ---------- Apufunktiot ----------
  function isoDateDaysAgo(days) {
    const d = new Date(Date.now() - days * 86400000);
    return d.toISOString().slice(0, 10);
  }
  function fiDate(iso) {
    const [y, m, d] = iso.split("-");
    return `${Number(d)}.${Number(m)}.${y}`;
  }
  function probe(url, ms) {
    return new Promise((resolve) => {
      const img = new Image();
      const t = setTimeout(() => resolve(false), ms);
      img.onload = () => { clearTimeout(t); resolve(true); };
      img.onerror = () => { clearTimeout(t); resolve(false); };
      img.src = url + (url.includes("?") ? "&" : "?") + "probe=" + Date.now();
    });
  }
  function wmLayer(url, minLevel, maxLevel, rectangle) {
    return new Cesium.UrlTemplateImageryProvider({
      url,
      tilingScheme: new Cesium.WebMercatorTilingScheme(),
      minimumLevel: minLevel || 0,
      maximumLevel: maxLevel,
      rectangle,
    });
  }

  // ---------- Näkymä ----------
  const viewer = new Cesium.Viewer("globe", {
    baseLayer: false,
    animation: false,
    timeline: false,
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    creditContainer: document.createElement("div"),
    requestRenderMode: false,
    msaaSamples: 1,
    // Piirretään näytön todellisella tarkkuudella (Cesium piirtää oletuksena CSS-pikseleinä,
    // mikä näyttää sumealta tarkoilla näytöillä).
    useBrowserRecommendedResolution: false,
    contextOptions: { webgl: { powerPreference: "high-performance", antialias: false } },
  });
  const scene = viewer.scene;
  const camera = viewer.camera;
  // Tarkkuus: ?kevyt = kevyempi tila heikoille koneille. Muuten enintään 2x näytön tiheys.
  let light = params.has("kevyt");
  function applyQuality() {
    const dpr = window.devicePixelRatio || 1;
    viewer.resolutionScale = light ? 1 / dpr : Math.min(dpr, 2) / dpr;
    scene.globe.maximumScreenSpaceError = light ? 3 : 1.5;
  }
  applyQuality();
  scene.postProcessStages.fxaa.enabled = true;
  scene.fog.enabled = true;
  scene.globe.enableLighting = false;
  scene.globe.showGroundAtmosphere = true;
  scene.globe.loadingDescendantLimit = 40;
  scene.globe.tileCacheSize = 1000;
  scene.globe.preloadSiblings = true;
  scene.globe.baseColor = Cesium.Color.fromCssColorString("#0b1a2e");
  scene.screenSpaceCameraController.enableInputs = false; // esitys ei reagoi hiireen
  if (scene.moon) scene.moon.show = false;
  if (scene.sun) scene.sun.show = false;

  // Oulun merkki näkyy vasta lähempänä
  viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(C.target.lon, C.target.lat),
    point: {
      pixelSize: 10,
      color: Cesium.Color.fromCssColorString("#ffd166"),
      outlineColor: Cesium.Color.fromCssColorString("#0b1a2e"),
      outlineWidth: 2,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2500000),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: "Oulu",
      font: "600 20px system-ui, 'Segoe UI', sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.fromCssColorString("#0b1a2e"),
      outlineWidth: 4,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -22),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2500000),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // ---------- Kuvatasot ----------
  const dailyLayers = [];   // tuoreet satelliittikuvat, vanhin ensin
  let dailyDates = [];      // ISO-päivämäärät, vanhin ensin
  let dailyShown = false;
  const hasDaily = () => dailyLayers.length > 0;
  let mode = "online";

  async function setupImagery() {
    const im = C.imagery;
    const layers = scene.imageryLayers;
    const online = !forceOffline && (await probe(im.baseUrl.replace("{z}/{y}/{x}", "0/0/0"), 5000));

    if (online) {
      mode = "online";
      layers.addImageryProvider(wmLayer(im.baseUrl, 0, im.baseMaxLevel));
      layers.addImageryProvider(wmLayer(im.detailUrl, im.detailMinLevel, im.detailMaxLevel));
      dailyDates = im.dailyDaysBack.map(isoDateDaysAgo);
      for (const date of dailyDates)
        for (const sat of im.dailyLayers)
          dailyLayers.push(layers.addImageryProvider(
            wmLayer(im.dailyUrl.replace("{layer}", sat.id).replace("{time}", date), 0, im.dailyMaxLevel)
          ));
    } else if (LOCAL) {
      mode = "offline";
      for (const l of LOCAL.layers) {
        const rect = l.bounds ? Cesium.Rectangle.fromDegrees(...l.bounds) : undefined;
        const layer = layers.addImageryProvider(
          wmLayer(`tiles/${l.name}/{z}/{x}/{y}.${l.ext || "jpg"}`, l.minLevel, l.maxLevel, rect)
        );
        if (l.group === "daily") {
          dailyLayers.push(layer);
          if (l.date && !dailyDates.includes(l.date)) dailyDates.push(l.date);
        }
      }
    } else {
      mode = "fallback";
      const provider = await Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
      );
      layers.addImageryProvider(provider);
    }

    // NASA palauttaa kuvaamattomat alueet (napayö, ratojen välit) mustina.
    // Muutetaan musta läpinäkyväksi, jolloin alempi kuva tai pilvetön pohjakuva näkyy niiden alta.
    dailyDates.sort();
    for (const l of dailyLayers) {
      l.colorToAlpha = Cesium.Color.BLACK;
      l.colorToAlphaThreshold = im.dailyBlackThreshold ?? 0.06;
    }
    showDaily(im.showDailyAtStart);
    updateFooter();
    updatePanel();
    if (mode === "online") preloadOulu();
  }

  // Ladataan Oulun ja lentoreitin tarkat tiilet valmiiksi selaimen välimuistiin,
  // jotta lähikuva on terävä heti laskeutumisen jälkeen.
  function preloadOulu() {
    const im = C.imagery;
    const t = C.target;
    const urls = [];
    const box = { 9: 1.2, 10: 0.8, 11: 0.5, 12: 0.3, 13: 0.18, 14: 0.1 };
    for (const [zs, d] of Object.entries(box)) {
      const z = Number(zs);
      if (z > im.detailMaxLevel) continue;
      const n = 2 ** z;
      const tx = (lon) => Math.floor(((lon + 180) / 360) * n);
      const ty = (lat) => {
        const r = (lat * Math.PI) / 180;
        return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
      };
      for (let x = tx(t.lon - d * 2); x <= tx(t.lon + d * 2); x++)
        for (let y = ty(t.lat + d); y <= ty(t.lat - d); y++)
          urls.push(im.detailUrl.replace("{z}", z).replace("{x}", x).replace("{y}", y));
    }
    let i = 0;
    const next = () => {
      if (i >= urls.length) return;
      const img = new Image();
      img.onload = img.onerror = next;
      img.src = urls[i++];
    };
    for (let k = 0; k < 6; k++) next();
  }

  function showDaily(on) {
    dailyShown = !!on && hasDaily();
    for (const l of dailyLayers) l.show = dailyShown;
  }
  function dailyRangeText() {
    if (!dailyDates.length) return "";
    const a = fiDate(dailyDates[0]), b = fiDate(dailyDates[dailyDates.length - 1]);
    return a === b ? a : `${a.split(".").slice(0, 2).join(".")}.–${b}`;
  }

  function updateFooter() {
    const parts = [];
    if (mode === "fallback") {
      parts.push("Kartta: Natural Earth II (verkkoyhteys puuttuu)");
    } else {
      parts.push("Satelliittikuvat: NASA GIBS Blue Marble");
      parts.push("Sentinel-2 cloudless 2021, EOX IT Services GmbH (sis. muokattua Copernicus Sentinel -dataa 2021)");
      if (epic) parts.unshift("Valokuva koko maapallosta: NASA DSCOVR / EPIC");
      if (dailyShown && dailyDates.length) {
        const sats = C.imagery.dailyLayers.map((d) => d.name).join(", ");
        parts.unshift(`Tuore kuva ${dailyRangeText()}: NASA GIBS / VIIRS (${sats})`);
      }
    }
    ui.source.textContent = parts.join(" · ");
    ui.mode.textContent =
      mode === "online" ? "Verkko" : mode === "offline" ? "Offline" : "Offline (perustaso)";
    ui.mode.dataset.mode = mode;
  }

  // ---------- Esityksen kulku ----------
  let paused = false;
  let spinning = false;
  let runId = 0;

  function wait(seconds, id) {
    return new Promise((resolve) => {
      let left = seconds * 1000;
      let last = performance.now();
      function tick(now) {
        if (id !== runId) return resolve(false);
        if (!paused) left -= now - last;
        last = now;
        if (left <= 0) resolve(true);
        else requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
  }

  function fly(dest, seconds, orientation, id) {
    return new Promise((resolve) => {
      if (id !== runId) return resolve(false);
      camera.flyTo({
        destination: dest,
        orientation,
        duration: seconds,
        easingFunction: Cesium.EasingFunction.QUADRATIC_IN_OUT,
        complete: () => resolve(id === runId),
        cancel: () => resolve(false),
      });
    });
  }

  function setPhase(text) {
    ui.phase.classList.remove("show");
    if (!text) return;
    setTimeout(() => {
      ui.phase.textContent = text;
      ui.phase.classList.add("show");
    }, 350);
  }

  // Pyörimisen aloituskohta ja kesto. Pyöriminen päättyy täsmälleen Oulun pituuspiirille.
  // Jos EPIC-kuva on käytössä, aloitetaan samasta kohdasta kuin kuvassa näkyvä maapallo.
  function spinPlan() {
    if (epic) {
      const delta = (((epic.lon - C.target.lon) % 360) + 360) % 360;
      return { lon: epic.lon, lat: epic.lat, seconds: delta / C.spinDegPerSec };
    }
    return { lon: C.target.lon + C.spinDegPerSec * C.timing.spin, lat: 28, seconds: C.timing.spin };
  }
  function spinStartPosition() {
    const p = spinPlan();
    return Cesium.Cartesian3.fromDegrees(p.lon, p.lat, spaceHeight());
  }
  // Korkeus, jolla maapallo täyttää halutun osan näytön korkeudesta (näytön muodosta riippumatta).
  function spaceHeight() {
    const R = 6371000;
    const fovy = camera.frustum.fovy || Cesium.Math.toRadians(40);
    const fill = C.globeFill || 0.72;
    return R / Math.sin((fovy / 2) * fill) - R;
  }
  const lookDown = { heading: 0, pitch: -Cesium.Math.PI_OVER_TWO, roll: 0 };

  scene.preRender.addEventListener((_scene, time) => {
    const now = performance.now();
    const dt = (now - (scene._lastSpin || now)) / 1000;
    scene._lastSpin = now;
    // Tuore kuva häivytetään lähelle zoomatessa (sen tarkkuus on n. 250 m), jolloin
    // Oulun tarkka Sentinel-2-kuva näkyy.
    if (dailyShown) {
      const im = C.imagery;
      const h = camera.positionCartographic.height;
      const a = Cesium.Math.clamp((h - im.dailyFadeTo) / (im.dailyFadeFrom - im.dailyFadeTo), 0, 1);
      for (const l of dailyLayers) l.alpha = a;
    }
    if (spinning && !paused && dt < 0.5) {
      // Kamera kiertää länteen, jolloin maapallo näyttää pyörivän oikeaan suuntaan.
      camera.rotate(Cesium.Cartesian3.UNIT_Z, -Cesium.Math.toRadians(C.spinDegPerSec * dt));
    }
  });

  async function run() {
    const id = ++runId;
    const T = C.timing;
    camera.cancelFlight();
    ui.card.classList.remove("show");
    camera.setView({ destination: spinStartPosition(), orientation: lookDown });

    while (id === runId) {
      // 0. Aito valokuva koko maapallosta (DSCOVR EPIC), joka vaihtuu 3D-palloksi
      if (epic) {
        sizeEpic();
        setPhase(C.texts.phaseEpic);
        ui.epic.classList.add("show");
        if (!(await wait(T.epicHold, id))) return;
        ui.epic.classList.remove("show");
        setPhase(C.texts.phaseEarth);
        if (!(await wait(T.epicFade, id))) return;
      } else {
        setPhase(C.texts.phaseEarth);
      }

      // 1. Vapaa pyöriminen
      spinning = true;
      if (!(await wait(spinPlan().seconds, id))) return;
      spinning = false;

      // 2. Suomi
      setPhase(C.texts.phaseFinland);
      if (!(await fly(
        Cesium.Cartesian3.fromDegrees(C.finland.lon, C.finland.lat - 6, C.heights.finland),
        T.flyToFinland,
        { heading: 0, pitch: Cesium.Math.toRadians(-62), roll: 0 },
        id
      ))) return;
      if (!(await wait(T.holdFinland, id))) return;

      // 3. Oulu
      setPhase(null);
      if (!(await fly(
        Cesium.Cartesian3.fromDegrees(C.target.lon, C.target.lat - 0.16, C.heights.oulu),
        T.flyToOulu,
        { heading: 0, pitch: Cesium.Math.toRadians(-52), roll: 0 },
        id
      ))) return;
      ui.card.classList.add("show");
      if (!(await wait(T.holdOulu, id))) return;
      ui.card.classList.remove("show");

      // 4. Takaisin avaruuteen ja alusta
      setPhase(null);
      if (!(await fly(spinStartPosition(), T.flyOut, lookDown, id))) return;
    }
  }

  // ---------- Valikko ja näppäimet ----------
  function setDaily(on) {
    if (!hasDaily()) return;
    showDaily(on);
    updateFooter();
    updatePanel();
  }
  function setOffline(on) {
    const u = new URL(location.href);
    if (on) u.searchParams.set("offline", ""); else u.searchParams.delete("offline");
    location.href = u.toString().replace("offline=", "offline");
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen().catch(() => {});
  }
  const actions = {
    online: () => setOffline(false),
    offline: () => setOffline(true),
    clear: () => setDaily(false),
    daily: () => setDaily(true),
    hq: () => { light = false; applyQuality(); updatePanel(); },
    lite: () => { light = true; applyQuality(); updatePanel(); },
    pause: () => { paused = !paused; updatePanel(); },
    restart: () => { paused = false; run(); updatePanel(); },
    fullscreen: toggleFullscreen,
  };
  function updatePanel() {
    const on = {
      online: mode === "online",
      offline: mode !== "online",
      clear: !dailyShown,
      daily: dailyShown,
      hq: !light,
      lite: light,
      pause: paused,
    };
    ui.panel.querySelectorAll("button[data-act]").forEach((b) => {
      const a = b.dataset.act;
      if (a in on) b.setAttribute("aria-pressed", String(on[a]));
      if (a === "daily") {
        b.disabled = !hasDaily();
        b.title = hasDaily() ? `NASA VIIRS ${dailyRangeText()}` : "Ei saatavilla tässä tilassa";
      }
    });
    ui.panel.querySelector('[data-act="pause"]').textContent = paused ? "Jatka" : "Tauko";
  }
  ui.panel.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-act]");
    if (!b) return;
    actions[b.dataset.act]();
    b.blur();
  });

  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === " ") { actions.pause(); e.preventDefault(); }
    else if (k === "r") actions.restart();
    else if (k === "d" && hasDaily()) setDaily(!dailyShown);
    else if (k === "f") toggleFullscreen();
    else if (k === "h") ui.panel.classList.toggle("hidden");
  });

  // Hiiren osoitin piiloon, kun hiirtä ei liikuteta
  let idleTimer;
  window.addEventListener("mousemove", () => {
    document.body.classList.remove("idle");
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => document.body.classList.add("idle"), 3000);
  });

  // Ruudunpäivitysnopeus
  let frames = 0, fpsT = performance.now();
  (function countFps(now) {
    frames++;
    if (now - fpsT >= 1000) {
      ui.fps.textContent = `${Math.round((frames * 1000) / (now - fpsT))} FPS`;
      frames = 0; fpsT = now;
    }
    requestAnimationFrame(countFps);
  })(fpsT);

  // Testejä varten
  window.__globe = { viewer, run, get mode() { return mode; } };

  ui.card.querySelector(".title").textContent = C.texts.title;
  ui.card.querySelector(".sub").textContent = C.texts.subtitle;

  // ---------- DSCOVR EPIC: aito valokuva koko valaistusta maapallosta ----------
  let epic = null;
  const EPIC_FOV_DEG = 0.61; // EPIC-kameran näkökenttä, kuva 2048 x 2048 px

  function pickEpic(list) {
    // Valitaan kuva, jonka keskipituuspiiri on sopivan matkan Oulusta itään, jotta pyöriminen
    // kestää noin tavoiteajan ja päättyy Oulun kohdalle.
    const want = C.spinDegPerSec * C.timing.spin;
    let best = null, bestScore = Infinity;
    for (const it of list) {
      const lon = it.centroid_coordinates.lon;
      const delta = (((lon - C.target.lon) % 360) + 360) % 360;
      const score = Math.abs(delta - want);
      if (score < bestScore) { best = it; bestScore = score; }
    }
    return best;
  }
  function epicInfo(it, src) {
    const p = it.dscovr_j2000_position || {};
    const dist = Math.hypot(p.x || 0, p.y || 0, p.z || 0) || 1500000; // km
    const diskDeg = (2 * Math.atan(6371 / dist) * 180) / Math.PI;
    return {
      src,
      date: it.date, // UTC
      lat: it.centroid_coordinates.lat,
      lon: it.centroid_coordinates.lon,
      distKm: dist,
      diskFraction: Math.min(0.95, diskDeg / EPIC_FOV_DEG),
    };
  }
  async function loadEpic() {
    if (!C.epic || !C.epic.enabled) return null;
    if (mode !== "online") return LOCAL && LOCAL.epic ? LOCAL.epic : null;
    for (const api of C.epic.apis) {
      try {
        const r = await fetch(api, { cache: "no-store" });
        if (!r.ok) continue;
        const list = await r.json();
        if (!Array.isArray(list) || !list.length) continue;
        const it = pickEpic(list);
        const [d] = it.date.split(" ");
        const [y, m, dd] = d.split("-");
        const src = C.epic.imageUrl
          .replace("{y}", y).replace("{m}", m).replace("{d}", dd).replace("{image}", it.image);
        const ok = await probe(src, 15000);
        if (ok) return epicInfo(it, src);
      } catch (e) { /* kokeillaan seuraavaa */ }
    }
    return null;
  }
  function sizeEpic() {
    if (!epic) return;
    // Maapallon halkaisija näytöllä samaksi kuin 3D-pallon avaruusnäkymässä
    const fovy = camera.frustum.fovy;
    const fill = C.globeFill || 0.72;
    const diskPx = (window.innerHeight * Math.tan((fovy / 2) * fill)) / Math.tan(fovy / 2);
    const imgPx = diskPx / epic.diskFraction;
    ui.epicImg.style.width = ui.epicImg.style.height = `${imgPx}px`;
  }
  window.addEventListener("resize", sizeEpic);

  function showEpicCaption() {
    if (!epic) return;
    const t = new Date(epic.date.replace(" ", "T") + "Z");
    const when = t.toLocaleString("fi-FI", {
      day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Helsinki",
    });
    const mkm = (epic.distKm / 1e6).toLocaleString("fi-FI", { maximumFractionDigits: 1 });
    ui.epicCap.textContent = `Valokuva ${when} · ${mkm} milj. km:n etäisyydeltä · NASA DSCOVR / EPIC`;
  }

  setupImagery()
    .then(loadEpic)
    .then((e) => {
      epic = e;
      if (epic) {
        ui.epicImg.src = epic.src;
        showEpicCaption();
        sizeEpic();
        // Ensimmäisellä kerralla valokuva näkyy heti ilman häivytystä
        ui.epic.style.transition = "none";
        ui.epic.classList.add("show");
        void ui.epic.offsetWidth;
        ui.epic.style.transition = "";
      }
      updateFooter();
    })
    .finally(run);
})();
