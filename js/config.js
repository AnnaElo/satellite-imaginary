// Esityksen asetukset. Muokkaa tekstejä ja ajoituksia tästä tiedostosta.
window.GLOBE_CONFIG = {
  // Tekstit, jotka näytetään esityksen aikana
  texts: {
    title: "FINverse · Ouluversumi",
    subtitle: "Linnanmaa campus, University of Oulu",
    markerApproach: "Oulu",          // merkin teksti lennon aikana
    marker: "Linnanmaa campus",      // teksti, kun kamera on pysähtynyt kampukselle
    phaseEpic: "Earth today",
    phaseEarth: "Earth from space",
    phaseFinland: "Finland",
  },

  // Kohde: Oulun yliopiston Linnanmaan kampus
  target: { lat: 65.0592, lon: 25.4664 },
  finland: { lat: 64.6, lon: 26.0 },

  // Ajoitukset sekunteina
  timing: {
    epicHold: 10,      // aito EPIC-valokuva koko maapallosta näkyvissä
    epicFade: 2.5,     // valokuva vaihtuu 3D-palloksi
    spin: 20,          // vapaa pyöriminen ennen lentoa (tavoite; EPIC-kuvan kanssa 10–30 s)
    flyToFinland: 8,   // lento Suomen yläpuolelle
    holdFinland: 4,    // tauko Suomen kohdalla
    flyToTarget: 8,    // lento Linnanmaalle
    holdTarget: 18,    // tauko Linnanmaalla (hankkeiden nimet näkyvissä)
    flyOut: 8,         // paluu avaruuteen, sitten silmukka alkaa alusta
  },

  // Pyörimisnopeus (astetta sekunnissa)
  spinDegPerSec: 6,

  // Kuinka suuren osan näytön korkeudesta maapallo täyttää avaruusnäkymässä (0–1)
  globeFill: 0.72,

  // Kameran korkeudet metreinä
  heights: {
    finland: 1800000,
    target: 2600,          // kun Maanmittauslaitoksen ilmakuva on käytössä
    targetNoAerial: 9000,  // ilman ilmakuvaa (Sentinel-2 ei ole tarkka lähietäisyydeltä)
  },
  targetPitchDeg: -50,

  // Aito valokuva koko maapallosta: NASA DSCOVR -satelliitin EPIC-kamera noin 1,5 milj. km:n päästä.
  // Kuvat julkaistaan yleensä 12–36 tunnin viiveellä.
  epic: {
    enabled: true,
    apis: [
      "https://epic.gsfc.nasa.gov/api/natural",
      "https://api.nasa.gov/EPIC/api/natural?api_key=DEMO_KEY",
    ],
    imageUrl: "https://epic.gsfc.nasa.gov/archive/natural/{y}/{m}/{d}/png/{image}.png",
  },

  // Uusin ilmakuva (ortokuva) Linnanmaalta: Maanmittauslaitoksen avoin rajapinta, CC BY 4.0.
  // Vaatii maksuttoman API-avaimen. Ilman avainta lähikuvana näkyy Sentinel-2.
  aerial: {
    apiKey: "",
    url: "https://avoin-karttakuva.maanmittauslaitos.fi/avoin/wmts/1.0.0/ortokuva/default/WGS84_Pseudo-Mercator/{z}/{y}/{x}.jpg?api-key={key}",
    minLevel: 11,
    maxLevel: 18,
    bounds: [25.2, 64.95, 25.75, 65.15], // länsi, etelä, itä, pohjoinen
    caption: "Aerial photo · National Land Survey of Finland",
    year: "", // kuvausvuosi, jos tiedossa (esim. "2024")
  },

  // Satelliittikuvat (avoin data)
  imagery: {
    // Pilvetön koko maapallon pohjakuva: NASA Blue Marble Next Generation
    baseUrl:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/BlueMarble_NextGeneration/default/GoogleMapsCompatible_Level8/{z}/{y}/{x}.jpeg",
    baseMaxLevel: 8,

    // Tarkka pilvetön Sentinel-2-mosaiikki (Copernicus, EOX). Lisenssi CC BY-NC-SA 4.0.
    detailUrl:
      "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/g/{z}/{y}/{x}.jpg",
    detailMinLevel: 3,
    detailMaxLevel: 15,
  },
};
