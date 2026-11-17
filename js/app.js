/* Pyörivä maapallo, joka kohdistuu Suomeen ja Oulun yliopiston Linnanmaan kampukselle.
 * Toimii verkossa (NASA GIBS, Copernicus Sentinel-2, Maanmittauslaitoksen ilmakuva, NASA EPIC)
 * ja offline-tilassa (paikalliset tiedostot kansiossa tiles/, tai Cesiumin oma Natural Earth -kartta).
 * Sivun tekstit ovat englanniksi; ne muokataan tiedostossa js/config.js. */
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
    aerialCap: $("aerial-cap"),
    info: $("info"),
    reticle: $("reticle"),
    leader: $("leader"),
    leaderLine: document.querySelector("#leader line"),
    fps: $("fps"),
  };

  // ---------- Apufunktiot ----------
  // cors = true testaa samalla tavalla kuin 3D-moottori lataa kuvat (vaatii CORS-otsakkeet)
  function probe(url, ms, cors) {
    return new Promise((resolve) => {
      const img = new Image();
      if (cors) img.crossOrigin = "anonymous";
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
  function tileOf(lat, lon, z) {
    const n = 2 ** z;
    const r = (lat * Math.PI) / 180;
    return [z, Math.floor(((lon + 180) / 360) * n),
      Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
  }
  const fmtCoord = (v, pos, neg) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;

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
    // Piirretään näytön todellisella tarkkuudella (Cesium piirtää oletuksena CSS-pikseleinä).
    useBrowserRecommendedResolution: false,
    contextOptions: { webgl: { powerPreference: "high-performance", antialias: false } },
  });
  const scene = viewer.scene;
  const camera = viewer.camera;
  // Tarkkuus: ?light = kevyempi tila heikoille koneille. Muuten enintään 2x näytön tiheys.
  let light = params.has("light") || params.has("kevyt");
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

  // Linnanmaan kampuksen merkki näkyy vasta lähempänä
  const marker = viewer.entities.add({
    position: Cesium.Cartesian3.fromDegrees(C.oulu.lon, C.oulu.lat),
    point: {
      pixelSize: 12,
      color: Cesium.Color.fromCssColorString("#ffd166"),
      outlineColor: Cesium.Color.fromCssColorString("#0b1a2e"),
      outlineWidth: 2,
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2500000),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
    label: {
      text: C.texts.markerApproach || C.texts.marker,
      font: "600 22px system-ui, 'Segoe UI', sans-serif",
      fillColor: Cesium.Color.WHITE,
      outlineColor: Cesium.Color.fromCssColorString("#0b1a2e"),
      outlineWidth: 4,
      style: Cesium.LabelStyle.FILL_AND_OUTLINE,
      pixelOffset: new Cesium.Cartesian2(0, -48),
      distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 2500000),
      disableDepthTestDistance: Number.POSITIVE_INFINITY,
    },
  });

  // Merkissä lukee "Oulu" lennon ajan ja "Linnanmaa campus", kun kamera on pysähtynyt kampukselle
  // Lennon ajan merkki on Oulun keskustassa; kampukselle pysähdyttäessä se siirtyy kampukselle.
  function setMarker(text, place) {
    marker.label.text = text;
    if (place) marker.position = Cesium.Cartesian3.fromDegrees(place.lon, place.lat);
  }

  // ---------- Oulun infolaatikko ----------
  function daylightText(lat, date) {
    // Valoisan ajan pituus (auringon keskipiste -0,833°), tarkkuus muutamia minuutteja
    const start = Date.UTC(date.getUTCFullYear(), 0, 0);
    const n = Math.floor((date - start) / 86400000);
    const rad = Math.PI / 180;
    const decl = -23.44 * Math.cos(((2 * Math.PI) / 365) * (n + 10));
    const cosH = (Math.sin(-0.833 * rad) - Math.sin(lat * rad) * Math.sin(decl * rad)) /
      (Math.cos(lat * rad) * Math.cos(decl * rad));
    if (cosH >= 1) return "Polar night (0 h)";
    if (cosH <= -1) return "Midnight sun (24 h)";
    const hours = (2 * Math.acos(cosH)) / rad / 15;
    const h = Math.floor(hours), m = Math.round((hours - h) * 60);
    return `${h} h ${String(m).padStart(2, "0")} min`;
  }
  function buildInfo(o) {
    ui.info.querySelector(".hud-title").textContent = o.name;
    const dl = ui.info.querySelector(".hud-data");
    dl.innerHTML = "";
    o.data.forEach(([k, v], i) => {
      const row = document.createElement("div");
      row.className = "hud-row";
      row.style.setProperty("--i", i);
      const dt = document.createElement("dt");
      dt.textContent = k;
      const dd = document.createElement("dd");
      dd.textContent = v.replace("{daylight}", daylightText(C.oulu.lat, new Date()));
      row.append(dt, dd);
      dl.append(row);
    });
    const an = ui.info.querySelector(".hud-analysis");
    an.textContent = o.analysis;
    an.style.setProperty("--i", o.data.length + 1);
    ui.info.querySelector(".hud-source").textContent = o.source || "";
  }
  let infoOpen = false;
  let infoAnchor = null;
  // place = paikka, jonka oikealle puolelle laatikko tulee; info = laatikon sisältö
  function showInfo(on, place, info) {
    infoOpen = on;
    if (on) {
      buildInfo(info);
      infoAnchor = Cesium.Cartesian3.fromDegrees(place.lon, place.lat);
    }
    ui.info.classList.toggle("show", on);
    ui.reticle.classList.toggle("show", on);
    ui.leader.classList.toggle("show", on);
  }
  // Laatikko seuraa Oulun paikkaa näytöllä ja on aina sen oikealla puolella
  const scratch = new Cesium.Cartesian2();
  function placeInfo() {
    if (!infoOpen || !infoAnchor) return;
    const p = scene.cartesianToCanvasCoordinates(infoAnchor, scratch);
    if (!p) return;
    const x = p.x, y = p.y;
    ui.reticle.style.transform = `translate(${x}px, ${y}px)`;
    const gap = Math.min(140, window.innerWidth * 0.08);
    const boxX = x + gap;
    const boxH = ui.info.offsetHeight;
    const boxY = Math.max(16, Math.min(window.innerHeight - boxH - 60, y - boxH * 0.35));
    ui.info.style.transform = `translate(${boxX}px, ${boxY}px)`;
    const ly = Math.max(boxY + 24, Math.min(boxY + boxH - 24, y));
    ui.leaderLine.setAttribute("x1", x + 28);
    ui.leaderLine.setAttribute("y1", y);
    ui.leaderLine.setAttribute("x2", boxX);
    ui.leaderLine.setAttribute("y2", ly);
  }

  // ---------- Kuvatasot ----------
  let mode = "online";
  let aerial = false; // onko Maanmittauslaitoksen ilmakuva käytössä

  async function setupImagery() {
    const im = C.imagery;
    const layers = scene.imageryLayers;
    const online = !forceOffline && (await probe(im.baseUrl.replace("{z}/{y}/{x}", "0/0/0"), 5000));

    if (online) {
      mode = "online";
      layers.addImageryProvider(wmLayer(im.baseUrl, 0, im.baseMaxLevel));
      layers.addImageryProvider(wmLayer(im.detailUrl, im.detailMinLevel, im.detailMaxLevel));
      const a = C.aerial;
      if (a && a.apiKey) {
        const url = a.url.replace("{key}", encodeURIComponent(a.apiKey));
        // Testataan Linnanmaan kohdalta, koska ilmakuva kattaa vain Suomen
        const [tz, tx, ty] = tileOf(C.target.lat, C.target.lon, 15);
        const testUrl = url.replace("{z}", tz).replace("{x}", tx).replace("{y}", ty);
        const ok = await probe(testUrl, 8000, true);
        if (!ok) console.warn("Aerial photo not available:", testUrl, "(no-CORS test:", await probe(testUrl, 8000, false), ")");
        if (ok) {
          layers.addImageryProvider(
            wmLayer(url, a.minLevel, a.maxLevel, Cesium.Rectangle.fromDegrees(...a.bounds))
          );
          aerial = true;
        }
      }
    } else if (LOCAL) {
      mode = "offline";
      for (const l of LOCAL.layers) {
        if (l.group === "daily") continue; // vanhat latauspaketit
        const rect = l.bounds ? Cesium.Rectangle.fromDegrees(...l.bounds) : undefined;
        layers.addImageryProvider(
          wmLayer(`tiles/${l.name}/{z}/{x}/{y}.${l.ext || "jpg"}`, l.minLevel, l.maxLevel, rect)
        );
        if (l.name === "aerial") aerial = true;
      }
    } else {
      mode = "fallback";
      const provider = await Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl("Assets/Textures/NaturalEarthII")
      );
      layers.addImageryProvider(provider);
    }

    updateFooter();
    updatePanel();
    if (mode === "online") preloadTarget();
  }

  // Ladataan kohteen tarkat tiilet valmiiksi selaimen välimuistiin,
  // jotta lähikuva on terävä heti laskeutumisen jälkeen.
  function preloadTarget() {
    const t = C.target;
    const urls = [];
    const add = (template, levels) => {
      for (const [zs, d] of Object.entries(levels)) {
        const z = Number(zs);
        const n = 2 ** z;
        const tx = (lon) => Math.floor(((lon + 180) / 360) * n);
        const ty = (lat) => {
          const r = (lat * Math.PI) / 180;
          return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n);
        };
        for (let x = tx(t.lon - d * 2); x <= tx(t.lon + d * 2); x++)
          for (let y = ty(t.lat + d); y <= ty(t.lat - d); y++)
            urls.push(template.replace("{z}", z).replace("{x}", x).replace("{y}", y));
      }
    };
    add(C.imagery.detailUrl, { 9: 1.2, 10: 0.8, 11: 0.5, 12: 0.3, 13: 0.18, 14: 0.1 });
    if (aerial) {
      const url = C.aerial.url.replace("{key}", encodeURIComponent(C.aerial.apiKey));
      add(url, { 14: 0.05, 15: 0.03, 16: 0.02, 17: 0.012 });
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

  function updateFooter() {
    const parts = [];
    if (mode === "fallback") {
      parts.push("Map: Natural Earth II (no internet connection)");
    } else {
      if (epic) parts.push("Earth photo: NASA DSCOVR / EPIC");
      parts.push("Imagery: NASA GIBS Blue Marble");
      parts.push("Sentinel-2 cloudless 2021 by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2021)");
      if (aerial) parts.push("Aerial photo: National Land Survey of Finland, CC BY 4.0");
    }
    ui.source.textContent = parts.join(" · ");
    ui.mode.textContent =
      mode === "online" ? "Online" : mode === "offline" ? "Offline" : "Offline (basic map)";
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

  // Pyörimisen aloituskohta ja kesto. Pyöriminen päättyy täsmälleen kohteen pituuspiirille.
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

  // Kameran paikka, josta katsotaan vinosti kohteeseen (kohde keskellä kuvaa)
  function viewOf(lat, lon, height, pitchDeg) {
    const back = height / Math.tan(Cesium.Math.toRadians(Math.abs(pitchDeg))); // metriä etelään
    return {
      destination: Cesium.Cartesian3.fromDegrees(lon, lat - back / 111320, height),
      orientation: { heading: 0, pitch: Cesium.Math.toRadians(pitchDeg), roll: 0 },
    };
  }

  scene.preRender.addEventListener(() => {
    const now = performance.now();
    const dt = (now - (scene._lastSpin || now)) / 1000;
    scene._lastSpin = now;
    placeInfo();
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
    ui.aerialCap.classList.remove("show");
    setMarker(C.texts.markerApproach || C.texts.marker, C.oulu);
    showInfo(false);
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
      const fin = viewOf(C.finland.lat, C.finland.lon, C.heights.finland, -62);
      if (!(await fly(fin.destination, T.flyToFinland, fin.orientation, id))) return;
      if (!(await wait(T.holdFinland, id))) return;

      // 3. Oulu: pysähdys ja infolaatikko
      setPhase(null);
      const ov = viewOf(C.oulu.lat, C.oulu.lon, C.heights.oulu, -58);
      if (!(await fly(ov.destination, T.flyToOulu, ov.orientation, id))) return;
      showInfo(true, C.oulu, C.oulu);
      if (!(await wait(T.holdOulu, id))) return;
      showInfo(false);

      // 4. Linnanmaan kampus
      const h = aerial ? C.heights.target : C.heights.targetNoAerial;
      const tv = viewOf(C.target.lat, C.target.lon, h, C.targetPitchDeg);
      if (!(await fly(tv.destination, T.flyToTarget, tv.orientation, id))) return;
      setMarker(C.texts.marker, C.target);
      showInfo(true, C.target, C.campusInfo);
      ui.card.classList.add("show");
      if (aerial) ui.aerialCap.classList.add("show");
      if (!(await wait(T.holdTarget, id))) return;
      ui.card.classList.remove("show");
      ui.aerialCap.classList.remove("show");
      showInfo(false);
      setMarker(C.texts.markerApproach || C.texts.marker, C.oulu);

      // 5. Takaisin avaruuteen ja alusta
      setPhase(null);
      if (!(await fly(spinStartPosition(), T.flyOut, lookDown, id))) return;
    }
  }

  // ---------- Valikko ja näppäimet ----------
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
      hq: !light,
      lite: light,
      pause: paused,
    };
    ui.panel.querySelectorAll("button[data-act]").forEach((b) => {
      const a = b.dataset.act;
      if (a in on) b.setAttribute("aria-pressed", String(on[a]));
    });
    ui.panel.querySelector('[data-act="pause"]').textContent = paused ? "Resume" : "Pause";
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
  window.__globe = { viewer, run, get mode() { return mode; }, get aerial() { return aerial; } };

  ui.card.querySelector(".eyebrow").textContent =
    `${fmtCoord(C.target.lat, "N", "S")} · ${fmtCoord(C.target.lon, "E", "W")}`;
  ui.card.querySelector(".title").textContent = C.texts.title;
  ui.card.querySelector(".sub").textContent = C.texts.subtitle;
  ui.aerialCap.textContent = C.aerial.caption + (C.aerial.year ? ` · ${C.aerial.year}` : "");

  // ---------- DSCOVR EPIC: aito valokuva koko valaistusta maapallosta ----------
  let epic = null;
  const EPIC_FOV_DEG = 0.61; // EPIC-kameran näkökenttä, kuva 2048 x 2048 px

  function pickEpic(list) {
    // Valitaan kuva, jonka keskipituuspiiri on sopivan matkan kohteesta itään, jotta pyöriminen
    // kestää noin tavoiteajan ja päättyy kohteen kohdalle.
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
    const when = t.toLocaleString("en-GB", {
      day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit",
      timeZone: "Europe/Helsinki",
    });
    const mkm = (epic.distKm / 1e6).toLocaleString("en-GB", { maximumFractionDigits: 1 });
    ui.epicCap.textContent =
      `Photographed ${when} (Finnish time) · ${mkm} million km away · NASA DSCOVR / EPIC`;
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
