'use client';

import { useState, useEffect, useRef } from 'react';
import { Howl } from 'howler';
import { useRef as useConfettiRef } from 'react';

const INTERVALS = [0.5, 1, 2, 4, 8, 15];
const MAX_GUESSES = 6;

export default function Home() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSong, setCurrentSong] = useState<Howl | null>(null);
  const [guess, setGuess] = useState('');
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(1);
  const [currentInterval, setCurrentInterval] = useState(0);
  const [songData, setSongData] = useState<{ title: string; artist: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [guesses, setGuesses] = useState<string[]>(Array(MAX_GUESSES).fill(''));
  const [statuses, setStatuses] = useState<string[]>(Array(MAX_GUESSES).fill(''));
  const [showModal, setShowModal] = useState(false);
  const [lastResult, setLastResult] = useState<{ correct: boolean; actualTitle: string; actualArtist: string } | null>(null);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  const confettiRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const startGame = async (attempt = 1) => {
    const MAX_ATTEMPTS = 50;
    const BATCH_SIZE = 5; // Number of songs to try in parallel
    setIsLoading(true);
    try {
      // Get cached songs from localStorage
      const cachedSongs = localStorage.getItem('songCache') || '[]';
      
      // Fetch multiple songs in parallel
      const songPromises = Array(BATCH_SIZE).fill(null).map(() => 
        fetch('/api/song').then(res => res.json())
      );

      const results = await Promise.allSettled(songPromises);
      
      // Find the first successful song with a valid preview URL that's not in cache
      let validSong = null;
      for (const result of results) {
        if (result.status === 'fulfilled' && result.value.previewUrl) {
          // Check if song is in cache
          const response = await fetch(`/api/song-cache?title=${encodeURIComponent(result.value.title)}&artist=${encodeURIComponent(result.value.artist)}`, {
            headers: {
              'x-song-cache': cachedSongs
            }
          });
          const { isCached } = await response.json();
          
          if (!isCached) {
            validSong = result;
            break;
          }
        }
      }

      if (!validSong || validSong.status !== 'fulfilled') {
        setIsLoading(false);
        throw new Error('No valid songs found in batch');
      }

      const data = validSong.value;
      console.log('Loading song with preview URL:', data.previewUrl);

      // Add song to cache
      const cacheResponse = await fetch('/api/song-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-song-cache': cachedSongs
        },
        body: JSON.stringify({
          title: data.title,
          artist: data.artist
        })
      });
      
      const { cache: updatedCache } = await cacheResponse.json();
      localStorage.setItem('songCache', JSON.stringify(updatedCache));

      // Create and test the sound in parallel with other operations
      const sound = new Howl({
        src: [data.previewUrl],
        html5: true,
        onload: () => {
          setIsLoading(false);
          console.log('Song loaded successfully');
          setCurrentSong(sound);
          setSongData({ title: data.title, artist: data.artist });
          setIsPlaying(true);
          setCurrentInterval(0);
          playCurrentInterval(sound);
        },
        onloaderror: (id, error) => {
          setIsLoading(false);
          console.error('Error loading song:', error);
          if (attempt < MAX_ATTEMPTS) {
            startGame(attempt + 1);
          } else {
            alert('Failed to load a playable song after several attempts. Please try again.');
          }
        },
        onplayerror: (id, error) => {
          setIsLoading(false);
          console.error('Error playing song:', error);
          if (attempt < MAX_ATTEMPTS) {
            startGame(attempt + 1);
          } else {
            alert('Failed to play a song after several attempts. Please try again.');
          }
        }
      });
    } catch (error) {
      setIsLoading(false);
      console.error('Error starting game:', error);
      if (attempt >= 5) {
        alert('Failed to start game after several attempts. Please try again.');
      } else {
        startGame(attempt + 1);
      }
    }
  };

  const playCurrentInterval = (sound: Howl) => {
    sound.stop();
    sound.seek(0);
    sound.play();
    
    // Stop after the current interval
    setTimeout(() => {
      sound.stop();
    }, INTERVALS[currentInterval] * 1000);
  };

  const replayCurrentInterval = () => {
    if (!currentSong) return;
    playCurrentInterval(currentSong);
  };

  const playNextInterval = () => {
    if (!currentSong || currentInterval >= MAX_GUESSES - 1) return;
    // Mark current guess as incorrect if not already correct or incorrect
    setGuesses(prev => {
      const updated = [...prev];
      if (!updated[currentInterval]) updated[currentInterval] = '';
      return updated;
    });
    setStatuses(prev => {
      const updated = [...prev];
      if (!updated[currentInterval]) updated[currentInterval] = 'incorrect';
      return updated;
    });
    setCurrentInterval(prev => prev + 1);
    // Play the next interval directly
    currentSong.stop();
    currentSong.seek(0);
    currentSong.play();
    setTimeout(() => {
      currentSong.stop();
    }, INTERVALS[currentInterval + 1] * 1000);
  };

  // Click-away listener for suggestions
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        inputContainerRef.current &&
        !inputContainerRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSuggestions]);

  const handleSuggestionClick = (suggestion: string) => {
    setGuess(suggestion);
    setShowSuggestions(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const playFullSong = () => {
    if (!currentSong) return;
    currentSong.stop();
    currentSong.seek(0);
    currentSong.play();
  };

  const handleGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentSong || !songData) return;
    try {
      const response = await fetch('/api/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          guess,
          title: songData.title,
          artist: songData.artist,
        }),
      });
      const data = await response.json();
      const newGuesses = [...guesses];
      const newStatuses = [...statuses];
      newGuesses[currentInterval] = guess;
      newStatuses[currentInterval] = data.correct ? 'correct' : 'incorrect';
      setGuesses(newGuesses);
      setStatuses(newStatuses);
      if (data.correct) {
        setLastResult({
          correct: data.correct,
          actualTitle: data.actualTitle,
          actualArtist: data.actualArtist,
        });
        setShowModal(true);
        playFullSong();
      } else if (currentInterval === MAX_GUESSES - 1) {
        setLastResult({
          correct: false,
          actualTitle: data.actualTitle,
          actualArtist: data.actualArtist,
        });
        setShowModal(true);
        playFullSong();
      } else {
        setGuess('');
        setTimeout(() => playNextInterval(), 200); // slight delay for feedback
      }
    } catch (error) {
      console.error('Error checking guess:', error);
    }
  };

  const handleNextSong = () => {
    setScore(score + (lastResult?.correct ? 1 : 0));
    setRound(round + 1);
    setGuess('');
    if (currentSong) currentSong.stop();
    setIsPlaying(false);
    setCurrentInterval(0);
    setSongData(null);
    setSuggestions([]);
    setGuesses(Array(MAX_GUESSES).fill(''));
    setStatuses(Array(MAX_GUESSES).fill(''));
    setShowModal(false);
    setLastResult(null);
  };

  // Fetch live song suggestions from iTunes API with debounce and deduplication
  useEffect(() => {
    if (!guess) {
      setSuggestions([]);
      return;
    }
    const controller = new AbortController();
    const debounceTimeout = setTimeout(async () => {
      try {
        const res = await fetch(`https://itunes.apple.com/search?term=${encodeURIComponent(guess)}&entity=song&limit=10`, { signal: controller.signal });
        const data = await res.json();
        if (data.results) {
          // Deduplicate by title + artist
          const seen = new Set();
          const uniqueSuggestions = [];
          for (const song of data.results) {
            const key = `${song.trackName.toLowerCase()} - ${song.artistName.toLowerCase()}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueSuggestions.push(`${song.trackName} - ${song.artistName}`);
            }
            if (uniqueSuggestions.length >= 5) break;
          }
          setSuggestions(uniqueSuggestions);
        } else {
          setSuggestions([]);
        }
      } catch (e) {
        if (e instanceof Error && e.name !== 'AbortError') setSuggestions([]);
      }
    }, 200); // 200ms debounce
    return () => {
      controller.abort();
      clearTimeout(debounceTimeout);
    };
  }, [guess]);

  useEffect(() => {
    if (showModal && lastResult?.correct && confettiRef.current) {
      import('canvas-confetti').then((module) => {
        const confetti = module.default;
        confetti({
          particleCount: 120,
          spread: 90,
          origin: { y: 0.6 },
          zIndex: 1000,
          colors: ['#8B5CF6', '#A78BFA', '#F472B6', '#FBBF24', '#34D399'],
        });
      });
    }
  }, [showModal, lastResult]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-black p-4">
      <div className="w-full max-w-xl mx-auto">
        <h1 className="text-5xl font-extrabold text-center mb-8 tracking-tight text-white drop-shadow-lg">
          <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">Humm</span>
          ify
        </h1>
        <div className="card mb-10">
          {/* Improved Round/Score UI */}
          <div className="flex items-center justify-between mb-8 px-6 py-3 rounded-2xl bg-background/70 border border-white/10 shadow-inner">
            <span className="text-lg font-medium text-gray-300">
              Song: <span className="font-bold text-white">{round}</span>
            </span>
            <span className="mx-2 h-5 w-px bg-gray-700" />
            <span className="text-lg font-medium text-gray-300">
              Score: <span className="font-bold text-white">{score}</span>
            </span>
          </div>
          {isPlaying && (
            <div className="text-center mb-4">
              <p className="text-lg font-semibold text-primary mt-2">
                Interval: {INTERVALS[currentInterval]}s
              </p>
            </div>
          )}
          {/* Guess Stages */}
          <div className="mb-8 space-y-3">
            {Array.from({ length: MAX_GUESSES }).map((_, idx) => (
              <div
                key={idx}
                className={`stage-modern ${
                  idx === currentInterval && isPlaying ? 'stage-modern-active' : ''
                }`}
              >
                <span className={`w-20 text-base font-bold ${idx === currentInterval ? 'text-primary' : 'text-gray-400'}`}>Stage {idx + 1}</span>
                <span className="w-20 text-xs text-gray-400 ml-2">{INTERVALS[idx]}s</span>
                <span className={`flex-1 ml-4 text-base ${statuses[idx] === 'correct' ? 'text-green-400' : statuses[idx] === 'incorrect' ? 'text-red-400' : 'text-gray-200'}`}>{guesses[idx]}</span>
                {statuses[idx] === 'correct' && <span className="ml-2 text-green-400 font-bold">✔</span>}
                {statuses[idx] === 'incorrect' && <span className="ml-2 text-red-400 font-bold">✖</span>}
              </div>
            ))}
          </div>
          {/* Input and Controls */}
          {!isPlaying ? (
            isLoading ? (
              <div className="btn-primary w-full py-3 text-lg rounded-full shadow-lg flex justify-center items-center">
                <img src="/hummify-music-icon.png" alt="Loading music icon" className="bobbing-music-logo mr-2 darken-music-icon" style={{ height: '32px', width: 'auto' }} />
                <span className="text-lg font-bold text-white ml-1">Loading...</span>
                <style>{`
                  .bobbing-music-logo {
                    display: inline-block;
                    animation: bobble 1s infinite ease-in-out;
                  }
                  .darken-music-icon {
                    filter: brightness(0.7) contrast(1.2);
                  }
                  @keyframes bobble {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-10px); }
                  }
                `}</style>
              </div>
            ) : (
              <button
                onClick={() => startGame()}
                className="btn-primary w-full py-3 text-lg rounded-full shadow-lg hover:scale-[1.03] transition-transform"
              >
                Start New Round
              </button>
            )
          ) : (
            <div className="space-y-6">
              <form onSubmit={handleGuess} className="space-y-6">
                <div ref={inputContainerRef} className="relative flex items-center">
                  <span className="absolute left-4 text-gray-500">
                    <svg width="22" height="22" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M11 19a8 8 0 100-16 8 8 0 000 16zm7-1l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={guess}
                    onChange={(e) => {
                      setGuess(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder="Know it? Search for the title"
                    className="input-modern"
                    disabled={currentInterval >= MAX_GUESSES || statuses[currentInterval] === 'correct'}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 z-20 bg-surface/90 backdrop-blur-lg rounded-xl shadow-lg border border-white/10 overflow-y-auto max-h-60 w-full">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            handleSuggestionClick(suggestion);
                            if (inputRef.current) inputRef.current.focus();
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-primary/10 focus:bg-primary/10 focus:outline-none text-base rounded-xl transition-all"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn-primary flex-1 py-3 text-lg rounded-full shadow-lg hover:scale-[1.03] transition-transform" disabled={statuses[currentInterval] === 'correct'}>
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={replayCurrentInterval}
                    className="btn-primary flex-1 py-3 text-lg rounded-full shadow-lg hover:scale-[1.03] transition-transform"
                  >
                    Replay
                  </button>
                  <button
                    type="button"
                    onClick={playNextInterval}
                    className="btn-primary flex-1 py-3 text-lg rounded-full shadow-lg hover:scale-[1.03] transition-transform"
                    disabled={currentInterval >= MAX_GUESSES - 1}
                  >
                    Play Longer
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
      {/* Modal for correct answer */}
      {showModal && lastResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 animate-fade-in">
          <div ref={confettiRef} />
          <div className="modal-modern animate-pop-in relative overflow-visible">
            {lastResult.correct && (
              <div className="flex flex-col items-center mb-2">
                <span className="text-5xl mb-2 animate-bounce">🎉</span>
              </div>
            )}
            <h2 className={`text-3xl font-extrabold mb-3 ${lastResult.correct ? 'text-green-400' : 'text-red-400'} drop-shadow-lg`}>{lastResult.correct ? 'Correct!' : 'Out of Guesses!'}</h2>
            <p className="text-lg mb-2 text-gray-200">The correct answer was:</p>
            <p className={`text-2xl font-extrabold mb-8 bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent ${lastResult.correct ? 'animate-gradient-move' : ''}`}>
              {(lastResult.actualTitle || songData?.title || '-')}
              <span className="text-gray-400"> - </span>
              {(lastResult.actualArtist || songData?.artist || '-')}
            </p>
            <button
              onClick={handleNextSong}
              className="btn-primary w-full py-3 text-lg rounded-full shadow-lg hover:scale-[1.03] transition-transform"
            >
              Next Song
            </button>
          </div>
        </div>
      )}
    </main>
  );
} 
