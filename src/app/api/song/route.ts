export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

// Enhanced cache system
interface CacheEntry {
  artists: string[];
  timestamp: number;
  tracks: Map<string, any[]>;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const TRACK_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours
const RECENTLY_PLAYED_SIZE = 10;

const cache: CacheEntry = {
  artists: [],
  timestamp: 0,
  tracks: new Map()
};

// Track recently played songs to prevent immediate repeats
const recentlyPlayed: { artist: string; title: string }[] = [];

// Curated list of popular artists
const POPULAR_ARTISTS = [
  // Hip Hop/Rap
  'Drake', 'Kendrick Lamar', 'J. Cole', 'Travis Scott', 'Post Malone',
  'Eminem', 'Kanye West', 'Jay-Z', 'Lil Wayne', 'Future',
  '21 Savage', 'Lil Baby', 'Migos', 'Cardi B', 'Nicki Minaj',
  'Juice WRLD', 'Lil Uzi Vert', 'A$AP Rocky', 'Tyler, The Creator',
  'Childish Gambino', 'The Weeknd', 'Khalid', 'Billie Eilish', 'Ariana Grande',
  // Pop
  'Taylor Swift', 'Ed Sheeran', 'Justin Bieber', 'Dua Lipa', 'Harry Styles',
  'Lady Gaga', 'Rihanna', 'Beyoncé', 'Bruno Mars', 'Adele', 'Frank Ocean', 'SZA',
  // Alternative/Indie
  'Arctic Monkeys', 'Tame Impala', 'Glass Animals',
  // Rock
  'Coldplay', 'Imagine Dragons', 'Panic! At The Disco', 'Calvin Harris', 'The Chainsmokers',
];

function shuffleArray(array: any[]) {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

function isRecentlyPlayed(artist: string, title: string): boolean {
  return recentlyPlayed.some(song =>
    song.artist.toLowerCase() === artist.toLowerCase() &&
    song.title.toLowerCase() === title.toLowerCase()
  );
}

function addToRecentlyPlayed(artist: string, title: string) {
  recentlyPlayed.unshift({ artist, title });
  if (recentlyPlayed.length > RECENTLY_PLAYED_SIZE) {
    recentlyPlayed.pop();
  }
}

async function getPopularArtists() {
  if (cache.artists.length > 0 && Date.now() - cache.timestamp < CACHE_DURATION) {
    return shuffleArray([...cache.artists]);
  }

  // Always return a fresh shuffle of the popular artists
  cache.artists = shuffleArray([...POPULAR_ARTISTS]);
  cache.timestamp = Date.now();
  return cache.artists;
}

async function getArtistTopTracks(artist: string) {
  // Check cache first
  const cachedTracks = cache.tracks.get(artist);
  if (cachedTracks && cachedTracks.length > 0) {
    // Filter out recently played tracks
    const availableTracks = cachedTracks.filter(track =>
      !isRecentlyPlayed(artist, track.title)
    );

    if (availableTracks.length > 0) {
      const selectedTrack = availableTracks[Math.floor(Math.random() * availableTracks.length)];
      addToRecentlyPlayed(artist, selectedTrack.title);
      return selectedTrack;
    }
  }

  try {
    // Clear track cache if it's too old
    if (Date.now() - cache.timestamp > TRACK_CACHE_DURATION) {
      cache.tracks.clear();
    }

    // Use Deezer API to get tracks
    const deezerResponse = await fetch(
      `https://api.deezer.com/search?q=artist:"${encodeURIComponent(artist)}"&limit=20&order=RATING_DESC`
    );
    const deezerData = await deezerResponse.json();

    if (deezerData.data) {
      const validTracks = deezerData.data.filter((track: any) =>
        track.preview &&
        track.artist.name.toLowerCase() === artist.toLowerCase()
      );

      // Update cache
      if (validTracks.length > 0) {
        cache.tracks.set(artist, validTracks);
        const selectedTrack = validTracks[Math.floor(Math.random() * validTracks.length)];
        addToRecentlyPlayed(artist, selectedTrack.title);
        return selectedTrack;
      }
    }
  } catch (error) {
    console.error('Error fetching artist top tracks:', error);
  }

  return null;
}

export async function GET() {
  try {
    const popularArtists = await getPopularArtists();

    // Try multiple artists in parallel with a timeout
    const artistBatch = popularArtists.slice(0, 8); // Try 8 artists in parallel
    const trackPromises = artistBatch.map(artist =>
      Promise.race([
        getArtistTopTracks(artist),
        new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3 second timeout
      ])
    );

    const results = await Promise.all(trackPromises);
    const validSong = results.find(song => song !== null);

    if (!validSong) {
      // It's better to return a consistent error structure and set cache-control headers here too
      const errorResponse = NextResponse.json(
        { error: 'No valid songs found after multiple attempts' },
        { status: 503 } // Service Unavailable or 500
      );
      errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      errorResponse.headers.set('Pragma', 'no-cache');
      errorResponse.headers.set('Expires', '0');
      errorResponse.headers.set('Surrogate-Control', 'no-store');
      return errorResponse;
    }

    const response = NextResponse.json({
      title: validSong.title,
      artist: validSong.artist.name,
      previewUrl: validSong.preview,
      albumArt: validSong.album.cover_medium,
    });

    // These headers are good practice, though force-dynamic should be the primary fix for Vercel
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;

  } catch (error) {
    console.error('Error fetching song:', error);
    const errorResponse = NextResponse.json(
      { error: 'Failed to fetch song' },
      { status: 500 }
    );
    errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    errorResponse.headers.set('Pragma', 'no-cache');
    errorResponse.headers.set('Expires', '0');
    errorResponse.headers.set('Surrogate-Control', 'no-store');
    return errorResponse;
  }
}
