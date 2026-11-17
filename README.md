# Maapallo – Oulu

Pyörivä 3D-maapallo, joka lentää automaattisesti Suomeen ja Ouluun. Tehty FINverse- ja Ouluversumi-hankkeiden esittelyyn.

## Verkkoversio

Toimii sellaisenaan staattisena sivuna (esim. GitHub Pages). Kuvat haetaan suoraan NASAn ja Copernicuksen avoimista palveluista.

## Offline-versio tapahtumaan

1. **Kun verkko on käytössä** (esim. edellisenä päivänä), lataa kuvatiilet:
   ```
   python tools/lataa_tiilet.py --daily
   ```
   Lataa noin 6 500 tiiltä (pohjakuva, Suomi ja Oulu tarkkana, `--daily` lisää eilisen päiväkuvan). Keskeytyneen latauksen voi ajaa uudelleen, jo ladatut ohitetaan.
2. **Tapahtumassa** tuplaklikkaa `Käynnistä (Windows).bat` tai `Käynnistä (Mac).command`. Selain avautuu ja esitys käyttää vain paikallisia tiedostoja. Paina F, niin esitys menee koko näytölle.

Selain ei aja 3D-moottoria suoraan tiedostosta, joten käynnistystiedosto avaa pienen paikallisen palvelimen (Windowsissa PowerShell, Macissa Python). Mitään ei tarvitse asentaa.

`?offline` osoitteen perässä pakottaa offline-tilan. Ilman ladattuja tiiliä offline-tila näyttää Cesiumin mukana tulevan Natural Earth -kartan.

## Näppäimet

| Näppäin | Toiminto |
|---|---|
| Välilyönti | Tauko / jatka |
| R | Aloita alusta |
| D | Päivän satelliittikuva päälle / pois |
| F | Koko näyttö |
| H | Näytä ohje |

## Asetukset

Tekstit, ajoitukset, korkeudet ja kuvalähteet ovat tiedostossa `js/config.js`.

## Kuvalähteet (avoin data)

- **NASA GIBS, Blue Marble Next Generation**: pilvetön koko maapallon pohjakuva.
- **Sentinel-2 cloudless 2021, EOX IT Services GmbH** (sisältää muokattua Copernicus Sentinel -dataa 2021): tarkka pilvetön kuva Suomesta ja Oulusta. Lisenssi CC BY-NC-SA 4.0 (ei-kaupallinen käyttö).
- **NASA GIBS, VIIRS NOAA-20 Corrected Reflectance**: edellisen päivän satelliittikuva (näppäin D).
- Ilman verkkoyhteyttä: paikalliset tiilet kansiosta `tiles/` tai Cesiumin mukana tuleva Natural Earth II.

3D-moottori: [CesiumJS](https://cesium.com/platform/cesiumjs/) 1.120 (Apache 2.0), mukana kansiossa `vendor/cesium`.
