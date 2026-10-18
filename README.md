# 🎯 Dartking

Dartscore bijhouden op je telefoon. Kies je startpunten (101/301/501/701 of een eigen getal), het aantal spelers en de namen. Daarna tik je op het dartbord wat je gegooid hebt. Zodra je kunt uitgooien, laat de app zien hoe.

**Functies**
- Double out of single out, legs en sets (best of)
- Uitgooi-advies (bv. 170 = T20 · T20 · Bull), het doelvak knippert op het bord
- Bust-regels, ongedaan maken (ook over beurten heen)
- Statistieken: gemiddelde, hoogste beurt, 100+/140+/180, checkout-%
- Caller-stem ("One hundred and eighty!"), aan/uit met 🔊
- Spel hervatten na wegklikken, werkt offline

## Lokaal draaien

```sh
python3 -m http.server 8000
# open http://localhost:8000
npm test   # of: node tests/game.test.js
```

## Online zetten met GitHub Pages

1. Maak op github.com een nieuwe repository, bijvoorbeeld `dartking`.
2. Upload alle bestanden uit deze map (of push met git).
3. Ga in de repository naar **Settings → Pages**, kies bij *Source* "Deploy from a branch", branch `main`, map `/ (root)`, en klik **Save**.
4. Na een minuutje staat de app op `https://<jouw-gebruikersnaam>.github.io/dartking/`.

## Op de iPhone zetten

1. Open de link in **Safari** (niet in Chrome).
2. Tik op de **Deel**-knop (vierkantje met pijl omhoog).
3. Kies **Zet op beginscherm** en tik op **Voeg toe**.

De app opent dan schermvullend en werkt ook zonder internet.

## Een nieuwe versie uitrollen

Gewoon de gewijzigde bestanden uploaden: de app haalt met internet altijd de nieuwste versie op en gebruikt de opgeslagen kopie alleen offline. Komen er bestanden bij of verdwijnen er, voeg ze dan toe aan `FILES` in [sw.js](sw.js) en verhoog `VERSION`.
