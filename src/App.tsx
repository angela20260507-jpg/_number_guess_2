import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { RefreshCcw, Send, Trophy, Hash, Settings2, BarChart3, Clock, Target, Skull } from 'lucide-react';

/**
 * 難度等級型別
 */
type Difficulty = 'simple' | 'medium' | 'hard' | 'custom';
type GameMode = 'single' | 'multiplayer' | 'vs-ai';

interface PlayerState {
  id: string;
  name: string;
  attempts: number[];
  possibleMin: number;
  possibleMax: number;
  attemptDetails: Array<{
    value: number;
    result: 'high' | 'low' | 'correct';
    rangeBefore: [number, number];
    rangeAfter: [number, number];
  }>;
  isWinner: boolean;
}

interface GameConfig {
  min: number;
  max: number;
  maxAttempts: number;
  difficulty: Difficulty;
  mode: GameMode;
}

interface GameStats {
  bestScore: number | null;
  totalGames: number;
  totalWins: number;
  totalGuessesInWins: number;
  multiplayerWins: { p1: number; p2: number; ai: number };
}

interface GameState {
  config: GameConfig;
  target: number;
  currentGuess: string;
  message: string;
  players: PlayerState[];
  currentPlayerIndex: number;
  status: 'setup' | 'playing' | 'finished';
  isGameOver: boolean;
}

const VisualRange: React.FC<{ player: PlayerState; config: GameConfig }> = ({ player, config }) => {
  const total = config.max - config.min;
  const left = ((player.possibleMin - config.min) / total) * 100;
  const right = ((player.possibleMax - config.min) / total) * 100;
  const width = right - left;

  return (
    <div className="w-full space-y-2">
      <div className="flex justify-between text-[10px] font-black text-white/40 uppercase tracking-widest px-1">
        <span>{player.name}</span>
        <span className="text-white/60">{player.possibleMin} ~ {player.possibleMax}</span>
      </div>
      <div className="h-3 w-full bg-white/5 rounded-full relative overflow-hidden border border-white/5 shadow-inner">
        {player.attempts.map((val, i) => (
          <div 
            key={i}
            className="absolute top-0 bottom-0 w-px bg-white/20 z-10"
            style={{ left: `${((val - config.min) / total) * 100}%` }}
          />
        ))}
        <motion.div 
          layout
          className={`absolute top-0 bottom-0 border-x ${player.id === 'p1' ? 'bg-indigo-400/30 border-indigo-400/50' : 'bg-amber-400/30 border-amber-400/50'}`}
          animate={{ left: `${left}%`, width: `${Math.max(1, width)}%` }}
          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        />
      </div>
    </div>
  );
};

export default function App() {
  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('number-dash-stats-v2');
    return saved ? JSON.parse(saved) : {
      bestScore: null,
      totalGames: 0,
      totalWins: 0,
      totalGuessesInWins: 0,
      multiplayerWins: { p1: 0, p2: 0, ai: 0 }
    };
  });

  useEffect(() => {
    localStorage.setItem('number-dash-stats-v2', JSON.stringify(stats));
  }, [stats]);

  const [state, setState] = useState<GameState>({
    config: { min: 1, max: 100, maxAttempts: 7, difficulty: 'medium', mode: 'single' },
    target: 0,
    currentGuess: '',
    message: '挑戰即將開始...',
    players: [],
    currentPlayerIndex: 0,
    isGameOver: false,
    status: 'setup'
  });

  const inputRef = useRef<HTMLInputElement>(null);

  const calculateDefaultMaxAttempts = (max: number) => {
    return Math.ceil(Math.log2(max)) + 1;
  };

  const startPlaying = (config: GameConfig) => {
    const newTarget = Math.floor(Math.random() * config.max) + 1;
    
    const players: PlayerState[] = [];
    if (config.mode === 'single') {
      players.push({
        id: 'p1', name: '玩家 1', attempts: [], possibleMin: config.min, possibleMax: config.max, attemptDetails: [], isWinner: false
      });
    } else if (config.mode === 'multiplayer') {
      players.push({ id: 'p1', name: '玩家 1', attempts: [], possibleMin: config.min, possibleMax: config.max, attemptDetails: [], isWinner: false });
      players.push({ id: 'p2', name: '玩家 2', attempts: [], possibleMin: config.min, possibleMax: config.max, attemptDetails: [], isWinner: false });
    } else {
      players.push({ id: 'p1', name: '玩家 1', attempts: [], possibleMin: config.min, possibleMax: config.max, attemptDetails: [], isWinner: false });
      players.push({ id: 'ai', name: '電腦 (AI)', attempts: [], possibleMin: config.min, possibleMax: config.max, attemptDetails: [], isWinner: false });
    }

    setState({
      config,
      target: newTarget,
      currentGuess: '',
      message: `請猜一個 ${config.min} 到 ${config.max} 之間的數字`,
      players,
      currentPlayerIndex: 0,
      isGameOver: false,
      status: 'playing'
    });

    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 200);
  };

  const handleGuess = (e?: React.FormEvent, manualValue?: number) => {
    if (e) e.preventDefault();
    if (state.status !== 'playing') return;

    const currentPlayer = state.players[state.currentPlayerIndex];
    if (!currentPlayer) return;

    const num = manualValue ?? parseInt(state.currentGuess);

    if (isNaN(num) || num < state.config.min || num > state.config.max) {
      setState(prev => ({ ...prev, message: `無效！請輸入 ${prev.config.min}-${prev.config.max}`, currentGuess: '' }));
      return;
    }

    const newAttempts = [...currentPlayer.attempts, num];
    const rangeBefore: [number, number] = [currentPlayer.possibleMin, currentPlayer.possibleMax];
    let nextMin = currentPlayer.possibleMin;
    let nextMax = currentPlayer.possibleMax;
    
    let result: 'high' | 'low' | 'correct' = 'correct';
    let newMessage = '';
    let isWinner = false;

    if (num === state.target) {
      result = 'correct';
      newMessage = `${currentPlayer.name} 猜對了！`;
      isWinner = true;
    } else if (num > state.target) {
      result = 'high';
      newMessage = `${num} 太大了！`;
      nextMax = Math.min(nextMax, num - 1);
    } else {
      result = 'low';
      newMessage = `${num} 太小了！`;
      nextMin = Math.max(nextMin, num + 1);
    }

    const detail = {
      value: num,
      result,
      rangeBefore,
      rangeAfter: [nextMin, nextMax] as [number, number]
    };

    const updatedPlayer: PlayerState = {
      ...currentPlayer,
      attempts: newAttempts,
      attemptDetails: [...currentPlayer.attemptDetails, detail],
      possibleMin: nextMin,
      possibleMax: nextMax,
      isWinner
    };

    const newPlayers = [...state.players];
    newPlayers[state.currentPlayerIndex] = updatedPlayer;

    const isGameOver = isWinner || newPlayers.every(p => p.attempts.length >= state.config.maxAttempts);
    const nextPlayerIndex = isGameOver ? state.currentPlayerIndex : (state.currentPlayerIndex + 1) % state.players.length;

    if (isWinner) {
      setStats(prev => {
        const multiplayerWins = { ...prev.multiplayerWins };
        if (state.config.mode !== 'single') {
          if (updatedPlayer.id === 'p1') multiplayerWins.p1++;
          else if (updatedPlayer.id === 'p2') multiplayerWins.p2++;
          else if (updatedPlayer.id === 'ai') multiplayerWins.ai++;
        }
        
        return {
          ...prev,
          totalGames: prev.totalGames + 1,
          totalWins: prev.totalWins + (updatedPlayer.id === 'p1' ? 1 : 0),
          totalGuessesInWins: updatedPlayer.id === 'p1' ? prev.totalGuessesInWins + newAttempts.length : prev.totalGuessesInWins,
          bestScore: (updatedPlayer.id === 'p1' && (prev.bestScore === null || newAttempts.length < prev.bestScore)) ? newAttempts.length : prev.bestScore,
          multiplayerWins
        };
      });
    } else if (isGameOver) {
      setStats(prev => ({ ...prev, totalGames: prev.totalGames + 1 }));
    }

    setState(prev => ({
      ...prev,
      players: newPlayers,
      currentPlayerIndex: nextPlayerIndex,
      message: isGameOver ? (isWinner ? newMessage : `遊戲結束！正確答案是 ${state.target}`) : newMessage,
      isGameOver,
      status: isGameOver ? 'finished' : 'playing',
      currentGuess: ''
    }));
  };

  const suggestOptimal = () => {
    const cp = state.players[state.currentPlayerIndex];
    const optimal = Math.floor((cp.possibleMin + cp.possibleMax) / 2);
    setState(prev => ({ ...prev, currentGuess: optimal.toString() }));
    setTimeout(() => handleGuess(undefined, optimal), 100);
  };

  // AI Logic
  useEffect(() => {
    if (state.status === 'playing' && state.players[state.currentPlayerIndex]?.id === 'ai') {
      const timer = setTimeout(() => {
        const cp = state.players[state.currentPlayerIndex];
        // AI 策略：二分搜尋
        const guess = Math.floor((cp.possibleMin + cp.possibleMax) / 2);
        handleGuess(undefined, guess);
      }, 1500); // 延遲 1.5 秒讓玩家有參與感
      return () => clearTimeout(timer);
    }
  }, [state.status, state.currentPlayerIndex, state.players]);

  const getBestSteps = () => Math.ceil(Math.log2(state.config.max - state.config.min + 1));


  const setDifficulty = (diff: Difficulty) => {
    let config: GameConfig = { ...state.config, difficulty: diff };
    switch (diff) {
      case 'simple': config = { ...state.config, min: 1, max: 50, maxAttempts: 10, difficulty: diff }; break;
      case 'medium': config = { ...state.config, min: 1, max: 100, maxAttempts: 7, difficulty: diff }; break;
      case 'hard': config = { ...state.config, min: 1, max: 200, maxAttempts: 5, difficulty: diff }; break;
    }
    setState(prev => ({ ...prev, config }));
  };

  const avgGuesses = stats.totalWins > 0 
    ? (stats.totalGuessesInWins / stats.totalWins).toFixed(1) 
    : '0';

  return (
    <div className="min-h-screen bg-indigo-600 flex flex-col font-sans overflow-hidden relative">
      <div className="absolute -bottom-20 -left-20 w-80 h-80 bg-indigo-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none"></div>
      <div className="absolute -top-20 -right-20 w-80 h-80 bg-amber-400 rounded-full mix-blend-multiply filter blur-3xl opacity-20 pointer-events-none"></div>

      {/* Header */}
      <header className="flex items-center justify-between px-8 py-6 bg-indigo-700/50 backdrop-blur-sm border-b border-indigo-500/30 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center shadow-lg transform rotate-3">
            <span className="text-indigo-900 font-black text-xl leading-none">?</span>
          </div>
          <h1 className="text-white text-2xl font-black tracking-tight uppercase">NUMBΞR DASH</h1>
        </div>
        <div className="flex gap-3">
          <div className="px-4 py-2 bg-indigo-800/80 rounded-full border border-indigo-400/20 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-indigo-100 text-xs font-bold whitespace-nowrap">BEST: {stats.bestScore || '-'}</span>
          </div>
          <div className="hidden sm:flex px-4 py-2 bg-indigo-800/80 rounded-full border border-indigo-400/20 items-center gap-2">
            <BarChart3 className="w-4 h-4 text-sky-400" />
            <span className="text-indigo-100 text-xs font-bold whitespace-nowrap">AVG: {avgGuesses}</span>
          </div>
        </div>
      </header>

      <main className="flex-1 p-6 md:p-10 flex items-center justify-center overflow-y-auto z-10 w-full max-w-7xl mx-auto">
        <AnimatePresence mode="wait">
          {state.status === 'setup' ? (
            /* 設定頁面 */
            <motion.div 
              key="setup"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-2xl bg-white rounded-[40px] p-8 md:p-12 shadow-2xl border-b-8 border-indigo-800"
            >
              <div className="mb-10 text-center">
                <Settings2 className="w-12 h-12 text-indigo-600 mx-auto mb-4" />
                <h2 className="text-3xl font-black text-slate-800 mb-2">準備好挑戰了嗎？</h2>
                <p className="text-slate-500 font-medium">選擇遊戲模式與難度設定</p>
              </div>

              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <RefreshCcw className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">遊戲模式</span>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {(['single', 'multiplayer', 'vs-ai'] as const).map(m => (
                    <button
                      key={m}
                      onClick={() => setState(prev => ({ ...prev, config: { ...prev.config, mode: m } }))}
                      className={`py-3 px-2 rounded-2xl border-2 font-black text-[10px] uppercase tracking-wider transition-all ${
                        state.config.mode === m ? 'bg-indigo-600 border-indigo-600 text-white shadow-lg' : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-200'
                      }`}
                    >
                      {m === 'single' ? '經典單人' : m === 'multiplayer' ? '雙人對戰' : '對戰電腦'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Hash className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">挑戰難度</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
                  {(['simple', 'medium', 'hard'] as const).map((d) => (
                    <button
                      key={d}
                      onClick={() => setDifficulty(d)}
                      className={`p-6 rounded-3xl border-4 transition-all text-left group ${
                        state.config.difficulty === d 
                          ? 'border-indigo-600 bg-indigo-50' 
                          : 'border-slate-100 hover:border-indigo-200 bg-slate-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl mb-4 flex items-center justify-center text-xl ${
                        d === 'simple' ? 'bg-emerald-100 text-emerald-600' :
                        d === 'medium' ? 'bg-sky-100 text-sky-600' : 'bg-rose-100 text-rose-600'
                      }`}>
                        {d === 'simple' ? '🌱' : d === 'medium' ? '🔥' : '💀'}
                      </div>
                      <p className="font-black text-lg uppercase tracking-tight text-slate-800">
                        {d === 'simple' ? '簡單' : d === 'medium' ? '中等' : '困難'}
                      </p>
                      <p className="text-xs font-semibold text-slate-400">
                        1-{d === 'simple' ? '50' : d === 'medium' ? '100' : '200'} • {d === 'simple' ? '10' : d === 'medium' ? '7' : '5'}次
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-50 rounded-3xl p-6 mb-8 border border-slate-200">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">自訂規則</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-6">
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-slate-400 ml-1">上限數字 (1-1000)</label>
                    <input 
                      type="number"
                      value={state.config.max}
                      onChange={(e) => {
                        const val = Math.min(1000, Math.max(10, parseInt(e.target.value) || 10));
                        setState(prev => ({ 
                          ...prev, 
                          config: { ...prev.config, max: val, difficulty: 'custom', maxAttempts: calculateDefaultMaxAttempts(val) } 
                        }));
                      }}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="text-xs font-bold text-slate-400 ml-1">最大嘗試次數</label>
                    <input 
                      type="number"
                      value={state.config.maxAttempts}
                      onChange={(e) => {
                        const val = Math.max(1, parseInt(e.target.value) || 1);
                        setState(prev => ({ ...prev, config: { ...prev.config, maxAttempts: val, difficulty: 'custom' } }));
                      }}
                      className="w-full bg-white border-2 border-slate-200 rounded-xl px-4 py-3 font-bold text-slate-800 outline-none focus:border-indigo-500 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <button 
                onClick={() => startPlaying(state.config)}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-3xl text-xl shadow-xl shadow-indigo-200 transition-all active:scale-[0.98]"
              >
                開始遊戲
              </button>
            </motion.div>
          ) : (
            /* 遊戲進行中與結算 */
            <motion.div 
              key="playing"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full"
            >
              {/* 左側：控制 */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                <div className="bg-white rounded-[40px] p-8 md:p-10 shadow-2xl border-b-8 border-indigo-800 relative overflow-hidden">
                  {/* 當前玩家指標 (僅在多人模式顯示) */}
                  {state.config.mode !== 'single' && state.status === 'playing' && (
                    <motion.div 
                      layoutId="player-indicator"
                      className="absolute top-0 left-0 right-0 h-2 bg-indigo-600"
                      initial={false}
                      animate={{ x: state.currentPlayerIndex === 0 ? '-50%' : '50%' }}
                    />
                  )}

                  <div className="flex justify-between items-start mb-8">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        {state.status === 'playing' && (
                          <div className={`w-3 h-3 rounded-full animate-pulse ${state.players[state.currentPlayerIndex]?.id === 'ai' ? 'bg-amber-400' : 'bg-indigo-600'}`}></div>
                        )}
                        <h2 className="text-slate-800 text-4xl font-black">
                          {state.status === 'finished' 
                            ? (state.players.find(p => p.isWinner) ? `${state.players.find(p => p.isWinner)?.name} 贏了！` : "遊戲結束") 
                            : (state.config.mode === 'single' ? "你猜是什麼？" : `${state.players[state.currentPlayerIndex]?.name} 的回合`)}
                        </h2>
                      </div>
                      <p className="text-slate-500 font-medium tracking-tight">範圍：{state.config.min}-{state.config.max} • {state.config.mode === 'single' ? '經典模式' : state.config.mode === 'multiplayer' ? '對戰模式' : '挑戰電腦'}</p>
                    </div>
                    {state.status === 'playing' && (
                      <div className="flex flex-col items-end">
                        <span className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">剩下次數</span>
                        <div className={`px-4 py-2 rounded-2xl font-black text-2xl ${
                          (state.config.maxAttempts - state.players[state.currentPlayerIndex].attempts.length) <= 2 ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-slate-100 text-slate-800'
                        }`}>
                          {state.config.maxAttempts - state.players[state.currentPlayerIndex].attempts.length}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-6">
                    {state.status === 'playing' ? (
                      <div className="space-y-6">
                        <div className="flex justify-between items-center px-2">
                          <div className="flex gap-2">
                            {state.players[state.currentPlayerIndex]?.id !== 'ai' && (
                              <button 
                                onClick={suggestOptimal}
                                className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase tracking-widest border border-indigo-100 hover:bg-indigo-100 transition-colors flex items-center gap-2"
                              >
                                <Settings2 className="w-3 h-3" />
                                最佳建議
                              </button>
                            )}
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">理論最佳次數</span>
                            <span className="text-slate-800 font-black">{getBestSteps()} 次</span>
                          </div>
                        </div>

                        {state.players[state.currentPlayerIndex]?.id === 'ai' ? (
                          <div className="w-full bg-slate-50 rounded-3xl py-12 px-10 border-4 border-dashed border-amber-200 flex flex-col items-center justify-center gap-4">
                            <RefreshCcw className="w-10 h-10 text-amber-400 animate-spin" />
                            <p className="text-amber-700 font-black uppercase tracking-widest animate-pulse">電腦思考中...</p>
                          </div>
                        ) : (
                          <form onSubmit={handleGuess} className="relative group">
                            <input 
                              ref={inputRef}
                              type="number" 
                              placeholder="?" 
                              value={state.currentGuess}
                              onChange={(e) => setState(prev => ({ ...prev, currentGuess: e.target.value }))}
                              className="w-full bg-slate-50 border-4 border-transparent focus:border-indigo-400 rounded-3xl py-10 px-10 text-7xl font-black text-slate-800 placeholder-slate-100 outline-none transition-all shadow-inner"
                            />
                            <div className="absolute right-6 top-1/2 -translate-y-1/2">
                              <button 
                                type="submit"
                                className="bg-indigo-600 text-white p-6 rounded-2xl font-black hover:bg-indigo-700 active:scale-95 shadow-lg shadow-indigo-200 transition-all"
                              >
                                <Send className="w-8 h-8" />
                              </button>
                            </div>
                          </form>
                        )}
                      </div>
                    ) : (
                      <div className={`py-12 rounded-3xl border-4 text-center ${state.players.some(p => p.isWinner) ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                        <p className={`text-6xl font-black mb-4 ${state.players.some(p => p.isWinner) ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {state.players.some(p => p.isWinner) 
                            ? (state.config.mode === 'single' ? 'WINNER!' : `${state.players.find(p => p.isWinner)?.name} 勝！`) 
                            : 'GAME OVER'}
                        </p>
                        <div className="bg-white/50 inline-block px-8 py-4 rounded-2xl border border-white/50 backdrop-blur-sm">
                          <p className="text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-1">正確答案是</p>
                          <p className="text-5xl text-slate-900 font-black">{state.target}</p>
                        </div>
                        
                        {/* 策略分析 */}
                        <div className="mt-8 px-8 flex flex-col gap-4 items-center">
                          <div className="h-px bg-slate-200 w-full mb-2"></div>
                          {state.config.mode === 'single' ? (
                            <div className="grid grid-cols-2 gap-8 w-full max-sm:max-w-sm">
                              <div className="text-left">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">你的次數</p>
                                <p className="text-xl font-black text-slate-800">{state.players[0].attempts.length} 次</p>
                              </div>
                              <div className="text-left">
                                <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">專家次數</p>
                                <p className="text-xl font-black text-indigo-600">{getBestSteps()} 次</p>
                              </div>
                            </div>
                          ) : (
                            <div className="w-full space-y-4">
                              {state.players.map(p => (
                                <div key={p.id} className="flex justify-between items-center bg-white/40 p-3 rounded-xl border border-white">
                                  <div className="flex items-center gap-2">
                                    <div className={`w-2 h-2 rounded-full ${p.isWinner ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                                    <span className="font-bold text-slate-700">{p.name}</span>
                                  </div>
                                  <span className="font-black text-slate-900">{p.attempts.length} 次猜測</span>
                                </div>
                              ))}
                            </div>
                          )}
                          <div className="bg-indigo-50 p-4 rounded-xl text-left w-full border border-indigo-100 mt-4">
                            <p className="text-indigo-900 text-xs font-bold mb-1">💡 教學時間：</p>
                            <p className="text-indigo-700 text-[10px] leading-relaxed font-medium">
                              在多人模式中，如果你能將對手的猜測結果納入考量並適時使用二分法，你的勝率將會大幅提升！
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* 訊息顯示 */}
                    <AnimatePresence mode="wait">
                      <motion.div 
                        key={state.message}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className={`flex items-center gap-4 p-6 rounded-3xl border-2 transition-all ${
                          state.players.some(p => p.isWinner) ? 'bg-emerald-50 border-emerald-100' : 
                          state.isGameOver ? 'bg-rose-50 border-rose-100' : 'bg-amber-50 border-amber-100'
                        }`}
                      >
                        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shadow-md ${
                          state.players.some(p => p.isWinner) ? 'bg-emerald-400' : state.isGameOver ? 'bg-rose-400' : 'bg-amber-400'
                        }`}>
                          {state.players.some(p => p.isWinner) ? '🏆' : state.isGameOver ? '💀' : state.message.includes('大') ? '📈' : state.message.includes('小') ? '📉' : '🤔'}
                        </div>
                        <div className="flex-1">
                          <p className={`font-black text-xl leading-tight uppercase ${
                            state.players.some(p => p.isWinner) ? 'text-emerald-900' : state.isGameOver ? 'text-rose-900' : 'text-amber-900'
                          }`}>
                            {state.players.some(p => p.isWinner) ? '成功!' : state.isGameOver ? '失敗!' : '提示'}
                          </p>
                          <p className={`font-medium opacity-80 ${
                            state.players.some(p => p.isWinner) ? 'text-emerald-800' : state.isGameOver ? 'text-rose-800' : 'text-amber-800'
                          }`}>
                            {state.message}
                          </p>
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={() => setState(prev => ({ ...prev, status: 'setup' }))}
                    className="flex-1 bg-white hover:bg-slate-50 text-slate-800 font-black py-4 rounded-2xl border-b-4 border-slate-200 text-lg tracking-tight shadow-xl transition-all active:translate-y-1"
                  >
                    設定模式
                  </button>
                  <button 
                    onClick={() => startPlaying(state.config)}
                    className="flex-[2] bg-indigo-500 hover:bg-indigo-400 text-white font-black py-4 rounded-2xl border-b-4 border-indigo-700 text-lg tracking-widest uppercase shadow-xl transition-all active:translate-y-1"
                  >
                    {state.status === 'finished' ? '再玩一局' : '重新開始'}
                  </button>
                </div>

                <div className="mt-4 space-y-4">
                  {state.players.map(p => (
                    <VisualRange key={p.id} player={p} config={state.config} />
                  ))}
                </div>
              </div>

              {/* 右側：歷程與統計 */}
              <div className="lg:col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-6 h-full">
                  <div className="bg-indigo-800/40 rounded-3xl p-8 border border-indigo-400/20 flex justify-between items-center whitespace-nowrap overflow-hidden">
                    <div>
                      <p className="text-indigo-200 uppercase text-[10px] font-bold tracking-widest mb-1">場次統計</p>
                      <p className="text-white text-3xl font-black">{stats.totalGames} 局</p>
                    </div>
                    <div className="text-right">
                      <p className="text-indigo-200 uppercase text-[10px] font-bold tracking-widest mb-1">平均次數</p>
                      <p className="text-white text-3xl font-black">{avgGuesses}</p>
                    </div>
                  </div>

                  <div className="flex-1 min-h-[400px] bg-white/5 rounded-[40px] border border-indigo-400/20 p-8 flex flex-col overflow-hidden">
                    <h3 className="text-white font-bold mb-6 flex items-center gap-2">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full"></span>
                      <span className="opacity-50 uppercase tracking-widest text-[10px]">詳盡猜測歷程</span>
                    </h3>
                    
                    <div className="space-y-4 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[500px]">
                      <AnimatePresence initial={false}>
                        {(() => {

                          // 展示當前玩家或者是所有玩家的合併
                          const visibleDetails = state.config.mode === 'single' 
                            ? state.players[0]?.attemptDetails || []
                            : state.players.flatMap(p => p.attemptDetails.map(d => ({ ...d, playerName: p.name, playerId: p.id })));

                          return [...visibleDetails].reverse().map((detail, idx) => {
                            const count = visibleDetails.length - idx;
                            const shrinking = detail.rangeBefore[1] - detail.rangeBefore[0] - (detail.rangeAfter[1] - detail.rangeAfter[0]);
                            return (
                              <motion.div 
                                key={idx}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="flex flex-col gap-3 p-5 bg-white/10 rounded-2xl border border-white/5"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-4">
                                    <span className="text-indigo-300 font-mono font-bold text-xs">{detail.playerName ? detail.playerName : `#${count.toString().padStart(2, '0')}`}</span>
                                    <span className="text-white font-black text-2xl">{detail.value}</span>
                                  </div>
                                  <span className={`px-3 py-1 text-[8px] font-black rounded-lg uppercase ${
                                    detail.result === 'high' ? 'bg-rose-400 text-rose-950' : 
                                    detail.result === 'low' ? 'bg-sky-400 text-sky-950' : 'bg-emerald-400 text-emerald-950'
                                  }`}>
                                    {detail.result === 'high' ? 'Too High' : detail.result === 'low' ? 'Too Low' : 'Correct'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 text-[8px] font-bold text-white/40 uppercase">
                                  <div className="flex-1 bg-white/5 rounded-lg p-2 border border-white/5">
                                    範圍：{detail.rangeBefore[0]}~{detail.rangeBefore[1]} ➔ {detail.rangeAfter[0]}~{detail.rangeAfter[1]}
                                  </div>
                                  {shrinking > 0 && (
                                    <div className="bg-emerald-500/20 text-emerald-400 rounded-lg p-2 border border-emerald-500/20 whitespace-nowrap">
                                      縮小 {shrinking} 點
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          });
                        })()}
                      </AnimatePresence>
                      {state.players.every(p => p.attempts.length === 0) && (
                        <div className="h-full flex flex-col items-center justify-center opacity-20 py-12">
                          <Skull className="w-16 h-16 text-white mb-4" />
                          <p className="text-white font-black text-sm tracking-widest uppercase">Waiting for input</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-6">
                  {/* 把之前的右側資訊整合進來 */}
                  <div className="bg-indigo-800/40 rounded-3xl p-8 border border-indigo-400/20 flex justify-between items-center">
                    <div className="flex-1">
                      <p className="text-indigo-200 uppercase text-[10px] font-bold tracking-widest mb-1">本次猜測</p>
                      <p className="text-white text-5xl font-black">{state.players[state.currentPlayerIndex]?.attempts.length.toString().padStart(2, '0')}</p>
                    </div>
                    {state.config.mode !== 'single' && (
                      <div className="flex-1 text-right border-l border-white/10 pl-6">
                        <p className="text-indigo-200 uppercase text-[10px] font-bold tracking-widest mb-1">勝場比 (P1:P2/AI)</p>
                        <p className="text-white text-2xl font-black">{stats.multiplayerWins.p1}:{state.config.mode === 'vs-ai' ? stats.multiplayerWins.ai : stats.multiplayerWins.p2}</p>
                      </div>
                    )}
                    <Clock className="w-12 h-12 text-white/20 ml-4 shrink-0" />
                  </div>
                  
                  <div className="flex-1 bg-white p-8 rounded-[40px] border-b-8 border-slate-200">
                    <div className="flex items-center gap-2 mb-6">
                      <BarChart3 className="w-5 h-5 text-indigo-600" />
                      <h4 className="font-black text-slate-800 uppercase tracking-tight">歷史紀錄統計</h4>
                    </div>
                    <div className="space-y-6">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-500">總遊玩次數</span>
                        <span className="text-xl font-black text-slate-900">{stats.totalGames}</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-500">成功次數</span>
                        <span className="text-xl font-black text-emerald-600">{stats.totalWins}</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-500">場次勝率</span>
                        <span className="text-xl font-black text-indigo-600">{stats.totalGames > 0 ? ((stats.totalWins / stats.totalGames) * 100).toFixed(0) : 0}%</span>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-500">每局平均猜測</span>
                        <span className="text-xl font-black text-sky-600">{avgGuesses}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
      `}} />
    </div>
  );
}
