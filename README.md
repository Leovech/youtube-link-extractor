# YouTube Link Extractor

Tiny web app: paste a YouTube playlist or channel URL, get every video link as a list (copy or download as `.txt`).

## Deploy in 4 steps

### 1. Get a free YouTube Data API key
1. Go to https://console.cloud.google.com/
2. Create a new project (any name).
3. Open **APIs & Services -> Library**, search for **YouTube Data API v3**, click **Enable**.
4. Open **APIs & Services -> Credentials -> Create credentials -> API key**.
5. Copy the key.

### 2. Push this folder to GitHub
```bash
cd /Users/leovech/Desktop/Claude/ADXB
git init
git add .
git commit -m "Initial commit"
gh repo create youtube-link-extractor --public --source=. --push
```
(or create the repo manually on github.com and `git push`)

### 3. Deploy on Vercel
1. Go to https://vercel.com/new
2. Import the GitHub repo.
3. Framework preset: **Other** (no build step needed).
4. Before deploying, click **Environment Variables** and add:
   - Name: `YOUTUBE_API_KEY`
   - Value: the key from step 1
5. Click **Deploy**.

### 4. Open the URL Vercel gives you
Done.

## Local testing (optional)
```bash
npm i -g vercel
echo "YOUTUBE_API_KEY=your_key_here" > .env.local
vercel dev
```

## Notes
- YouTube Data API free quota is 10,000 units/day. A typical channel of a few hundred videos costs <10 units, so you have plenty of room.
- Channels with `/c/customname` URLs use a fallback search, which costs ~100 units per request — prefer the `@handle` or `/channel/UC...` URL when possible.
- Private/unlisted playlists won't work without OAuth (out of scope).

## Files
- `index.html` — the page
- `api/extract.js` — Vercel serverless function that calls the YouTube API
- `package.json` — declares Node 18+ for the function runtime
