import { NextResponse } from 'next/server';

// This is a placeholder implementation
// In a real app, you'd want to store the current song in a session or state management
let currentSong: { title: string; artist: string } | null = null;

// Helper function to normalize strings for comparison
const normalize = (str: string): string[] => {
  return str
    .toLowerCase()
    // Remove text in parentheses or brackets
    .replace(/\([^)]*\)|\[[^\]]*\]/g, '')
    // Remove common version/remaster/bonus/feat info
    .replace(/(remaster(ed)?|version|edit|bonus track|mono|stereo|feat\.?|featuring|explicit|clean|single|album|mix|live|deluxe|original|demo|reissue|re\-issue|re\s?record(ed)?|with .+|from .+|\d{4})/g, '')
    // Remove punctuation
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
};

export async function POST(request: Request) {
  try {
    const { guess, title, artist } = await request.json();
    
    if (!title || !artist) {
      return NextResponse.json(
        { error: 'No song data provided' },
        { status: 400 }
      );
    }

    const guessWords = normalize(guess);
    const titleWords = normalize(title);
    const artistWords = normalize(artist);

    // Check if all title words and all artist words are present in the guess
    const titleMatch = titleWords.every(word => guessWords.includes(word));
    const artistMatch = artistWords.every(word => guessWords.includes(word));

    const isCorrect = titleMatch && artistMatch;
    
    return NextResponse.json({
      correct: isCorrect,
      actualTitle: title,
      actualArtist: artist,
    });
  } catch (error) {
    console.error('Error checking guess:', error);
    return NextResponse.json(
      { error: 'Failed to check guess' },
      { status: 500 }
    );
  }
}