import { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { socket } from './socket';
import { ChessRoom } from './components/ChessRoom';
import { Swords, Plus, ArrowRight } from 'lucide-react';

export default function App() {
  const [inGame, setInGame] = useState(false);
  const [gameId, setGameId] = useState('');
  const [joinId, setJoinId] = useState('');

  useEffect(() => {
    socket.connect();
    
    socket.on('gameCreated', ({ gameId }) => {
      setGameId(gameId);
      setInGame(true);
    });

    return () => {
      socket.off('gameCreated');
    };
  }, []);

  const createGame = () => {
    const newId = uuidv4().substring(0, 8); // Short ID for ease
    socket.emit('createGame', { gameId: newId });
  };

  const joinGame = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinId.trim()) {
      setGameId(joinId.trim());
      setInGame(true);
    }
  };

  if (inGame && gameId) {
    return (
      <div className="min-h-screen bg-[#0A0A0B] text-slate-300 font-sans flex flex-col">
        <ChessRoom 
          gameId={gameId} 
          onLeave={() => {
            setInGame(false);
            setGameId('');
            socket.emit('leaveGame'); // Optional cleanup
          }} 
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-4 bg-[#0A0A0B] text-slate-300 font-sans">
      <div className="w-full max-w-md p-8 space-y-8 bg-[#0F0F12] border border-white/10 rounded">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-12 h-12 bg-blue-600 rounded flex items-center justify-center">
            <Swords className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-widest text-white uppercase mt-4">Grandmaster Sync</h1>
          <p className="text-center text-[10px] text-blue-400 font-mono uppercase tracking-tighter">
            Real-time multi-player chess engine with sub-100ms move validation.
          </p>
        </div>

        <div className="pt-6 border-t border-white/10 space-y-6">
          <button
            onClick={createGame}
            className="flex items-center justify-center w-full px-4 py-3 font-bold text-white uppercase tracking-widest text-[10px] bg-blue-600 rounded hover:bg-blue-500 transition-colors"
          >
            <Plus className="w-4 h-4 mr-2" />
            Create New Match
          </button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/10"></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 text-slate-500 bg-[#0F0F12] uppercase tracking-tighter text-[10px]">Or join existing</span>
            </div>
          </div>

          <form onSubmit={joinGame} className="space-y-4">
            <div>
              <label htmlFor="gameId" className="block text-xs font-semibold text-slate-500 uppercase tracking-widest mb-2">
                Match ID
              </label>
              <div className="flex rounded border border-white/10 overflow-hidden bg-white/5 focus-within:border-white/20 transition-colors">
                <input
                  type="text"
                  name="gameId"
                  id="gameId"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  className="flex-1 block w-full min-w-0 px-3 py-2 bg-transparent text-white font-mono text-xs focus:outline-none placeholder-slate-600"
                  placeholder="e.g. 5f8a2b1"
                />
                <button
                  type="submit"
                  disabled={!joinId.trim()}
                  className="relative inline-flex items-center px-4 py-2 space-x-2 text-[10px] font-bold text-slate-300 uppercase tracking-widest bg-white/5 hover:bg-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-l border-white/10"
                >
                  <span>Join</span>
                  <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
