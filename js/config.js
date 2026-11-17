// Esityksen asetukset. Muokkaa tekstejä ja ajoituksia tästä tiedostosta.
window.GLOBE_CONFIG = {
  // Tekstit, jotka näytetään esityksen aikana
  texts: {
    title: "FINverse · Ouluversumi",
    subtitle: "Oulu, Suomi",
    phaseEarth: "Maapallo avaruudesta",
    phaseFinland: "Suomi",
    phaseOulu: "Oulu",
  },

  // Kohde (Oulun keskusta)
  target: { lat: 65.0121, lon: 25.4651 },
  finland: { lat: 64.6, lon: 26.0 },

  // Ajoitukset sekunteina
  timing: {
    spin: 20,          // vapaa pyöriminen ennen lentoa
    flyToFinland: 8,   // lento Suomen yläpuolelle
    holdFinland: 4,    // tauko Suomen kohdalla
    flyToOulu: 7,      // lento Ouluun
    holdOulu: 18,      // tauko Oulussa (hankkeiden nimet näkyvissä)
    flyOut: 8,         // paluu avaruuteen, sitten silmukka alkaa alusta
  },

  // Pyörimisnopeus (astetta sekunnissa)
  spinDegPerSec: 6,

  // Kuinka suuren osan näytön korkeudesta maapallo täyttää avaruusnäkymässä (0–1)
  globeFill: 0.72,

  // Kameran korkeudet metreinä
  heights: {
    finland: 1800000,
    oulu: 18000,
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

    // Päivittäinen satelliittikuva (NASA GIBS, VIIRS NOAA-20). {time} = eilinen päivä (UTC).
    // PNG, jotta kuvaamattomat alueet (yö, ratojen välit) ovat läpinäkyviä ja pohjakuva näkyy niiden alta.
    dailyUrl:
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_NOAA20_CorrectedReflectance_TrueColor/default/{time}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.png",
    dailyMaxLevel: 9,
    dailyDaysBack: 1,
    showDailyAtStart: false,
  },
};
