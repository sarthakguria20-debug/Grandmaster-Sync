import express from 'express';
import { createServer as createHttpServer } from 'http';
import { createServer as createViteServer } from 'vite';
import { Server } from 'socket.io';
import { Chess } from 'chess.js';
import path from 'path';

interface GameState {
  chess: Chess;
  players: {
    w: string | null;
    b: string | null;
  };
  spectators: string[];
}

const games = new Map<string, GameState>();

async function startServer() {
  const app = express();
  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
    }
  });

  const PORT = 3000;

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Socket.io logic
  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('createGame', ({ gameId }) => {
      if (!games.has(gameId)) {
        games.set(gameId, {
          chess: new Chess(),
          players: { w: null, b: null },
          spectators: []
        });
      }
      socket.join(gameId);
      socket.emit('gameCreated', { gameId });
    });

    socket.on('joinGame', ({ gameId, requestedColor }) => {
      const game = games.get(gameId);
      if (!game) {
        socket.emit('error', 'Game not found');
        return;
      }

      socket.join(gameId);
      
      let assignedColor = null;
      if (requestedColor === 'w' && !game.players.w) {
        game.players.w = socket.id;
        assignedColor = 'w';
      } else if (requestedColor === 'b' && !game.players.b) {
        game.players.b = socket.id;
        assignedColor = 'b';
      } else if (!game.players.w) {
        game.players.w = socket.id;
        assignedColor = 'w';
      } else if (!game.players.b) {
        game.players.b = socket.id;
        assignedColor = 'b';
      } else {
        game.spectators.push(socket.id);
        assignedColor = 'spectator';
      }

      socket.emit('gameState', {
        fen: game.chess.fen(),
        color: assignedColor,
        isGameOver: game.chess.isGameOver()
      });

      io.to(gameId).emit('playerJoined', {
        players: {
          w: !!game.players.w,
          b: !!game.players.b
        }
      });
    });

    socket.on('makeMove', ({ gameId, sourceSquare, targetSquare, promotion }) => {
      const game = games.get(gameId);
      if (!game) return;

      const isWhite = game.players.w === socket.id;
      const isBlack = game.players.b === socket.id;
      
      if (!isWhite && !isBlack) {
        socket.emit('moveRejected', { fen: game.chess.fen() });
        return;
      }

      const turn = game.chess.turn();
      if ((turn === 'w' && !isWhite) || (turn === 'b' && !isBlack)) {
        socket.emit('moveRejected', { fen: game.chess.fen() });
        return;
      }

      try {
        const move = game.chess.move({
          from: sourceSquare,
          to: targetSquare,
          promotion: promotion || 'q'
        });

        if (move) {
          io.to(gameId).emit('gameState', {
            fen: game.chess.fen(),
            isGameOver: game.chess.isGameOver()
          });
        } else {
          socket.emit('moveRejected', { fen: game.chess.fen() });
        }
      } catch (e) {
        socket.emit('moveRejected', { fen: game.chess.fen() });
      }
    });

    socket.on('disconnect', () => {
      games.forEach((game, gameId) => {
        if (game.players.w === socket.id) game.players.w = null;
        if (game.players.b === socket.id) game.players.b = null;
        game.spectators = game.spectators.filter(id => id !== socket.id);
        
        io.to(gameId).emit('playerLeft', {
          players: {
            w: !!game.players.w,
            b: !!game.players.b
          }
        });
        
        // Clean up empty games after some time
        if (!game.players.w && !game.players.b && game.spectators.length === 0) {
          setTimeout(() => {
            const current = games.get(gameId);
            if (current && !current.players.w && !current.players.b && current.spectators.length === 0) {
              games.delete(gameId);
            }
          }, 1000 * 60 * 5); // 5 minutes
        }
      });
    });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
