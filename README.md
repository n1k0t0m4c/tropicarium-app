# 🌿 Tropicarium — Content Pipeline

Enostavna spletna aplikacija za upravljanje idej za video vsebine, organiziranih po mesecih. Zasnovana za ekipe, ki načrtujejo kratke in dolge video formate ter jih usklajujejo prek Google Preglednic kot zalednega sistema.

---

## Posnetek zaslona

> Aplikacija deluje v brskalniku brez namestitve — odpreti je dovolj ena HTML datoteka.

---

## Funkcionalnosti

- **Mesečni pregled** — ideje za videe so razporejene po mesecih v zložljivih razdelkih
- **Dodajanje idej** — za vsako idejo lahko shraniš naslov, tip videa, referenčno povezavo, Google Drive video, opis objave in skript
- **Dva tipa videa** — Short (≈10 s) in Long (≈25 s)
- **Sistem prioritet** — tristopenjska ocena z zvezdicami (Ideja / Morda / Nujno)
- **Predvajanje videov** — Google Drive videi se predvajajo neposredno znotraj kartice
- **Urejanje na mestu** — opis in skript je mogoče urejati brez ponovnega odpiranja obrazca
- **Brisanje idej** — s potrditvenim dialogom za preprečitev napak
- **Sinhronizacija z Google Preglednicami** — podatki se v realnem času berejo in zapisujejo prek Google Apps Script
- **Indikator sinhronizacije** — vedno vidiš, kdaj so podatki posodobljeni
- **Odzivna zasnova** — deluje na namiznih računalnikih in mobilnih napravah

---

## Tehnologije

| Plast | Tehnologija |
|---|---|
| Frontend | Čisti HTML5, CSS3, JavaScript (brez ogrodij) |
| Stilizacija | [Tailwind CSS](https://tailwindcss.com/) (CDN) |
| Pisave | Google Fonts — Poppins, Playfair Display |
| Zaledje | [Google Apps Script](https://script.google.com/) kot REST API |
| Shramba | Google Preglednice |

---

## Namestitev in nastavitev

### 1. Pripravi Google Preglednico

1. Ustvari novo Google Preglednico.
2. Poimenuj prvi list (npr. `Videos`).
3. V prvo vrstico dodaj naslednje stolpce točno v tem vrstnem redu:

```
id | title | type | month | link | driveLink | caption | script | stars | createdAt
```

### 2. Ustvari Google Apps Script

1. V preglednici odpri **Razširitve → Apps Script**.
2. Zamenjaj privzeto vsebino z naslednjim skriptom:

```javascript
const SHEET_NAME = 'Videos';

function doGet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const rows = sheet.getDataRange().getValues();
  const headers = rows[0];
  const videos = rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  return ContentService
    .createTextOutput(JSON.stringify(videos))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const data = JSON.parse(e.postData.contents);

  if (data.action === 'delete') {
    const rows = sheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      if (rows[i][0] === data.id) {
        sheet.deleteRow(i + 1);
        break;
      }
    }
    return ContentService.createTextOutput('deleted');
  }

  sheet.appendRow([
    data.id, data.title, data.type, data.month,
    data.link, data.driveLink, data.caption,
    data.script, data.stars, data.createdAt
  ]);
  return ContentService.createTextOutput('saved');
}
```

3. Klikni **Uvedi → Nova uvedba**.
4. Tip uvede: **Spletna aplikacija**.
5. Dostop nastavi na: **Kdorkoli** (*Anyone*).
6. Klikni **Uvedi** in **kopiraj URL** spletne aplikacije.

### 3. Nastavi aplikacijo

Odpri `index.html` in poišči naslednjo vrstico (blizu vrha skripta):

```javascript
const API_URL = "TVOJ_URL_SEM";
```

Zamenjaj `TVOJ_URL_SEM` z URL-jem, ki si ga kopiral v prejšnjem koraku:

```javascript
const API_URL = "https://script.google.com/macros/s/AKfyc.../exec";
```

### 4. Odpri aplikacijo

Datoteko `index.html` odpri neposredno v brskalniku ali jo gostuj na katerikoli statični gostovalni storitvi (GitHub Pages, Netlify, Vercel …).

---

## Struktura podatkov

Vsaka video ideja vsebuje naslednja polja:

| Polje | Tip | Opis |
|---|---|---|
| `id` | string | Unikaten identifikator (`video_` + timestamp) |
| `title` | string | Naslov videa |
| `type` | string | `Short` ali `Long` |
| `month` | string | Mesec in leto (npr. `June 2026`) |
| `link` | string | Referenčna URL povezava |
| `driveLink` | string | Javna Google Drive povezava do video datoteke |
| `caption` | string | Besedilo objave za socialna omrežja |
| `script` | string | Skript za snemanje |
| `stars` | number | Prioriteta: `1` = Ideja, `2` = Morda, `3` = Nujno |
| `createdAt` | string | ISO 8601 časovni žig |

---

## Lokalni demo brez API-ja

Aplikacija samodejno zazna, ali je `API_URL` pravilno nastavljen. Če ni, se naloži z vzorčnimi podatki, da si jo lahko ogledaš brez nastavitve zaledja. V tem primeru se v zgornjem delu prikaže opozorilo.

---

## Znane omejitve

- Aplikacija ne podpira več hkratnih pisanj (zadnje shranjevanje zmaga — *last-write-wins*).
- Google Apps Script ima dnevne kvote za branje/pisanje — za manjše ekipe so te kvote več kot zadostne.
- Google Drive videi morajo biti deljeni z nastavitvijo **»Kdorkoli s povezavo«**, da se predvajajo znotraj aplikacije.

---

## Licenca

MIT — prosto za osebno in komercialno uporabo.
