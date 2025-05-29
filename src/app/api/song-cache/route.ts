import { NextResponse } from 'next/server';

interface CachedSong {
  title: string;
  artist: string;
  timestamp: number;
}

const CACHE_EXPIRY = 72 * 60 * 60 * 1000; // 72 hours in milliseconds

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title');
  const artist = searchParams.get('artist');

  if (!title || !artist) {
    return NextResponse.json({ error: 'Missing title or artist' }, { status: 400 });
  }

  const cache = request.headers.get('x-song-cache');
  let cachedSongs: CachedSong[] = [];

  if (cache) {
    try {
      cachedSongs = JSON.parse(cache);
      // Filter out expired entries
      const now = Date.now();
      cachedSongs = cachedSongs.filter(song => now - song.timestamp < CACHE_EXPIRY);
    } catch (e) {
      console.error('Error parsing song cache:', e);
    }
  }

  const isCached = cachedSongs.some(
    song => 
      song.title.toLowerCase() === title.toLowerCase() && 
      song.artist.toLowerCase() === artist.toLowerCase()
  );

  return NextResponse.json({ isCached });
}

export async function POST(request: Request) {
  try {
    const { title, artist } = await request.json();
    
    if (!title || !artist) {
      return NextResponse.json({ error: 'Missing title or artist' }, { status: 400 });
    }

    const cache = request.headers.get('x-song-cache');
    let cachedSongs: CachedSong[] = [];

    if (cache) {
      try {
        cachedSongs = JSON.parse(cache);
        // Filter out expired entries
        const now = Date.now();
        cachedSongs = cachedSongs.filter(song => now - song.timestamp < CACHE_EXPIRY);
      } catch (e) {
        console.error('Error parsing song cache:', e);
      }
    }

    // Add new song to cache
    cachedSongs.push({
      title,
      artist,
      timestamp: Date.now()
    });

    return NextResponse.json({ success: true, cache: cachedSongs });
  } catch (error) {
    console.error('Error updating song cache:', error);
    return NextResponse.json({ error: 'Failed to update cache' }, { status: 500 });
  }
} 