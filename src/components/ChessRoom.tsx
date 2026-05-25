import { useEffect, useState, useRef } from 'react';
import { Chess, Square } from 'chess.js';
import { Chessboard } from 'react-chessboard';
import { socket } from '../socket';
import { Loader2, Users, AlertCircle, Copy, Check } from 'lucide-react';

interface ChessRoomProps {
  gameId: string;
  onLeave: () => void;
}

export function ChessRoom({ gameId, onLeave }: ChessRoomProps) {
  const [game, setGame] = useState(new Chess());
  const [playerColor, setPlayerColor] = useState<'w' | 'b' | 'spectator' | null>(null);
  const [playersPresence, setPlayersPresence] = useState({ w: false, b: false });
  const [errorError, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardWidth, setBoardWidth] = useState(400);

  useEffect(() => {
    // Handle responsive board
    const handleResize = () => {
      if (containerRef.current) {
        const width = Math.min(containerRef.current.clientWidth, window.innerHeight - 250);
        setBoardWidth(width);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    socket.emit('joinGame', { gameId });

    socket.on('gameState', ({ fen, color, isGameOver }) => {
      const newGame = new Chess(fen);
      setGame(newGame);
      if (color) {
        setPlayerColor(color);
      }
    });

    socket.on('moveRejected', ({ fen }) => {
      setGame(new Chess(fen));
    });

    socket.on('playerJoined', ({ players }) => {
      setPlayersPresence(players);
    });

    socket.on('playerLeft', ({ players }) => {
      setPlayersPresence(players);
    });

    socket.on('error', (msg) => {
      setError(msg);
    });

    return () => {
      socket.off('gameState');
      socket.off('moveRejected');
      socket.off('playerJoined');
      socket.off('playerLeft');
      socket.off('error');
    };
  }, [gameId]);

  function onDrop(sourceSquare: Square, targetSquare: Square, piece: string) {
    if (playerColor === 'spectator') return false;
    
    // Quick local validation to prevent invalid drops optimistically
    const turn = game.turn();
    if (playerColor !== turn) return false;

    try {
      const move = game.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: piece[1].toLowerCase() ?? 'q',
      });
      
      // Update local state temporarily for snappy UI
      setGame(new Chess(game.fen()));
      
      // Confirm with server
      socket.emit('makeMove', {
        gameId,
        sourceSquare,
        targetSquare,
        promotion: piece[1].toLowerCase() ?? 'q'
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(gameId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (errorError) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full space-y-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-lg font-medium text-white">{errorError}</p>
        <button
          onClick={onLeave}
          className="px-4 py-2 font-bold text-white uppercase tracking-widest text-[10px] transition-colors bg-blue-600 rounded hover:bg-blue-500"
        >
          Return to Lobby
        </button>
      </div>
    );
  }

  if (!playerColor) {
    return (
      <div className="flex flex-col flex-1 items-center justify-center h-full space-y-4">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-500 text-[10px] uppercase font-mono tracking-widest">Connecting to game...</p>
      </div>
    );
  }

  const isMyTurn = game.turn() === playerColor;
  const status = game.isGameOver() 
    ? "Game Over" 
    : (playerColor === 'spectator' ? "Spectating" : (isMyTurn ? "Your Turn" : "Opponent's Turn"));

  return (
    <div className="flex flex-col flex-1 w-full overflow-hidden">
      {/* Top Navigation Bar style from design */}
      <nav className="h-16 border-b border-white/10 px-6 flex items-center justify-between bg-[#0F0F12] shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-sm">GM</div>
          <div>
            <h1 className="text-sm font-bold tracking-widest text-white uppercase">Grandmaster Sync</h1>
            <p className="text-[10px] text-blue-400 font-mono">LIVE MATCH :: ID {gameId}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase text-slate-500 tracking-tighter">Match Status</span>
            <span className={`text-xs font-mono uppercase ${game.isGameOver() ? 'text-purple-400' : 'text-emerald-400'}`}>
              {status}
            </span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[10px] uppercase text-slate-500 tracking-tighter">Players</span>
            <span className="text-xs font-mono text-emerald-400">
              W: {playersPresence.w ? '✓' : '✗'} / B: {playersPresence.b ? '✓' : '✗'} 
            </span>
          </div>
          <div className="h-8 w-[1px] bg-white/10"></div>
          <button
            onClick={onLeave}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 transition-colors border border-white/10 rounded text-[10px] font-bold tracking-widest uppercase text-white"
          >
            Leave Game
          </button>
        </div>
      </nav>

      {/* Main content area */}
      <main className="flex-1 flex overflow-hidden">
        {/* Abstract Board Info Panel */}
        <aside className="w-80 border-r border-white/10 bg-[#0F0F12] flex flex-col p-4 stretch">
          <div>
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-4">Board Info</h2>
            <div className="p-4 bg-white/5 border border-white/10 rounded space-y-3">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-tighter">Match ID</span>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono text-white">{gameId}</span>
                  <button onClick={handleCopy} className="text-slate-400 hover:text-white transition-colors">
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[10px] text-slate-500 uppercase tracking-tighter">Playing As</span>
                <span className="text-xs font-mono text-white uppercase">{playerColor}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] text-slate-500 uppercase tracking-tighter">FEN Snapshot</span>
                <span className="text-[9px] font-mono text-blue-400 truncate w-32 text-right">{game.fen().split(' ')[0]}</span>
              </div>
            </div>
          </div>
        </aside>

        <section className="flex-1 flex flex-col bg-[#0A0A0B] items-center justify-center p-8 overflow-y-auto">
          <div 
            ref={containerRef} 
            className="flex items-center justify-center w-full max-w-2xl bg-[#0F0F12] border border-white/10 rounded p-4 shadow-2xl"
          >
            <div style={{ width: boardWidth }}>
              <Chessboard
                id="MultiplayerChess"
                position={game.fen()}
                onPieceDrop={onDrop}
                boardOrientation={playerColor === 'b' ? 'black' : 'white'}
                customDarkSquareStyle={{ backgroundColor: '#2B2B2F' }}
                customLightSquareStyle={{ backgroundColor: '#48484E' }}
                animationDuration={200}
                isDraggablePiece={({ piece }) => {
                  if (playerColor === 'spectator') return false;
                  if (game.isGameOver()) return false;
                  return piece[0].toLowerCase() === playerColor;
                }}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
