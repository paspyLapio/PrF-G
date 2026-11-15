# Presentation

Put the team's deck in **this folder on the `main` branch**. The website picks it up by itself within about
5 minutes; no redeploy needed.

- **Homepage, Presentation section:** a PDF is shown as live slides (arrows, keyboard ← →, swipe on phones).
- **/presentation/ page:** full-screen viewer with Download.

## What to upload

| File | How it is shown |
| --- | --- |
| any `.pdf` (any name, e.g. `PrF-G Final.pdf`) | Live slides on the homepage + full-screen viewer. **Best choice.** |
| any `.pptx` | Microsoft's online PowerPoint viewer on /presentation/, with Download. |
| `link.txt` | A Google Slides or Canva share link on the first line (sharing: "anyone with the link"). |

If there are several, a PDF wins over a `.pptx`, which wins over `link.txt`. Among several PDFs, `presentation.pdf`
wins, otherwise the first by name, so keep just one deck here. To force a specific file, set `PRESENTATION_FILE`
in the root `wrangler.jsonc`.

## How to upload

**In the browser:** GitHub → this folder → **Add file → Upload files** → drop the PDF → **Commit changes** to `main`.
The website's presentation page also has an **Upload new version** button that opens that page.

**From a terminal:**

```bash
git checkout main && git pull
cp ~/Downloads/PrF-G.pdf presentation/
git add presentation/PrF-G.pdf && git commit -m "Add presentation" && git push
```

To replace the deck, upload the new file with the same name (or delete the old one).
Export from PowerPoint, Keynote or Google Slides as **PDF** for the best result. Keep it under 100 MB and do not use
Git LFS (the site reads the raw file from GitHub).
