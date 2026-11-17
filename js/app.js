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
    hint: $("hint"),
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
  const light = params.has("kevyt");
  const dpr = window.devicePixelRatio || 1;
  viewer.resolutionScale = light ? 1 / dpr : Math.min(dpr, 2) / dpr;
  scene.postProcessStages.fxaa.enabled = true;
  scene.fog.enabled = true;
  scene.globe.enableLighting = false;
  scene.globe.showGroundAtmosphere = true;
  scene.globe.maximumScreenSpaceError = light ? 3 : 2;
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
  let dailyLayer = null;
  let dailyDateIso = null;
  let mode = "online";

  async function setupImagery() {
    const im = C.imagery;
    const layers = scene.imageryLayers;
    const online = !forceOffline && (await probe(im.baseUrl.replace("{z}/{y}/{x}", "0/0/0"), 5000));

    if (online) {
      mode = "online";
      layers.addImageryProvider(wmLayer(im.baseUrl, 0, im.baseMaxLevel));
      layers.addImageryProvider(wmLayer(im.detailUrl, im.detailMinLevel, im.detailMaxLevel));
      dailyDateIso = isoDateDaysAgo(im.dailyDaysBack);
      dailyLayer = layers.addImageryProvider(
        wmLayer(im.dailyUrl.replace("{time}", dailyDateIso), 0, im.dailyMaxLevel)
      );
    } else if (LOCAL) {
      mode = "offline";
      for (const l of LOCAL.layers) {
        const rect = l.bounds ? Cesium.Rectangle.fromDegrees(...l.bounds) : undefined;
        const layer = layers.addImageryProvider(
          wmLayer(`tiles/${l.name}/{z}/{x}/{y}.jpg`, l.minLevel, l.maxLevel, rect)
        );
        if (l.name === "daily") { dailyLayer = layer; dailyDateIso = l.date; }
      }
    } else {
      mode = "fallback";
      const provider = await Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
      );
      layers.addImageryProvider(provider);
    }

    if (dailyLayer) dailyLayer.show = im.showDailyAtStart;
    updateFooter();
  }

  function updateFooter() {
    const parts = [];
    if (mode === "fallback") {
      parts.push("Kartta: Natural Earth II (verkkoyhteys puuttuu)");
    } else {
      parts.push("Satelliittikuvat: NASA GIBS Blue Marble");
      parts.push("Sentinel-2 cloudless 2021, EOX IT Services GmbH (sis. muokattua Copernicus Sentinel -dataa 2021)");
      if (dailyLayer && dailyLayer.show && dailyDateIso) {
        parts.unshift(`Päivän kuva ${fiDate(dailyDateIso)}: NASA GIBS / VIIRS NOAA-20`);
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

  // Aloituspaikka valitaan niin, että pyöriminen päättyy täsmälleen Oulun pituuspiirille.
  function spinStartPosition() {
    const lon = C.target.lon + C.spinDegPerSec * C.timing.spin;
    return Cesium.Cartesian3.fromDegrees(lon, 28, spaceHeight());
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
      // 1. Vapaa pyöriminen
      setPhase(C.texts.phaseEarth);
      spinning = true;
      if (!(await wait(T.spin, id))) return;
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

  // ---------- Näppäimet ----------
  window.addEventListener("keydown", (e) => {
    const k = e.key.toLowerCase();
    if (k === " ") { paused = !paused; e.preventDefault(); }
    else if (k === "r") run();
    else if (k === "d" && dailyLayer) { dailyLayer.show = !dailyLayer.show; updateFooter(); }
    else if (k === "f") {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => {});
    } else if (k === "h") ui.hint.classList.toggle("show");
    else if (k === "p") scene.debugShowFramesPerSecond = !scene.debugShowFramesPerSecond;
  });
  setTimeout(() => ui.hint.classList.remove("show"), 8000);

  // Testejä varten
  window.__globe = { viewer, run, get mode() { return mode; } };

  ui.card.querySelector(".title").textContent = C.texts.title;
  ui.card.querySelector(".sub").textContent = C.texts.subtitle;

  setupImagery().then(run);
})();
