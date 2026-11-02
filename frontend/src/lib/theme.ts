/** Cookie that remembers the student's theme choice. The root layout reads it, so `<html>` is rendered with the right class. */
export const THEME_COOKIE = "uniswap_theme";

/** One year, in seconds. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export type Theme = "light" | "dark";
