# Maapallo – Oulu

Pyörivä 3D-maapallo, joka lentää automaattisesti Suomeen ja Ouluun. Tehty FINverse- ja Ouluversumi-hankkeiden esittelyyn.

## Verkkoversio

Toimii sellaisenaan staattisena sivuna (esim. GitHub Pages). Kuvat haetaan suoraan NASAn ja Copernicuksen avoimista palveluista.

## Offline-versio tapahtumaan

1. **Kun verkko on käytössä** (esim. edellisenä päivänä), lataa kuvatiilet:
   ```
   python tools/lataa_tiilet.py --daily
   ```
   Lataa noin 6 500 tiiltä ja tuoreimman EPIC-valokuvan (pohjakuva, Suomi ja Oulu tarkkana, `--daily` lisää kahden viime päivän tuoreet kuvat). Keskeytyneen latauksen voi ajaa uudelleen, jo ladatut ohitetaan.
2. **Tapahtumassa** tuplaklikkaa `Käynnistä (Windows).bat` tai `Käynnistä (Mac).command`. Selain avautuu ja esitys käyttää vain paikallisia tiedostoja. Paina F, niin esitys menee koko näytölle, ja H, jos haluat piilottaa valikon.

Selain ei aja 3D-moottoria suoraan tiedostosta, joten käynnistystiedosto avaa pienen paikallisen palvelimen (Windowsissa PowerShell, Macissa Python). Mitään ei tarvitse asentaa.

`?kevyt` osoitteen perässä kevyempi tila heikoille koneille. `?offline` osoitteen perässä pakottaa offline-tilan. Ilman ladattuja tiiliä offline-tila näyttää Cesiumin mukana tulevan Natural Earth -kartan.

## Valikko ja näppäimet

Oikeassa yläkulmassa on valikko, josta valitaan katselutapa:

- **Lähde:** Verkko (kuvat suoraan NASAlta ja Copernicukselta) tai Offline (vain kansion `tiles/` kuvat)
- **Kuva:** Pilvetön kuvakooste tai Tuore (kolmen VIIRS-satelliitin kuvat kahdelta viime päivältä pilvineen; napayön alue näytetään pilvettömänä)
- **Laatu:** Tarkka (näytön täysi tarkkuus) tai Kevyt (heikoille koneille)
- **Esitys:** Tauko, Alusta, Koko näyttö
- Ruudunpäivitysnopeus (FPS) näkyy valikon alareunassa

| Näppäin | Toiminto |
|---|---|
| Välilyönti | Tauko / jatka |
| R | Aloita alusta |
| D | Tuore satelliittikuva päälle / pois |
| F | Koko näyttö |
| H | Piilota / näytä valikko |

## Asetukset

Tekstit, ajoitukset, korkeudet ja kuvalähteet ovat tiedostossa `js/config.js`.

## Kuvalähteet (avoin data)

- **NASA DSCOVR / EPIC**: aito valokuva koko valaistusta maapallosta noin 1,5 milj. km:n päästä. Esitys alkaa tällä kuvalla, joka vaihtuu 3D-palloksi. Tuorein kuva haetaan automaattisesti (julkaisuviive yleensä 12–36 h); offline-latausskripti lataa sen mukaan.

- **NASA GIBS, Blue Marble Next Generation**: pilvetön koko maapallon pohjakuva.
- **Sentinel-2 cloudless 2021, EOX IT Services GmbH** (sisältää muokattua Copernicus Sentinel -dataa 2021): tarkka pilvetön kuva Suomesta ja Oulusta. Lisenssi CC BY-NC-SA 4.0 (ei-kaupallinen käyttö).
- **NASA GIBS, VIIRS Corrected Reflectance** (Suomi NPP, NOAA-20, NOAA-21): kahden viime päivän satelliittikuvat yhdistettynä, tuorein päällimmäisenä (Tuore / näppäin D).
- Ilman verkkoyhteyttä: paikalliset tiilet kansiosta `tiles/` tai Cesiumin mukana tuleva Natural Earth II.

3D-moottori: [CesiumJS](https://cesium.com/platform/cesiumjs/) 1.120 (Apache 2.0), mukana kansiossa `vendor/cesium`.
