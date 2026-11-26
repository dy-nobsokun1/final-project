// UniSwap's colours, COPIED from the light (:root) values in frontend/src/app/globals.css,
// so the app looks like the website: a deep green page with pale green cards.

export const colors = {
  page: "#22312d", // --brand-deep: the page background
  pageText: "#e6f2dd", // --brand-50: text on the page
  pageMuted: "#b1d3b9", // --brand-200: quieter text on the page
  card: "#b1d3b9", // --brand-200: listing cards and form cards
  cardText: "#000000", // --brand-ink: text on a card
  inset: "#e6f2dd", // --brand-50: a field or panel inside a card
  primary: "#88bda4", // --brand-400: main buttons
  accent: "#659287", // --brand-600: tags and chips
  dark: "#1b3022", // --brand-900: dark tags
  wantedCard: "#31443e", // --brand-deep-2: the Wanted card
  wanted: "#ff8fae", // --brand-wanted: the WANTED tag (the only rose)
  danger: "#4b0c11", // --brand-danger: error boxes (with pale text)
  line: "rgba(177, 211, 185, 0.25)", // --border: thin lines on the page
};

export const radius = { card: 16, pill: 999, field: 10 };
