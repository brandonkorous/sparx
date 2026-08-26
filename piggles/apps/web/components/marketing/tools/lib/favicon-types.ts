export interface FaviconOptions {
  /** Filled behind the logo. The Apple touch icon and the maskable icon are
   *  ALWAYS opaque whatever `fillBackground` says, because iOS renders
   *  transparency as black — so this reaches those two either way. */
  background: string;
  /** Fill that color behind EVERY icon, not only the two that must be opaque.
   *  The color goes down exactly as given; nothing here adjusts or second-guesses
   *  it. Without this, a chosen background reached only two of the six files. */
  fillBackground: boolean;
  /** Used in the web manifest. */
  appName: string;
  /** The browser's UI color when the site is installed. */
  themeColor: string;
}

export interface FaviconFile {
  name: string;
  blob: Blob;
  size: number;
  note: string;
}
