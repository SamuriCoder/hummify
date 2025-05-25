# Hummify

A music guessing game inspired by the concept of [Songless](https://lessgames.com/songless), built with Next.js and the Deezer API.

## Features

- Play short snippets of songs and guess the title and artist
- Score tracking
- Modern, responsive UI
- Built with Next.js and Tailwind CSS

## Tech Stack

- **Frontend**: Next.js, React, Tailwind CSS
- **Audio**: Howler.js
- **State Management**: React Hooks
- **API**: Deezer API (free tier)
- **Deployment**: Vercel

## Getting Started

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
4. Open [http://localhost:3000](http://localhost:3000) in your browser

## Development

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

## API Routes

- `/api/song` - Get a random song
- `/api/check` - Check a guess against the current song

## License

ISC 