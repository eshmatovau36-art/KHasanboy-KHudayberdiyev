import React, { useEffect, useRef, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Zap, Skull, RefreshCw, BarChart3, Activity } from 'lucide-react';
import { Simulation } from './game/Simulation';
import { SnakeType, Snake } from './types';
import { WORLD_WIDTH, WORLD_HEIGHT } from './game/constants';

// --- Components ---

const Leaderboard = ({ snakes }: { snakes: Snake[] }) => {
  const topSnakes = useMemo(() => {
    return [...snakes]
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [snakes]);

  return (
    <div className="bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col h-full">
      <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] mb-4 opacity-70 border-b border-white/10 pb-2 flex items-center gap-2">
        <Trophy className="w-3 h-3 text-neon-blue" />
        Live Standings
      </h2>
      <div className="space-y-1.5 flex-1 overflow-y-auto pr-1">
        {topSnakes.map((snake, i) => {
          let borderColor = 'border-white/20';
          let textColor = 'text-white/70';
          if (snake.type === SnakeType.PLAYER1) { borderColor = 'border-neon-green'; textColor = 'neon-text-green'; }
          else if (snake.type === SnakeType.PLAYER2) { borderColor = 'border-neon-pink'; textColor = 'neon-text-pink'; }
          else if (i === 0) { borderColor = 'border-neon-blue'; textColor = 'neon-text-blue'; }

          return (
            <div key={snake.id} className={`flex items-center justify-between p-2 rounded leaderboard-row border-l-2 ${borderColor}`}>
              <div className="flex items-center gap-3 overflow-hidden">
                <span className="font-mono text-[10px] opacity-40">0{i + 1}</span>
                <span className={`text-xs font-semibold truncate ${snake.type !== SnakeType.BOT ? 'font-black' : ''}`}>
                  {snake.name}
                </span>
              </div>
              <span className={`font-mono text-xs ${textColor}`}>
                {Math.floor(snake.score).toLocaleString()}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-white/10">
        <div className="flex justify-between items-center text-[10px] font-bold uppercase opacity-40 tracking-widest">
           <span>Total Agents</span>
           <span className="font-mono">{snakes.length}</span>
        </div>
      </div>
    </div>
  );
};

const Minimap = ({ simulation }: { simulation: Simulation }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = 120 / WORLD_WIDTH;
    ctx.clearRect(0, 0, 120, 120);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(0, 0, 120, 120);

    simulation.snakes.forEach(s => {
      if (s.isDead) return;
      ctx.fillStyle = s.color;
      const x = s.nodes[0].x * scale;
      const y = s.nodes[0].y * scale;
      ctx.beginPath();
      ctx.arc(x, y, (s.type === SnakeType.BOT ? 1 : 2), 0, Math.PI * 2);
      ctx.fill();
    });
  }, [simulation.snakes]);

  return (
    <div className="relative border border-white/10 rounded-lg overflow-hidden shadow-2xl bg-black">
       <div className="absolute top-2 left-2 text-[8px] font-bold uppercase tracking-widest opacity-30 z-10">Map Overlay</div>
      <canvas ref={canvasRef} width={120} height={120} />
    </div>
  );
};

// --- Main App ---

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simulation = useRef(new Simulation());
  const [gameState, setGameState] = useState<{ snakes: Snake[] }>({ snakes: [] });
  const [isDead, setIsDead] = useState(false);

  // Input states
  const keys = useRef<Set<string>>(new Set());
  const pointer = useRef<{ x: number; y: number; isDown: boolean }>({ x: 0, y: 0, isDown: false });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => keys.current.add(e.code);
    const handleKeyUp = (e: KeyboardEvent) => keys.current.delete(e.code);
    
    const handlePointerDown = (e: PointerEvent) => {
        pointer.current.isDown = true;
        updatePointerPos(e);
    };
    const handlePointerMove = (e: PointerEvent) => updatePointerPos(e);
    const handlePointerUp = () => pointer.current.isDown = false;

    const updatePointerPos = (e: PointerEvent) => {
        pointer.current.x = e.clientX;
        pointer.current.y = e.clientY;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, []);

  useEffect(() => {
    let frameId: number;
    const loop = () => {
      const p1 = simulation.current.snakes.find(s => s.type === SnakeType.PLAYER1);
      const p2 = simulation.current.snakes.find(s => s.type === SnakeType.PLAYER2);

      const canvas = canvasRef.current;
      if (!canvas) return;

      // Handle P1 Input
      let p1Turn = 0;
      if (keys.current.has('ArrowLeft')) p1Turn -= 0.1;
      if (keys.current.has('ArrowRight')) p1Turn += 0.1;

      // Click to move logic for P1
      if (p1 && !p1.isDead && pointer.current.isDown) {
          // Find P1 head in screen coordinates
          const zoom = 0.8;
          let camX = WORLD_WIDTH / 2;
          let camY = WORLD_HEIGHT / 2;

          if (p1 && !p1.isDead && p2 && !p2.isDead) {
            camX = (p1.nodes[0].x + p2.nodes[0].x) / 2;
            camY = (p1.nodes[0].y + p2.nodes[0].y) / 2;
          } else if (p1 && !p1.isDead) {
            camX = p1.nodes[0].x;
            camY = p1.nodes[0].y;
          } else if (p2 && !p2.isDead) {
            camX = p2.nodes[0].x;
            camY = p2.nodes[0].y;
          }

          // Screen pos of snake head:
          // screenX = (head.x - camX) * zoom + canvas.width / 2
          // screenY = (head.y - camY) * zoom + canvas.height / 2
          const head = p1.nodes[0];
          const headScreenX = (head.x - camX) * zoom + canvas.width / 2;
          const headScreenY = (head.y - camY) * zoom + canvas.height / 2;
          
          const targetAngle = Math.atan2(pointer.current.y - headScreenY, pointer.current.x - headScreenX);
          const diff = simulation.current.normalizeAngle(targetAngle - p1.angle);
          p1.angle += diff * 0.1;
      }

      const p1Boost = keys.current.has('ShiftRight');

      // Handle P2 Input (WASD)
      let p2Turn = 0;
      if (keys.current.has('KeyA')) p2Turn -= 0.1;
      if (keys.current.has('KeyD')) p2Turn += 0.1;
      const p2Boost = keys.current.has('KeyQ');

      if (p1 && !p1.isDead) p1.angle += p1Turn;
      if (p2 && !p2.isDead) p2.angle += p2Turn;

      simulation.current.update({
        p1: p1?.angle ?? 0,
        p2: p2?.angle ?? 0,
        p1Boost,
        p2Boost
      });

      render();
      setGameState({ snakes: [...simulation.current.snakes] });
      
      if (p1?.isDead && p2?.isDead && !isDead) setIsDead(true);

      frameId = requestAnimationFrame(loop);
    };

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const p1 = simulation.current.snakes.find(s => s.type === SnakeType.PLAYER1);
      const p2 = simulation.current.snakes.find(s => s.type === SnakeType.PLAYER2);
      
      let camX = WORLD_WIDTH / 2;
      let camY = WORLD_HEIGHT / 2;

      if (p1 && !p1.isDead && p2 && !p2.isDead) {
        camX = (p1.nodes[0].x + p2.nodes[0].x) / 2;
        camY = (p1.nodes[0].y + p2.nodes[0].y) / 2;
      } else if (p1 && !p1.isDead) {
        camX = p1.nodes[0].x;
        camY = p1.nodes[0].y;
      } else if (p2 && !p2.isDead) {
        camX = p2.nodes[0].x;
        camY = p2.nodes[0].y;
      }

      ctx.save();
      ctx.fillStyle = '#050505';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const zoom = 0.8;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-camX, -camY);

      // Draw Grid
      ctx.strokeStyle = 'rgba(0, 255, 153, 0.05)';
      ctx.lineWidth = 1;
      for (let x = 0; x <= WORLD_WIDTH; x += 100) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD_HEIGHT); ctx.stroke();
      }
      for (let y = 0; y <= WORLD_HEIGHT; y += 100) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD_WIDTH, y); ctx.stroke();
      }

      // Draw World Border
      ctx.strokeStyle = 'rgba(0, 255, 153, 0.4)';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

      // Draw Food
      simulation.current.foods.forEach(f => {
        ctx.fillStyle = f.color;
        ctx.beginPath();
        ctx.arc(f.position.x, f.position.y, f.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw Snakes
      simulation.current.snakes.forEach(snake => {
        if (snake.isDead) return;
        
        // Draw Direction Line for players
        if (snake.type !== SnakeType.BOT) {
            ctx.save();
            ctx.setLineDash([5, 10]);
            ctx.strokeStyle = snake.color;
            ctx.globalAlpha = 0.3;
            ctx.lineWidth = 2;
            const head = snake.nodes[0];
            ctx.beginPath();
            ctx.moveTo(head.x, head.y);
            ctx.lineTo(
                head.x + Math.cos(snake.angle) * 150,
                head.y + Math.sin(snake.angle) * 150
            );
            ctx.stroke();
            ctx.restore();
        }

        ctx.lineWidth = snake.thickness;
        ctx.lineCap = 'butt'; // Geometric feel
        ctx.lineJoin = 'miter';
        ctx.strokeStyle = snake.color;

        ctx.beginPath();
        ctx.moveTo(snake.nodes[0].x, snake.nodes[0].y);
        for (let i = 1; i < snake.nodes.length; i++) {
          ctx.lineTo(snake.nodes[i].x, snake.nodes[i].y);
        }
        ctx.stroke();

        const head = snake.nodes[0];
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(snake.name.toUpperCase(), head.x, head.y - 15);
      });

      ctx.restore();
    };

    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = container.clientHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    frameId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleResize);
    };
  }, [isDead]);

  const restart = () => {
    simulation.current.reset();
    setIsDead(false);
  };

  const p1 = gameState.snakes.find(s => s.type === SnakeType.PLAYER1) || null;
  const p2 = gameState.snakes.find(s => s.type === SnakeType.PLAYER2) || null;

  return (
    <div className="fixed inset-0 flex flex-col p-6 space-y-4 bg-[#050505] selection:bg-neon-green selection:text-black">
      {/* Header */}
      <header className="flex justify-between items-end border-b border-white/10 pb-4 shrink-0">
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-[0.4em] opacity-50">Zone 01 // Multi-Agent</span>
          <h1 className="text-4xl font-black tracking-tighter neon-text-green">
            NEON<span className="text-white/20">_</span>SNK
          </h1>
        </div>
        
        <div className="flex gap-8 items-center">
          <div className="text-right">
            <div className="text-[10px] uppercase opacity-50 tracking-widest flex items-center justify-end gap-2">
              <Activity className="w-3 h-3" />
              Status
            </div>
            <div className="text-xl font-mono text-white">LIVE</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase opacity-50 tracking-widest flex items-center justify-end gap-2">
              <BarChart3 className="w-3 h-3" />
              Global High
            </div>
            <div className="text-xl font-mono neon-text-blue">98,420</div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex flex-1 gap-6 overflow-hidden min-h-0">
        {/* Game Canvas Section */}
        <section ref={containerRef} className="relative flex-1 neon-border rounded-lg grid-bg overflow-hidden bg-black">
          <canvas ref={canvasRef} className="block cursor-crosshair" />
          
          <div className="absolute bottom-6 left-6 flex gap-8 text-[10px] font-mono text-white/40 uppercase tracking-widest z-10 pointer-events-none bg-black/40 backdrop-blur px-3 py-1 rounded">
            <div className="flex items-center gap-2 font-bold">
              <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
              X: {p1 ? Math.floor(p1.nodes[0].x) : '000'}
            </div>
            <div className="flex items-center gap-2 font-bold">
              <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse" />
              Y: {p1 ? Math.floor(p1.nodes[0].y) : '000'}
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className="w-72 flex flex-col gap-4 shrink-0 overflow-y-auto">
          {/* Leaderboard */}
          <div className="h-2/3">
            <Leaderboard snakes={gameState.snakes} />
          </div>

          {/* Player Stats & Controls */}
          <div className="flex-1 bg-white/5 rounded-lg p-4 border border-white/10 flex flex-col justify-between overflow-hidden">
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <h3 className="text-[10px] font-bold uppercase tracking-widest opacity-50">Local Agents</h3>
                <div className="space-y-2">
                   <div className="flex justify-between items-end border-b border-white/5 pb-1">
                      <span className="text-[10px] uppercase font-bold neon-text-green">Player 1</span>
                      <span className="font-mono text-lg">{p1 ? Math.floor(p1.score) : 0}</span>
                   </div>
                   <div className="flex justify-between items-end border-b border-white/5 pb-1">
                      <span className="text-[10px] uppercase font-bold neon-text-pink">Player 2</span>
                      <span className="font-mono text-lg">{p2 ? Math.floor(p2.score) : 0}</span>
                   </div>
                </div>
              </div>

              <div className="bg-black/20 p-2 rounded border border-white/5">
                <Minimap simulation={simulation.current} />
              </div>
            </div>

            <div className="pt-4 border-t border-white/10 mt-4">
              <div className="flex justify-between text-[8px] font-bold uppercase opacity-30 tracking-widest">
                <span>P1: Arrows / Shift</span>
                <span>P2: WASD / Q</span>
              </div>
            </div>
          </div>
        </aside>
      </main>

      {/* Footer */}
      <footer className="flex justify-between items-center text-[10px] tracking-widest opacity-40 uppercase shrink-0">
        <div>v2.4.0-stable</div>
        <div>Latency: 14ms</div>
        <div>Server: Uzbekistan_Central_01</div>
      </footer>

      {/* Death Overlay */}
      <AnimatePresence>
        {isDead && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md z-50 p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="text-center max-w-md bg-[#050505] p-10 border border-white/10 rounded-2xl neon-border relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-full h-[2px] bg-neon-green shadow-[0_0_15px_#00ff99]" />
              
              <Skull className="w-16 h-16 text-red-500 mx-auto mb-6" />
              <h1 className="text-4xl font-black uppercase tracking-tighter mb-2 italic neon-text-pink">Combat Terminated</h1>
              <p className="text-white/40 mb-8 font-mono text-xs uppercase tracking-widest">Session // Overriden by physical laws</p>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-[10px] uppercase opacity-40 mb-1 font-bold tracking-widest">P1 Score</div>
                    <div className="text-2xl font-mono font-bold neon-text-green">{Math.floor(p1?.score || 0)}</div>
                </div>
                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-[10px] uppercase opacity-40 mb-1 font-bold tracking-widest">P2 Score</div>
                    <div className="text-2xl font-mono font-bold neon-text-pink">{Math.floor(p2?.score || 0)}</div>
                </div>
              </div>

              <button 
                onClick={restart}
                className="group relative px-8 py-3 bg-neon-green text-black hover:brightness-110 transition-all rounded-sm font-black uppercase tracking-[0.2em] text-[10px] flex items-center gap-2 mx-auto active:translate-y-0.5"
              >
                <RefreshCw className="w-3 h-3 group-hover:rotate-180 transition-transform duration-500" />
                <span>Initiate Reset</span>
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
