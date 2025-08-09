import React, { useState, useEffect, useCallback, useRef } from 'react';

// --- Helper for local storage (web equivalent of AsyncStorage) ---
const storage = {
  getItem: async (key) => {
    return Promise.resolve(localStorage.getItem(key));
  },
  setItem: async (key, value) => {
    return Promise.resolve(localStorage.setItem(key, value));
  },
};

// --- Main App Component ---
export default function App() {
  // --- State Management ---
  const [gameState, setGameState] = useState('difficulty_select');
  const [playerScore, setPlayerScore] = useState(0);
  const [computerScore, setComputerScore] = useState(0);
  const [targetScore, setTargetScore] = useState(0);
  const [playerMoveHistory, setPlayerMoveHistory] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [message, setMessage] = useState('');
  const [history, setHistory] = useState([]);
  const [playerChoice, setPlayerChoice] = useState('?');
  const [computerChoice, setComputerChoice] = useState('?');
  
  // Modals visibility
  const [difficultyModalVisible, setDifficultyModalVisible] = useState(true);
  const [tossModalVisible, setTossModalVisible] = useState(false);
  const [gameOverModalVisible, setGameOverModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [gameOverResult, setGameOverResult] = useState({title: '', message: ''});
  
  // Toss result state
  const [tossResult, setTossResult] = useState(null);
  
  // Gemini API State
  const [analysis, setAnalysis] = useState('');
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  // Stats and Achievements
  const [stats, setStats] = useState({ wins: 0, losses: 0, draws: 0, totalRuns: 0, highestScore: 0, wickets: 0, unlockedAchievements: [] });
  const [achievements, setAchievements] = useState({
      firstWin: { title: "First Victory", description: "Win your first match.", unlocked: false, condition: (stats) => stats.wins >= 1 },
      tenWins: { title: "Serial Winner", description: "Win 10 matches.", unlocked: false, condition: (stats) => stats.wins >= 10 },
      fiftyRuns: { title: "Half-Century", description: "Score 50 in a single match.", unlocked: false, condition: (stats, score) => score >= 50 },
      hundredRuns: { title: "Century Scorer", description: "Score 100 in a single match.", unlocked: false, condition: (stats, score) => score >= 100 },
      fiveWickets: { title: "Five-Wicket Haul", description: "Take 5 wickets in your career.", unlocked: false, condition: (stats) => stats.wickets >= 5 },
  });

  // Theme & Sound
  const [theme, setTheme] = useState('light');
  const [isMuted, setIsMuted] = useState(true);
  const soundEngine = useRef(null);
  const [difficulty, setDifficulty] = useState('hard');
  
  // --- Constants ---
  const gestures = { 1: '☝️', 2: '✌️', 3: '🤟', 4: '🖖', 5: '🖐️', 6: '👍' };
  const AI_CONFIG = {
      easy: 0.35,
      medium: 0.70,
      hard: 1.0,
  };

  // --- Sound Engine ---
  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/tone/14.7.77/Tone.js';
    script.async = true;
    script.onload = () => {
        soundEngine.current = {
            batHit: new window.Tone.PluckSynth({ attackNoise: 0.8, dampening: 2000, resonance: 0.5 }).toDestination(),
            wicket: new window.Tone.MetalSynth({ frequency: 100, envelope: { attack: 0.001, decay: 0.1, release: 0.01 }, harmonicity: 5.1, modulationIndex: 32, resonance: 4000, octaves: 1.5 }).toDestination(),
            click: new window.Tone.MembraneSynth({ pitchDecay: 0.008, octaves: 2, envelope: { attack: 0.001, decay: 0.2, sustain: 0 } }).toDestination(),
            cheer: new window.Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.2, decay: 1.5, sustain: 0.1, release: 1 } }).toDestination(),
            boo: new window.Tone.NoiseSynth({ noise: { type: 'brown' }, envelope: { attack: 0.5, decay: 1.5, sustain: 0.2, release: 1 } }).toDestination(),
            milestone: new window.Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: 0.01, decay: 0.2, sustain: 0.1, release: 0.5 } }).toDestination(),
        };
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        document.body.removeChild(script);
      }
    };
  }, []);

  const playSound = useCallback((soundName) => {
    if (isMuted || !soundEngine.current || !window.Tone || window.Tone.context.state !== 'running') {
      return;
    }
    const now = window.Tone.now();
    switch (soundName) {
        case 'batHit': soundEngine.current.batHit.triggerAttackRelease('C4', '8n', now); break;
        case 'wicket': soundEngine.current.wicket.triggerAttackRelease('C3', '4n', now, 0.8); break;
        case 'click': soundEngine.current.click.triggerAttackRelease('C2', '32n', now, 0.5); break;
        case 'win': soundEngine.current.cheer.triggerAttackRelease("1n", now); break;
        case 'loss': soundEngine.current.boo.triggerAttackRelease("1.5n", now); break;
        case 'draw': soundEngine.current.boo.triggerAttackRelease("0.5n", now, 0.3); break;
        case 'milestone':
            soundEngine.current.milestone.triggerAttackRelease('C5', '8n', now);
            soundEngine.current.milestone.triggerAttackRelease('G5', '8n', now + 0.2);
            break;
        default: break;
    }
  }, [isMuted]);

  const startAudioContext = useCallback(() => {
    if (window.Tone && window.Tone.context.state !== 'running') {
        window.Tone.start();
    }
  }, []);

  // --- Effects ---
  useEffect(() => {
    const loadData = async () => {
      const savedStats = await storage.getItem('handCricketStats');
      if (savedStats) {
        const parsedStats = JSON.parse(savedStats);
        setStats(parsedStats);
        setAchievements(prev => {
            const newAchievements = {...prev};
            if (parsedStats.unlockedAchievements) {
                parsedStats.unlockedAchievements.forEach(id => {
                    if (newAchievements[id]) newAchievements[id].unlocked = true;
                });
            }
            return newAchievements;
        });
      }
      
      const savedTheme = await storage.getItem('handCricketTheme');
      if (savedTheme) {
        setTheme(savedTheme);
      }
    };
    loadData();
  }, []);

  // --- Helper Functions ---
  const addHistory = (icon, text) => {
    setHistory(prev => [{ icon, text, id: Math.random().toString() }, ...prev]);
  };
  
  const showNotification = (title, message, icon = '🏆') => {
    playSound('milestone');
    const container = document.getElementById('achievement-notification-container');
    if (container) {
        const notification = document.createElement('div');
        notification.className = 'achievement-notification bg-green-500 text-white p-4 rounded-lg shadow-lg';
        notification.innerHTML = `<h4 class="font-bold">${icon} ${title}</h4><p>${message}</p>`;
        container.appendChild(notification);
        setTimeout(() => notification.remove(), 4000);
    }
  };

  const checkAchievements = useCallback((currentStats, currentScore = 0) => {
    const newAchievements = { ...achievements };
    let changed = false;
    
    for (const id in newAchievements) {
        const ach = newAchievements[id];
        if (!ach.unlocked && ach.condition(currentStats, currentScore)) {
            ach.unlocked = true;
            changed = true;
            showNotification('Achievement Unlocked!', ach.title);
        }
    }

    if (changed) {
        setAchievements(newAchievements);
        const unlockedIds = Object.keys(newAchievements).filter(id => newAchievements[id].unlocked);
        const newStats = { ...currentStats, unlockedAchievements: unlockedIds };
        storage.setItem('handCricketStats', JSON.stringify(newStats));
        setStats(newStats);
    }
  }, [achievements]);


  // --- Game Logic ---
  const resetGame = () => {
    setGameState('difficulty_select');
    setPlayerScore(0);
    setComputerScore(0);
    setTargetScore(0);
    setPlayerMoveHistory([]);
    setIsProcessing(false);
    setMessage('');
    setHistory([]);
    setPlayerChoice('?');
    setComputerChoice('?');
    setTossResult(null);
    setGameOverModalVisible(false);
    setTossModalVisible(false);
    setDifficultyModalVisible(true);
    setAnalysis('');
  };

  const selectDifficulty = (level) => {
    playSound('click');
    setDifficulty(level);
    setDifficultyModalVisible(false);
    setTossModalVisible(true);
  };

  const handleToss = (playerTossChoice) => {
    startAudioContext();
    playSound('click');
    const choices = ['rock', 'paper', 'scissors'];
    const computerTossChoice = choices[Math.floor(Math.random() * 3)];
    let winner = '';
    if (playerTossChoice === computerTossChoice) {
      winner = 'tie';
    } else if (
      (playerTossChoice === 'rock' && computerTossChoice === 'scissors') ||
      (playerTossChoice === 'paper' && computerTossChoice === 'rock') ||
      (playerTossChoice === 'scissors' && computerTossChoice === 'paper')
    ) {
      winner = 'player';
    } else {
      winner = 'computer';
    }

    if (winner === 'computer') {
      const compDecision = Math.random() > 0.5 ? 'bat' : 'bowl';
      setTossResult({ winner, text: `Computer chose to ${compDecision}.` });
      setTimeout(() => {
        setTossModalVisible(false);
        startInnings(compDecision === 'bat' ? 'computerBatting' : 'playerBatting');
      }, 2000);
    } else {
        setTossResult({ winner, text: `You chose ${playerTossChoice}, Computer chose ${computerTossChoice}.` });
        if (winner === 'tie') {
            setTimeout(() => {
                setTossResult(null);
            }, 1500);
        }
    }
  };

  const chooseTo = (choice) => {
    playSound('click');
    setTossModalVisible(false);
    startInnings(choice === 'bat' ? 'playerBatting' : 'computerBatting');
  };

  const startInnings = (newGameState) => {
    setGameState(newGameState);
    if (newGameState === 'playerBatting') {
      setMessage("You are batting. Let's start!");
    } else {
      setMessage("Computer is batting. Get them out!");
    }
  };

  const getComputerChoice = (currentHistory) => {
    const randomChoice = () => Math.floor(Math.random() * 6) + 1;
    if (Math.random() > AI_CONFIG[difficulty] || currentHistory.length < 3) return randomChoice();
    
    const moveCounts = {1:0, 2:0, 3:0, 4:0, 5:0, 6:0};
    currentHistory.forEach(move => { moveCounts[move]++; });
    
    let mostFrequentMove = 1;
    let maxCount = 0;
    for (const move in moveCounts) {
      if (moveCounts[move] > maxCount) {
        maxCount = moveCounts[move];
        mostFrequentMove = parseInt(move, 10);
      }
    }
    
    if (gameState === 'playerBatting') return mostFrequentMove;
    else {
      let choices = [1, 2, 3, 4, 5, 6];
      if (choices.length > 1 && Math.random() < 0.8) {
        choices = choices.filter(c => c !== mostFrequentMove);
      }
      return choices[Math.floor(Math.random() * choices.length)];
    }
  };

  const handlePlayerInput = (playerInput) => {
    if (isProcessing) return;
    setIsProcessing(true);

    const updatedHistory = [...playerMoveHistory.slice(-9), playerInput];
    setPlayerMoveHistory(updatedHistory);
    
    const compChoice = getComputerChoice(updatedHistory);
    const [batsmanChoice, bowlerChoice] = gameState === 'playerBatting' ? [playerInput, compChoice] : [compChoice, playerInput];
    
    setPlayerChoice(gestures[playerInput]);
    setComputerChoice(gestures[compChoice]);

    if (batsmanChoice === bowlerChoice) {
      playSound('wicket');
      setMessage('OUT!');
      setTimeout(() => {
        if (gameState === 'playerBatting') {
          addHistory('🔴', `OUT! You scored ${playerScore}.`);
          const newStats = { ...stats, highestScore: Math.max(stats.highestScore, playerScore) };
          setStats(newStats);
          checkAchievements(newStats, playerScore);
          if (targetScore > 0) {
            if (playerScore === targetScore - 1) {
                endGame('draw');
            } else {
                endGame('loss');
            }
          } else {
            setTargetScore(playerScore + 1);
            switchInnings();
          }
        } else { // Computer batting
          addHistory('🔴', `OUT! Computer scored ${computerScore}.`);
          const newStats = { ...stats, wickets: stats.wickets + 1 };
          setStats(newStats);
          checkAchievements(newStats);
          if (targetScore > 0) {
            if (computerScore === targetScore - 1) {
                endGame('draw');
            } else {
                endGame('win');
            }
          } else {
            setTargetScore(computerScore + 1);
            switchInnings();
          }
        }
        setIsProcessing(false);
      }, 1200);
    } else {
      playSound('batHit');
      setMessage('');
      if (gameState === 'playerBatting') {
        const newScore = playerScore + batsmanChoice;
        setStats(s => ({
          ...s,
          totalRuns: s.totalRuns + batsmanChoice,
          highestScore: Math.max(s.highestScore, newScore)
        }));
        if (playerScore < 50 && newScore >= 50) showNotification('Milestone!', '50 Runs! Well played!', '🏏');
        if (playerScore < 100 && newScore >= 100) showNotification('Incredible!', '100 Runs! A brilliant century!', '💯');
        setPlayerScore(newScore);
        addHistory('🏏', `You score ${batsmanChoice} run(s).`);
        if (targetScore > 0 && newScore >= targetScore) {
          endGame('win');
        }
      } else {
        const newScore = computerScore + batsmanChoice;
        setComputerScore(newScore);
        addHistory('💻', `Computer scores ${batsmanChoice} run(s).`);
        if (targetScore > 0 && newScore >= targetScore) {
          endGame('loss');
        }
      }
      setTimeout(() => setIsProcessing(false), 250);
    }
  };

  const switchInnings = () => {
    setPlayerChoice('?');
    setComputerChoice('?');
    setPlayerMoveHistory([]);
    if (gameState === 'playerBatting') {
      setComputerScore(0);
      addHistory('🔄', `Innings Break. Computer needs ${playerScore + 1} to win.`);
      startInnings('computerBatting');
    } else {
      setPlayerScore(0);
      addHistory('🔄', `Innings Break. You need ${computerScore + 1} to win.`);
      startInnings('playerBatting');
    }
  };

  const endGame = (result) => {
    setGameState('gameOver');
    let finalStats;
    if (result === 'win') {
        finalStats = { ...stats, wins: stats.wins + 1 };
        setGameOverResult({title: 'You Won! 🎉', message: 'A great performance!'});
        playSound('win');
    } else if (result === 'loss') {
        finalStats = { ...stats, losses: stats.losses + 1 };
        setGameOverResult({title: 'Computer Won 😞', message: 'Better luck next time!'});
        playSound('loss');
    } else { // draw
        finalStats = { ...stats, draws: (stats.draws || 0) + 1 };
        setGameOverResult({title: 'Match Drawn 🤝', message: 'Scores are level!'});
        playSound('draw');
    }
    setStats(finalStats);
    storage.setItem('handCricketStats', JSON.stringify(finalStats));
    checkAchievements(finalStats);
    setTimeout(() => {
      setGameOverModalVisible(true);
    }, 750);
  };
  
  const toggleTheme = async () => {
      playSound('click');
      const newTheme = theme === 'light' ? 'dark' : 'light';
      setTheme(newTheme);
      await storage.setItem('handCricketTheme', newTheme);
  };

  const toggleMute = () => {
      startAudioContext();
      setIsMuted(prev => !prev);
  }

  // --- Gemini API Function ---
  const getMatchAnalysis = async () => {
    playSound('click');
    setIsLoadingAnalysis(true);
    setAnalysisModalVisible(true);
    setAnalysis('');

    const matchSummary = `
        Player Score: ${playerScore}
        Computer Score: ${computerScore}
        Target: ${targetScore > 0 ? targetScore : 'Not set'}
        Result: ${gameOverResult.title}
    `;

    const prompt = `You are an enthusiastic and slightly dramatic cricket commentator. Provide a short, fun, and exciting commentary for a game of "Hand Cricket" based on this summary:\n\n${matchSummary}\n\nKeep it under 60 words. Be encouraging if the player lost, and celebrate their victory if they won. End with a fun, one-line tip for the next game.`;
    
    let chatHistory = [];
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    const payload = { contents: chatHistory };
    const apiKey = process.env.REACT_APP_GEMINI_API_KEY;
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

    try {
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
          const text = result.candidates[0].content.parts[0].text;
          setAnalysis(text);
        } else {
            console.error("Gemini API Error: Invalid response structure", result);
            setAnalysis("Couldn't get the analysis. The commentator must be on a tea break!");
        }
    } catch (error) {
        console.error("Gemini API error:", error);
        setAnalysis("The connection to the commentary box was lost. Please try again!");
    } finally {
        setIsLoadingAnalysis(false);
    }
  };


  // --- Render ---
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 font-sans ${theme === 'dark' ? 'bg-gray-900 text-gray-300' : 'bg-gray-100 text-gray-700'} transition-colors duration-300`}>
      <div className={`w-full max-w-lg mx-auto rounded-2xl shadow-xl p-6 text-center relative ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'} transition-colors duration-300`}>
        <div className="absolute top-4 right-4 flex gap-3">
            <button onClick={toggleTheme} className={`p-1 rounded-full ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}>
                {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <button onClick={() => { playSound('click'); setStatsModalVisible(true); }} className={`p-1 rounded-full ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}>
                📊
            </button>
            <button onClick={toggleMute} className={`p-1 rounded-full ${theme === 'dark' ? 'text-gray-400 hover:bg-gray-700' : 'text-gray-500 hover:bg-gray-200'}`}>
                {isMuted ? '🔇' : '🔊'}
            </button>
        </div>

        <h1 className={`text-3xl md:text-4xl font-bold mb-4 ${theme === 'dark' ? 'text-blue-50' : 'text-blue-900'}`}>You vs AI</h1>

        <div className="grid grid-cols-2 gap-4 mb-4 text-center">
            <div>
                <p className={`text-sm uppercase font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Target</p>
                <p className="text-3xl font-bold text-red-500">{targetScore || '-'}</p>
            </div>
            <div>
                <p className={`text-sm uppercase font-semibold ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{gameState === 'playerBatting' ? 'Your Score' : "Computer's Score"}</p>
                <p className={`text-3xl font-bold ${theme === 'dark' ? 'text-cyan-400' : 'text-cyan-600'}`}>{gameState === 'playerBatting' ? playerScore : computerScore}</p>
            </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4 min-h-[100px]">
            <div className={`rounded-lg p-3 flex flex-col items-center justify-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <p className={`font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{gameState === 'playerBatting' ? 'Your Shot' : 'Your Ball'}</p>
                <p className="text-4xl">{playerChoice}</p>
            </div>
            <div className={`rounded-lg p-3 flex flex-col items-center justify-center ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}`}>
                <p className={`font-semibold mb-1 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{gameState === 'playerBatting' ? "Bowler's Ball" : "Batsman's Shot"}</p>
                <p className="text-4xl">{computerChoice}</p>
            </div>
        </div>

        <div className="min-h-[60px] flex items-center justify-center mb-4"><p className="text-xl font-bold">{message}</p></div>

        <div className="flex-1 justify-center">
            <p className={`text-center font-medium mb-3 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Choose your number:</p>
            <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6].map(num => (
                    <button key={num} onClick={() => handlePlayerInput(num)} className="bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-lg text-lg transition-transform transform hover:-translate-y-1">
                        {num}
                    </button>
                ))}
            </div>
        </div>
        
        <div className="mt-auto">
            <h3 className={`text-lg font-semibold mb-2 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>Match History</h3>
            <div id="history-log" className={`h-24 rounded-lg p-2 overflow-y-auto text-left text-sm space-y-1 ${theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-50 text-gray-500'}`}>
                {history.map(item => (
                    <p key={item.id}><span>{item.icon}</span> {item.text}</p>
                ))}
            </div>
        </div>
      </div>
      
      {/* Modals */}
      {difficultyModalVisible && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
            <div className={`rounded-2xl shadow-xl p-8 text-center w-full max-w-sm ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-blue-50' : 'text-blue-900'}`}>Select Difficulty</h2>
                <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Choose your opponent's skill level.</p>
                <div className="grid grid-cols-1 gap-4">
                    <button onClick={() => selectDifficulty('easy')} className="bg-green-500 hover:bg-green-600 text-white font-bold py-3 rounded-lg">Easy</button>
                    <button onClick={() => selectDifficulty('medium')} className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 rounded-lg">Medium</button>
                    <button onClick={() => selectDifficulty('hard')} className="bg-red-500 hover:bg-red-600 text-white font-bold py-3 rounded-lg">Hard</button>
                </div>
            </div>
        </div>
      )}

      {tossModalVisible && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
            <div className={`rounded-2xl shadow-xl p-8 text-center w-full max-w-sm ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}`}>
                {!tossResult ? (
                    <>
                        <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-blue-50' : 'text-blue-900'}`}>Coin Toss</h2>
                        <p className={`mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Choose Rock, Paper, or Scissors.</p>
                        <div className="flex justify-center gap-4">
                            <button className="text-4xl p-4 rounded-lg bg-slate-200 hover:bg-slate-300" onClick={() => handleToss('rock')}>✊</button>
                            <button className="text-4xl p-4 rounded-lg bg-slate-200 hover:bg-slate-300" onClick={() => handleToss('paper')}>✋</button>
                            <button className="text-4xl p-4 rounded-lg bg-slate-200 hover:bg-slate-300" onClick={() => handleToss('scissors')}>✌️</button>
                        </div>
                    </>
                ) : (
                    <>
                        <h2 className={`text-2xl font-bold mb-2 ${theme === 'dark' ? 'text-blue-50' : 'text-blue-900'}`}>{tossResult.winner === 'player' ? 'You Won!' : tossResult.winner === 'computer' ? 'Computer Won' : "It's a Tie!"}</h2>
                        <p className={`mb-4 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{tossResult.text}</p>
                        {tossResult.winner === 'player' && (
                            <div className="flex justify-center gap-4">
                                <button className="bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg" onClick={() => chooseTo('bat')}>Bat</button>
                                <button className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg" onClick={() => chooseTo('bowl')}>Bowl</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
      )}

      {gameOverModalVisible && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm">
              <div className={`rounded-2xl shadow-xl p-8 text-center w-full max-w-sm ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}`}>
                  <h2 className={`text-3xl font-bold mb-2 ${theme === 'dark' ? 'text-blue-50' : 'text-blue-900'}`}>{gameOverResult.title}</h2>
                  <p className={`mb-6 ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{gameOverResult.message}</p>
                  <button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg text-lg mb-3" onClick={getMatchAnalysis}>
                      ✨ Get Match Analysis
                  </button>
                  <button className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-bold py-3 rounded-lg text-lg" onClick={resetGame}>
                      Play Again
                  </button>
              </div>
          </div>
      )}

      {analysisModalVisible && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm" onClick={() => setAnalysisModalVisible(false)}>
             <div className={`rounded-2xl shadow-xl p-8 w-full max-w-sm ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}`} onClick={(e) => e.stopPropagation()}>
                <h2 className={`text-2xl font-bold mb-4 text-center ${theme === 'dark' ? 'text-blue-50' : 'text-blue-900'}`}>Commentator's Corner</h2>
                {isLoadingAnalysis ? (
                    <p className={`text-center ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>🎙️ The commentator is checking the tapes...</p>
                ) : (
                    <p className={`text-center italic ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>{analysis}</p>
                )}
             </div>
        </div>
      )}

      {statsModalVisible && (
          <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm" onClick={() => setStatsModalVisible(false)}>
              <div className={`rounded-2xl shadow-xl p-8 w-full max-w-md ${theme === 'dark' ? 'bg-gray-800 text-gray-300' : 'bg-white text-gray-700'}`} onClick={(e) => e.stopPropagation()}>
                  <h2 className={`text-2xl font-bold mb-4 text-center ${theme === 'dark' ? 'text-blue-50' : 'text-blue-900'}`}>Career Stats & Achievements</h2>
                  <div className="grid grid-cols-3 gap-4 mb-6">
                      <div className="text-center"><p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Wins</p><p className="text-2xl font-bold">{stats.wins}</p></div>
                      <div className="text-center"><p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Losses</p><p className="text-2xl font-bold">{stats.losses}</p></div>
                      <div className="text-center"><p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Draws</p><p className="text-2xl font-bold">{stats.draws || 0}</p></div>
                  </div>
                   <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="text-center"><p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Highest Score</p><p className="text-2xl font-bold">{stats.highestScore}</p></div>
                      <div className="text-center"><p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Wickets Taken</p><p className="text-2xl font-bold">{stats.wickets}</p></div>
                      <div className="text-center col-span-2"><p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Total Runs</p><p className="text-2xl font-bold">{stats.totalRuns}</p></div>
                  </div>
                  <h3 className={`text-xl font-bold mb-3 text-center ${theme === 'dark' ? 'text-blue-50' : 'text-blue-900'}`}>Achievements</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                      {Object.values(achievements).map(ach => (
                          <div key={ach.title} className={`flex items-center gap-4 p-2 rounded-lg ${ach.unlocked ? (theme === 'dark' ? 'bg-green-900 text-green-200' : 'bg-green-100 text-green-800') : (theme === 'dark' ? 'bg-gray-700 text-gray-400' : 'bg-gray-200 text-gray-600')}`}>
                              <p className="text-2xl">{ach.unlocked ? '🏆' : '🔒'}</p>
                              <div>
                                  <h4 className="font-bold">{ach.title}</h4>
                                  <p className="text-sm">{ach.description}</p>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
      <div id="achievement-notification-container" className="fixed bottom-5 left-1/2 -translate-x-1/2 w-full max-w-sm z-50"></div>
    </div>
  );
}
