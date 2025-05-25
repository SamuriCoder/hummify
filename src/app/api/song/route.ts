export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface CacheEntry {
  songs: any[];
  timestamp: number;
  tracks: Map<string, any[]>;
  playedSongs: Set<string>; // Track all played songs
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const TRACK_CACHE_DURATION = 2 * 60 * 60 * 1000; // 2 hours
const RECENTLY_PLAYED_SIZE = 10;
const RESET_THRESHOLD = 0.8; // Reset when 80% of songs have been played

const cache: CacheEntry = {
  songs: [],
  timestamp: 0,
  tracks: new Map(),
  playedSongs: new Set()
};

// Track recently played songs to prevent immediate repeats
const recentlyPlayed: { artist: string; title: string }[] = [];

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
  // Add to the set of all played songs
  cache.playedSongs.add(`${artist}-${title}`);
}

async function getSongList() {
  try {
    // If cache is empty or expired, load fresh songs
    if (cache.songs.length === 0 || Date.now() - cache.timestamp > CACHE_DURATION) {
      const filePath = path.join(process.cwd(), 'hummify-list.json');
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      cache.songs = JSON.parse(fileContent);
      cache.timestamp = Date.now();
      cache.playedSongs.clear(); // Reset played songs when loading new list
    }

    const totalSongs = cache.songs.length;
    const playedCount = cache.playedSongs.size;
    const playedRatio = playedCount / totalSongs;

    if (playedRatio >= RESET_THRESHOLD) {
      cache.playedSongs.clear();
    }

    // Filter out recently played songs and get a fresh shuffle
    const availableSongs = cache.songs.filter(song => {
      const artist = song["Artist Name(s)"].split(',')[0].trim();
      const title = song["Track Name"];
      return !cache.playedSongs.has(`${artist}-${title}`);
    });

    if (availableSongs.length === 0) {
      cache.playedSongs.clear();
      return shuffleArray([...cache.songs]);
    }

    return shuffleArray(availableSongs);
  } catch (error) {
    return [];
  }
}

async function getTrackPreview(song: any) {
  const artist = song["Artist Name(s)"].split(',')[0].trim(); // Get first artist if multiple
  const title = song["Track Name"];
  const cacheKey = `${artist}-${title}`;

  // Check cache first
  const cachedTracks = cache.tracks.get(cacheKey);
  if (cachedTracks && cachedTracks.length > 0) {
    const track = cachedTracks[0];
    if (!isRecentlyPlayed(artist, title)) {
      addToRecentlyPlayed(artist, title);
      return track;
    }
  }

  try {
    // Clear track cache if it's too old
    if (Date.now() - cache.timestamp > TRACK_CACHE_DURATION) {
      cache.tracks.clear();
    }

    // Use Deezer API to get track preview
    const deezerResponse = await fetch(
      `https://api.deezer.com/search?q=artist:"${encodeURIComponent(artist)}" track:"${encodeURIComponent(title)}"&limit=1`
    );
    const deezerData = await deezerResponse.json();

    if (deezerData.data && deezerData.data.length > 0) {
      const track = deezerData.data[0];
      if (track.preview) {
        // Update cache
        cache.tracks.set(cacheKey, [track]);
        if (!isRecentlyPlayed(artist, title)) {
          addToRecentlyPlayed(artist, title);
          return track;
        }
      }
    }
  } catch (error) {
  }

  return null;
}

export async function GET() {
  try {
    const songs = await getSongList();
    if (songs.length === 0) {
      const errorResponse = NextResponse.json(
        { error: 'No songs available' },
        { status: 503 }
      );
      errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      errorResponse.headers.set('Pragma', 'no-cache');
      errorResponse.headers.set('Expires', '0');
      errorResponse.headers.set('Surrogate-Control', 'no-store');
      return errorResponse;
    }

    // Try multiple songs in parallel with a timeout
    const songBatch = songs.slice(0, 8); // Try 8 songs in parallel
    
    const trackPromises = songBatch.map(song =>
      Promise.race([
        getTrackPreview(song),
        new Promise(resolve => setTimeout(() => resolve(null), 3000)) // 3 second timeout
      ])
    );

    const results = await Promise.all(trackPromises);
    
    // Filter out null results and get all successful tracks
    const successfulTracks = results.filter((track): track is any => track !== null);
    
    if (successfulTracks.length === 0) {
      const errorResponse = NextResponse.json(
        { error: 'No valid songs found after multiple attempts' },
        { status: 503 }
      );
      errorResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      errorResponse.headers.set('Pragma', 'no-cache');
      errorResponse.headers.set('Expires', '0');
      errorResponse.headers.set('Surrogate-Control', 'no-store');
      return errorResponse;
    }

    // Randomly select from successful tracks
    const selectedTrack = successfulTracks[Math.floor(Math.random() * successfulTracks.length)];
    
    const response = NextResponse.json({
      title: selectedTrack.title,
      artist: selectedTrack.artist.name,
      previewUrl: selectedTrack.preview,
      albumArt: selectedTrack.album.cover_medium,
    });

    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');

    return response;

  } catch (error) {
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