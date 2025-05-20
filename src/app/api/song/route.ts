import { NextResponse } from 'next/server';

// List of popular hip-hop artists to ensure we get well-known songs
const POPULAR_ARTISTS = [
  'Drake',
  'Kendrick Lamar',
  'J. Cole',
  'Travis Scott',
  'Post Malone',
  'Eminem',
  'Kanye West',
  'Jay-Z',
  'Lil Wayne',
  'Future',
  '21 Savage',
  'Lil Baby',
  'Migos',
  'Cardi B',
  'Nicki Minaj',
  'Juice WRLD',
  'Lil Uzi Vert',
  'A$AP Rocky',
  'Tyler, The Creator',
  'Childish Gambino'
];

// List of popular hip-hop songs as fallback
const POPULAR_SONGS = [
  { title: 'God\'s Plan', artist: 'Drake' },
  { title: 'HUMBLE.', artist: 'Kendrick Lamar' },
  { title: 'SICKO MODE', artist: 'Travis Scott' },
  { title: 'rockstar', artist: 'Post Malone' },
  { title: 'Lose Yourself', artist: 'Eminem' },
  { title: 'Stronger', artist: 'Kanye West' },
  { title: 'Empire State of Mind', artist: 'Jay-Z' },
  { title: 'A Milli', artist: 'Lil Wayne' },
  { title: 'Mask Off', artist: 'Future' },
  { title: 'a lot', artist: '21 Savage' },
  { title: 'Drip Too Hard', artist: 'Lil Baby' },
  { title: 'Bad and Boujee', artist: 'Migos' },
  { title: 'Bodak Yellow', artist: 'Cardi B' },
  { title: 'Super Bass', artist: 'Nicki Minaj' },
  { title: 'Lucid Dreams', artist: 'Juice WRLD' },
  { title: 'XO Tour Llif3', artist: 'Lil Uzi Vert' },
  { title: 'F**kin\' Problems', artist: 'A$AP Rocky' },
  { title: 'EARFQUAKE', artist: 'Tyler, The Creator' },
  { title: 'This Is America', artist: 'Childish Gambino' },
  { title: 'No Role Modelz', artist: 'J. Cole' }
];

export async function GET() {
  try {
    // Try to get a random popular artist first
    const randomArtist = POPULAR_ARTISTS[Math.floor(Math.random() * POPULAR_ARTISTS.length)];
    
    // Search for top tracks by the artist
    const response = await fetch(
      `https://api.deezer.com/search?q=artist:"${randomArtist}"&limit=10&order=RATING_DESC`
    );
    
    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      // If no results, fall back to a random popular song
      const randomSong = POPULAR_SONGS[Math.floor(Math.random() * POPULAR_SONGS.length)];
      const fallbackResponse = await fetch(
        `https://api.deezer.com/search?q=track:"${randomSong.title}" artist:"${randomSong.artist}"&limit=1`
      );
      const fallbackData = await fallbackResponse.json();
      
      if (!fallbackData.data || fallbackData.data.length === 0) {
        throw new Error('No songs found');
      }
      
      const song = fallbackData.data[0];
      return NextResponse.json({
        title: song.title,
        artist: song.artist.name,
        previewUrl: song.preview,
        albumArt: song.album.cover_medium,
      });
    }
    
    // Filter for songs with a valid preview
    const validSongs = data.data ? data.data.filter((s: any) => s.preview) : [];
    if (validSongs.length === 0) {
      // If no valid preview, fall back to a random popular song with a preview
      let fallbackSong = null;
      for (let i = 0; i < POPULAR_SONGS.length; i++) {
        const randomSong = POPULAR_SONGS[Math.floor(Math.random() * POPULAR_SONGS.length)];
        const fallbackResponse = await fetch(
          `https://api.deezer.com/search?q=track:"${randomSong.title}" artist:"${randomSong.artist}"&limit=1`
        );
        const fallbackData = await fallbackResponse.json();
        if (fallbackData.data && fallbackData.data[0] && fallbackData.data[0].preview) {
          fallbackSong = fallbackData.data[0];
          break;
        }
      }
      if (!fallbackSong) {
        throw new Error('No songs with preview found');
      }
      return NextResponse.json({
        title: fallbackSong.title,
        artist: fallbackSong.artist.name,
        previewUrl: fallbackSong.preview,
        albumArt: fallbackSong.album.cover_medium,
      });
    }
    // Get a random valid song
    const song = validSongs[Math.floor(Math.random() * validSongs.length)];
    return NextResponse.json({
      title: song.title,
      artist: song.artist.name,
      previewUrl: song.preview,
      albumArt: song.album.cover_medium,
    });
  } catch (error) {
    console.error('Error fetching song:', error);
    return NextResponse.json(
      { error: 'Failed to fetch song' },
      { status: 500 }
    );
  }
} 