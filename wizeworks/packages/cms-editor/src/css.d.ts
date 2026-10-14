declare module '*.css';

// A file's text, for tests that read the source they guard (Vite's `?raw`).
declare module '*?raw' {
  const text: string;
  export default text;
}
