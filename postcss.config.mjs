// Tailwind v4 via PostCSS. Astro 6 ships rolldown-vite, whose resolver is not
// yet compatible with the @tailwindcss/vite plugin, so we run Tailwind through
// PostCSS instead.
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
