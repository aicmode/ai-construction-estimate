# PDF fonts

`NotoSansJP-Regular.ttf` / `NotoSansJP-Bold.ttf` are the static TrueType builds
of **Noto Sans JP**, licensed under the SIL Open Font License 1.1 (see
`OFL.txt`). They are committed to the repository on purpose:

- Japanese text in the generated 見積書 must never fall back to a missing glyph,
  and Vercel's serverless runtime has no system fonts to fall back to.
- Fetching a font at request time would add an external dependency to every PDF
  download and a cold-start penalty.

They live outside `public/` so they are only readable by the server. The PDF
route declares them in `outputFileTracingIncludes` (see `next.config.ts`) so the
serverless bundle contains them.
