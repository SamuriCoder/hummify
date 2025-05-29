export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface SongEntry {
  'Track Name': string;
  'Artist Name(s)': string;
}

const RECENTLY_PLAYED_SIZE = 50;
const recentlyPlayed: { title: string; artist: string }[] = [];

function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function isRecentlyPlayed(title: string, artist: string): boolean {
  return recentlyPlayed.some(
    (song) =>
      song.title.toLowerCase() === title.toLowerCase() &&
      song.artist.toLowerCase() === artist.toLowerCase()
  );
}

function addToRecentlyPlayed(title: string, artist: string) {
  recentlyPlayed.unshift({ title, artist });
  if (recentlyPlayed.length > RECENTLY_PLAYED_SIZE) {
    recentlyPlayed.pop();
  }
}

async function fetchDeezerTrack(title: string, artist: string) {
  try {
    const query = `track:"${title}" artist:"${artist.split(',')[0]}"`;
    const url = `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`;

    const res = await fetch(url);
    const data = await res.json();

    if (data.data && data.data.length > 0) {
      const match = data.data.find((track: any) =>
        track.preview &&
        track.title.toLowerCase().includes(title.toLowerCase()) &&
        track.artist.name.toLowerCase().includes(artist.split(',')[0].toLowerCase())
      );

      return match || data.data[0];
    }
  } catch (error) {
    console.error('Deezer fetch error:', error);
  }
  return null;
}

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'hummify-list-master.json');
    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const allSongs: SongEntry[] = JSON.parse(fileContents);

    const shuffled = shuffleArray(allSongs);

    for (const song of shuffled) {
      const title = song['Track Name'];
      const artist = song['Artist Name(s)'];

      if (isRecentlyPlayed(title, artist)) continue;

      const deezerTrack = await fetchDeezerTrack(title, artist);

      if (deezerTrack && deezerTrack.preview) {
        addToRecentlyPlayed(title, artist);

        const response = NextResponse.json({
          title: deezerTrack.title,
          artist: deezerTrack.artist.name,
          previewUrl: deezerTrack.preview,
          albumArt: deezerTrack.album.cover_medium,
        });

        response.headers.set('Cache-Control', 'no-store');
        return response;
      }
    }

    const errorResponse = NextResponse.json(
      { error: 'No valid songs found after checking all entries.' },
      { status: 503 }
    );
    errorResponse.headers.set('Cache-Control', 'no-store');
    return errorResponse;
  } catch (error) {
    console.error('Error loading songs or contacting Deezer:', error);
    const errorResponse = NextResponse.json(
      { error: 'Failed to load song list or retrieve previews.' },
      { status: 500 }
    );
    errorResponse.headers.set('Cache-Control', 'no-store');
    return errorResponse;
  }
}
