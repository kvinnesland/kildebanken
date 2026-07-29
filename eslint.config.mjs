import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

// TODO (neste iterasjon): legg til den håndhevende lint-regelen fra
// DESIGN.md 1 og 9 punkt 2 — ingen hex/rgb/px-verdier og ingen
// tokens/primitives.css-variabler i komponentfiler. Krever en egen
// ESLint-plugin (f.eks. stylelint for CSS-siden av dette, siden det er
// CSS-verdier, ikke JS/TS) og er ikke gjort her.
const eslintConfig = [
  { ignores: [".next/**", "node_modules/**", "src/db/migrations/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
