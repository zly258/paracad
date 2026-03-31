/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./App.tsx",
        "./components/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Space Grotesk"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
                mono: ['"Fira Code"', 'monospace'],
            },
        },
    },
    plugins: [],
}
