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

async function getPopularArtists() {
  // Always return a fresh shuffle of the popular artists
  return shuffleArray([...POPULAR_ARTISTS]);
}

async function getArtistTopTracks(artist: string) {
  try {
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

      if (validTracks.length > 0) {
        // Randomly select a track from the valid tracks
        const selectedTrack = validTracks[Math.floor(Math.random() * validTracks.length)];
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