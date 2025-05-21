'use client';

import { useState, useEffect, useRef } from 'react';
import { Howl } from 'howler';

const INTERVALS = [0.1, 1, 2, 4, 8, 15];
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

  const startGame = async (attempt = 1) => {
    const MAX_ATTEMPTS = 50;
    const BATCH_SIZE = 5; // Number of songs to try in parallel

    try {
      // Fetch multiple songs in parallel
      const songPromises = Array(BATCH_SIZE).fill(null).map(() => 
        fetch('/api/song').then(res => res.json())
      );

      const results = await Promise.allSettled(songPromises);
      
      // Find the first successful song with a valid preview URL
      const validSong = results.find(result => 
        result.status === 'fulfilled' && 
        result.value.previewUrl
      );

      if (!validSong || validSong.status !== 'fulfilled') {
        throw new Error('No valid songs found in batch');
      }

      const data = validSong.value;
      console.log('Loading song with preview URL:', data.previewUrl);

      // Create and test the sound in parallel with other operations
      const sound = new Howl({
        src: [data.previewUrl],
        html5: true,
        onload: () => {
          console.log('Song loaded successfully');
          setCurrentSong(sound);
          setSongData({ title: data.title, artist: data.artist });
          setIsPlaying(true);
          setCurrentInterval(0);
          playCurrentInterval(sound);
        },
        onloaderror: (id, error) => {
          console.error('Error loading song:', error);
          if (attempt < MAX_ATTEMPTS) {
            startGame(attempt + 1);
          } else {
            alert('Failed to load a playable song after several attempts. Please try again.');
          }
        },
        onplayerror: (id, error) => {
          console.error('Error playing song:', error);
          if (attempt < MAX_ATTEMPTS) {
            startGame(attempt + 1);
          } else {
            alert('Failed to play a song after several attempts. Please try again.');
          }
        }
      });
    } catch (error) {
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
      } else if (currentInterval === MAX_GUESSES - 1) {
        setLastResult({
          correct: false,
          actualTitle: data.actualTitle,
          actualArtist: data.actualArtist,
        });
        setShowModal(true);
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

  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-black p-4">
      <div className="w-full max-w-xl mx-auto">
        <h1 className="text-5xl font-extrabold text-center mb-6 tracking-tight text-white drop-shadow-lg">
          <span className="text-primary">Humm</span>ify
        </h1>
        <div className="card mb-8 shadow-2xl rounded-2xl bg-surface/90 border border-gray-800">
          {/* Improved Round/Score UI */}
          <div className="flex items-center justify-between mb-6 px-4 py-2 rounded-lg bg-background/70 border border-gray-700">
            <span className="text-lg font-medium text-gray-300">
              Round: <span className="font-bold text-white">{round}</span>
            </span>
            <span className="mx-2 h-5 w-px bg-gray-700" />
            <span className="text-lg font-medium text-gray-300">
              Score: <span className="font-bold text-white">{score}</span>
            </span>
          </div>
          {isPlaying && (
            <div className="text-center mb-2">
              <p className="text-lg font-semibold text-primary mt-2">
                Interval: {INTERVALS[currentInterval]}s
              </p>
            </div>
          )}
          {/* Guess Stages */}
          <div className="mb-6 space-y-2">
            {Array.from({ length: MAX_GUESSES }).map((_, idx) => (
              <div
                key={idx}
                className={`flex items-center px-4 py-2 rounded-lg transition-all border ${
                  idx === currentInterval && isPlaying
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-gray-700 bg-background/80'
                }`}
              >
                <span className={`w-16 text-sm font-bold ${idx === currentInterval ? 'text-primary' : 'text-gray-400'}`}>Stage {idx + 1}</span>
                <span className="w-20 text-xs text-gray-400 ml-2">{INTERVALS[idx]}s</span>
                <span className={`flex-1 ml-4 text-base ${statuses[idx] === 'correct' ? 'text-green-400' : statuses[idx] === 'incorrect' ? 'text-red-400' : 'text-gray-200'}`}>{guesses[idx]}</span>
                {statuses[idx] === 'correct' && <span className="ml-2 text-green-400 font-bold">✔</span>}
                {statuses[idx] === 'incorrect' && <span className="ml-2 text-red-400 font-bold">✖</span>}
              </div>
            ))}
          </div>
          {/* Input and Controls */}
          {!isPlaying ? (
            <button
              onClick={() => startGame()}
              className="btn-primary w-full py-3 text-lg rounded-xl shadow-md hover:scale-[1.02] transition-transform"
            >
              Start New Round
            </button>
          ) : (
            <div className="space-y-4">
              <form onSubmit={handleGuess} className="space-y-4">
                <div ref={inputContainerRef} className="relative flex items-center">
                  <span className="absolute left-3 text-gray-500">
                    <svg width="20" height="20" fill="none" viewBox="0 0 24 24"><path stroke="currentColor" strokeWidth="2" d="M11 19a8 8 0 100-16 8 8 0 000 16zm7-1l-4.35-4.35" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-background border border-gray-700 text-lg text-white focus:border-primary focus:ring-2 focus:ring-primary/30 transition-all outline-none"
                    disabled={currentInterval >= MAX_GUESSES || statuses[currentInterval] === 'correct'}
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-2 z-20 bg-surface rounded-md shadow-lg border border-gray-700 overflow-y-auto max-h-60 w-full">
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            handleSuggestionClick(suggestion);
                            if (inputRef.current) inputRef.current.focus();
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-gray-700 focus:bg-gray-700 focus:outline-none text-base"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex space-x-2">
                  <button type="submit" className="btn-primary flex-1 py-3 text-lg rounded-xl shadow hover:scale-[1.02] transition-transform" disabled={statuses[currentInterval] === 'correct'}>
                    Submit
                  </button>
                  <button
                    type="button"
                    onClick={replayCurrentInterval}
                    className="btn-primary flex-1 py-3 text-lg rounded-xl shadow hover:scale-[1.02] transition-transform"
                  >
                    Replay
                  </button>
                  <button
                    type="button"
                    onClick={playNextInterval}
                    className="btn-primary flex-1 py-3 text-lg rounded-xl shadow hover:scale-[1.02] transition-transform"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-surface rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border border-gray-700">
            <h2 className={`text-2xl font-bold mb-4 ${lastResult.correct ? 'text-green-400' : 'text-red-400'}`}>{lastResult.correct ? 'Correct!' : 'Out of Guesses!'}</h2>
            <p className="text-lg mb-2 text-gray-200">The correct answer was:</p>
            <p className="text-xl font-semibold text-primary mb-6">
              {(lastResult.actualTitle || songData?.title || '-')}
              <span className="text-gray-400"> - </span>
              {(lastResult.actualArtist || songData?.artist || '-')}
            </p>
            <button
              onClick={handleNextSong}
              className="btn-primary w-full py-3 text-lg rounded-xl shadow hover:scale-[1.02] transition-transform"
            >
              Next Song
            </button>
          </div>
        </div>
      )}
    </main>
  );
} 
