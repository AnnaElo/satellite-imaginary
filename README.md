# Maapallo – Oulu

Pyörivä 3D-maapallo, joka lentää automaattisesti Suomeen ja Ouluun. Tehty FINverse- ja Ouluversumi-hankkeiden esittelyyn.

## Käynnistys

Sivu tarvitsee pienen paikallisen palvelimen (selain ei aja 3D-moottorin työsäikeitä suoraan tiedostosta):

```
python -m http.server 8000
```

ja avaa selaimessa http://localhost:8000. Verkkoversio toimii sellaisenaan esim. GitHub Pagesissa.

`?offline` osoitteen perässä pakottaa offline-tilan.

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
