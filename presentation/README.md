# Presentation

The website's **Presentation** button shows whatever is in this folder. No redeploy needed: commit a file here and
the site picks it up within about 5 minutes (GitHub's cache).

Put **one** of these here (checked in this order, the first one found wins):

| File | How it is shown |
| --- | --- |
| `presentation.pdf` | Inline PDF viewer, with Full screen and Download. Best choice: works on every device. |
| `presentation.pptx` | Microsoft's online PowerPoint viewer, with Download. |
| `link.txt` | A Google Slides or Canva share link on the first line (set sharing to "anyone with the link"). |

To upload from the browser: GitHub → this folder → **Add file → Upload files** → commit to `main`.
The website's presentation page also has an **Upload new version** button that opens that page.

Keep the file under 100 MB and do not track it with Git LFS (the site reads the raw file from GitHub).
Export from PowerPoint/Keynote/Google Slides as PDF for the most reliable result.
