# Getting Mílù onto your phone

Three parts. Only the first is required.

1. **[Put it online](#1-put-it-online)** — about 5 minutes, one time
2. **[Add it to your home screen](#2-add-it-to-your-home-screen)** — 30 seconds, on each phone
3. **[Turn on the leaderboard](#3-turn-on-the-leaderboard-optional)** — about 10 minutes, optional

---

## 1. Put it online

iPhones won't let a web app live purely on the phone — Safari's "Add to Home
Screen" needs a real web address. But once it's installed the app caches itself
onto the phone and runs with no signal at all. So this is a one-time job, not
something you'll keep doing.

GitHub Pages is free forever, has no ads, and your sister needs no account to
use it.

### Create the account and repository

1. Go to **[github.com/signup](https://github.com/signup)** and make a free
   account (skip if you have one).
2. Go to **[github.com/new](https://github.com/new)**.
3. **Repository name:** `milu`
4. Leave it **Public**. (Private repos can't use free GitHub Pages. Nothing
   here is sensitive — no personal data, no keys.)
5. Don't tick "Add a README".
6. Click **Create repository**.

### Upload the app

On the next page click **uploading an existing file**, then drag in
**everything inside the `milu` folder** — `index.html`, `sw.js`,
`manifest.webmanifest`, and the `css`, `js`, `data`, `icons`, `vendor` folders.

> Drag the *contents* of `milu`, not the `milu` folder itself. `index.html`
> must end up at the top level of the repository.

Scroll down, click **Commit changes**.

<details>
<summary>Or, if you'd rather use the command line</summary>

```bash
cd "/Users/rosscharles/Documents/Claude AI/Personal/Chinese Learning/milu"
git init
git add -A
git commit -m "Mílù: Chinese learning app"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/milu.git
git push -u origin main
```
</details>

### Switch Pages on

1. In your repository, click **Settings** (top right).
2. Click **Pages** in the left sidebar.
3. Under **Source**, choose **Deploy from a branch**.
4. Branch: **main**, folder: **/ (root)**. Click **Save**.
5. Wait 1–2 minutes, then refresh the page. Your address appears at the top:

   ```
   https://YOUR-USERNAME.github.io/milu/
   ```

That's your app. Open it in Safari on your phone.

### Later, when you change something

Upload the changed files the same way (or `git push`). One extra step: open
`sw.js` and bump the version line, otherwise phones keep serving the old copy
from their cache.

```js
const VERSION = 'milu-v2';   // was milu-v1
```

---

## 2. Add it to your home screen

On **each** phone:

1. Open the address in **Safari** (it must be Safari — Chrome on iOS can't
   install web apps).
2. Tap the **Share** button (the square with an arrow).
3. Scroll down, tap **Add to Home Screen**.
4. Tap **Add**.

You'll get a deer icon on your home screen. Tapping it opens the app
full-screen with no address bar, and from then on it works offline.

Send your sister the link and she does exactly the same. Her progress is
separate from yours — each phone keeps its own.

### Make the voice sound better (worth doing)

The app speaks using your iPhone's built-in Mandarin voice. The default is
serviceable; the Enhanced one is markedly better and free.

**Settings → Accessibility → Spoken Content → Voices → Chinese →
Chinese (China mainland)** — download an **Enhanced** or **Premium** voice.

Then in Mílù: **Me → Voice**, and pick it from the list.

### Let it use the microphone

The first time you open the Speaking screen, Safari asks for microphone
access. Say yes. If you say no by accident:
**Settings → Safari → Microphone**, or long-press the app icon → website
settings.

---

## 3. Turn on the leaderboard (optional)

Everything else works without this. The leaderboard just lets you and your
sister see each other's streaks.

Your learning data always stays on your own phone. Only a short summary —
name, streak, words known, accuracy — is ever sent.

### Create the database

1. Go to **[console.firebase.google.com](https://console.firebase.google.com)**
   and sign in with a Google account.
2. Click **Create a project**. Name it `milu`. Turn **off** Google Analytics
   (you don't need it). Click **Create project**.
3. In the left sidebar: **Build → Realtime Database**.
4. Click **Create Database**.
5. Location: pick **asia-southeast1** (closest to Australia of the options).
6. Choose **Start in test mode**, then **Enable**.

You'll now see a URL at the top of the page like:

```
https://milu-1234-default-rtdb.asia-southeast1.firebasedatabase.app
```

Copy it.

### Lock it down

Test mode lets anyone read and write anything, and expires after 30 days.
Replace it with a rule that only allows the leaderboard.

Click the **Rules** tab, replace everything with this, and click **Publish**:

```json
{
  "rules": {
    "boards": {
      "$code": {
        ".read": true,
        ".write": true,
        "$user": {
          ".validate": "newData.hasChildren(['name','streak','known'])"
        }
      }
    }
  }
}
```

This confines all access to the `boards` branch and rejects anything that
isn't a leaderboard row. Anyone who guessed your family code could still see
or edit that board, so treat the code as semi-public and use a first name plus
a couple of digits rather than anything sensitive.

### Tell the app about it

Open `js/config.js` and paste your URL in:

```js
window.MILU_CONFIG = {
  firebaseDbUrl: 'https://milu-1234-default-rtdb.asia-southeast1.firebasedatabase.app',
};
```

Upload that file to GitHub again and bump `VERSION` in `sw.js`.

### Join the same board

On both phones: **Me → Family code** → type the same thing, e.g. `CHARLES7`.
Also set **Your name** so you can tell each other apart.

You'll both appear, ranked by streak.

---

## Troubleshooting

**"Couldn't load the word list"**
The app is being opened as a file rather than served over http. Use the GitHub
Pages address, or run a local server:
```bash
python3 -m http.server 8777 --directory milu
```

**Changes don't show up after uploading**
Bump `VERSION` in `sw.js`. Failing that, delete the home-screen icon and add it
again.

**No sound**
Check the phone isn't on silent, and that a Chinese voice is installed
(see above). Tap something in the app first — iOS blocks audio until you've
interacted with the page.

**Speaking screen says the word check is unavailable**
That part needs an internet connection; the tone analysis works offline
regardless. On iOS the word check needs iOS 14.5 or newer.

**Import says the browser can't unzip files**
Reading .pptx files needs iOS 16.4 or newer. You can still paste a word list
in by hand on the Import screen.
