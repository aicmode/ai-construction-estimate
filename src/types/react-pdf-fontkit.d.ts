/**
 * `@react-pdf/fontkit` ships without type declarations. Only the small surface
 * this project uses (loading a TTF buffer and measuring an advance width) is
 * declared here, so nothing degrades to `any`.
 */
declare module "@react-pdf/fontkit" {
  export interface FontkitGlyphRun {
    advanceWidth: number;
  }

  export interface FontkitFont {
    unitsPerEm: number;
    postscriptName: string;
    layout(text: string): FontkitGlyphRun;
  }

  export interface Fontkit {
    create(buffer: Buffer | Uint8Array): FontkitFont;
    openSync(path: string): FontkitFont;
  }

  const fontkit: Fontkit;
  export default fontkit;
}
