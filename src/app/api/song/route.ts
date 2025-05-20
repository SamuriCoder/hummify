import { NextResponse } from 'next/server';

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

// Enhanced cache system
interface CacheEntry {
  artists: string[];
  timestamp: number;
  tracks: Map<string, any[]>;
}

const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours
const cache: CacheEntry = {
  artists: [],
  timestamp: 0,
  tracks: new Map()
};

function shuffleArray(array: any[]) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function getPopularArtists() {
  if (cache.artists.length > 0 && Date.now() - cache.timestamp < CACHE_DURATION) {
    // Always return a shuffled copy of the cached artists
    return shuffleArray([...cache.artists]);
  }

  try {
    const response = await fetch(
      `https://ws.audioscrobbler.com/2.0/?method=chart.gettopartists&api_key=${LASTFM_API_KEY}&format=json&limit=50`
    );
    const data = await response.json();
    
    if (data.artists?.artist) {
      cache.artists = data.artists.artist.map((artist: any) => artist.name);
      cache.timestamp = Date.now();
      return shuffleArray([...cache.artists]);
    }
  } catch (error) {
    console.error('Error fetching popular artists:', error);
  }

  // Fallback to our curated list if Last.fm API fails
  return [
    'Drake', 'Kendrick Lamar', 'J. Cole', 'Travis Scott', 'Post Malone',
    'Eminem', 'Kanye West', 'Jay-Z', 'Lil Wayne', 'Future',
    '21 Savage', 'Lil Baby', 'Migos', 'Cardi B', 'Nicki Minaj',
    'Juice WRLD', 'Lil Uzi Vert', 'A$AP Rocky', 'Tyler, The Creator',
    'Childish Gambino', 'The Weeknd', 'Khalid', 'Billie Eilish', 'Ariana Grande',
  ];
}

async function getArtistTopTracks(artist: string) {
  // Check cache first
  const cachedTracks = cache.tracks.get(artist);
  if (cachedTracks && cachedTracks.length > 0) {
    return cachedTracks[Math.floor(Math.random() * cachedTracks.length)];
  }

  try {
    // Parallel requests for Last.fm and Deezer
    const [lastFmResponse, deezerResponse] = await Promise.all([
      fetch(`https://ws.audioscrobbler.com/2.0/?method=artist.gettoptracks&artist=${encodeURIComponent(artist)}&api_key=${LASTFM_API_KEY}&format=json&limit=10`),
      fetch(`https://api.deezer.com/search?q=artist:"${encodeURIComponent(artist)}"&limit=10&order=RATING_DESC`)
    ]);

    const [lastFmData, deezerData] = await Promise.all([
      lastFmResponse.json(),
      deezerResponse.json()
    ]);

    let validTracks: any[] = [];

    // Process Last.fm tracks
    if (lastFmData.toptracks?.track) {
      const lastFmTracks = lastFmData.toptracks.track;
      // Parallel search for each Last.fm track on Deezer
      const deezerSearches = lastFmTracks.map(async (track: any) => {
        const searchResponse = await fetch(
          `https://api.deezer.com/search?q=track:"${encodeURIComponent(track.name)}" artist:"${encodeURIComponent(artist)}"&limit=1`
        );
        const searchData = await searchResponse.json();
        return searchData.data?.[0];
      });

      const deezerResults = await Promise.all(deezerSearches);
      validTracks = deezerResults.filter(track => track?.preview);
    }

    // If no valid tracks from Last.fm, use direct Deezer results
    if (validTracks.length === 0 && deezerData.data) {
      validTracks = deezerData.data.filter((s: any) => s.preview);
    }

    // Update cache
    if (validTracks.length > 0) {
      cache.tracks.set(artist, validTracks);
      return validTracks[Math.floor(Math.random() * validTracks.length)];
    }
  } catch (error) {
    console.error('Error fetching artist top tracks:', error);
  }

  return null;
}

export async function GET() {
  try {
    const popularArtists = await getPopularArtists();
    
    // Try multiple artists in parallel
    const artistBatch = popularArtists.slice(0, 5); // Try first 5 artists
    const trackPromises = artistBatch.map(artist => getArtistTopTracks(artist));
    
    const results = await Promise.all(trackPromises);
    const validSong = results.find(song => song !== null);
    
    if (!validSong) {
      throw new Error('No valid songs found');
    }
    
    return NextResponse.json({
      title: validSong.title,
      artist: validSong.artist.name,
      previewUrl: validSong.preview,
      albumArt: validSong.album.cover_medium,
    });
  } catch (error) {
    console.error('Error fetching song:', error);
    return NextResponse.json(
      { error: 'Failed to fetch song' },
      { status: 500 }
    );
  }
}