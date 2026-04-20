
export type Point = { x: number; y: number };

export enum SnakeType {
  PLAYER1 = 'PLAYER1',
  PLAYER2 = 'PLAYER2',
  BOT = 'BOT'
}

export interface Snake {
  id: string;
  name: string;
  type: SnakeType;
  nodes: Point[];
  angle: number;
  speed: number;
  color: string;
  score: number;
  isDead: boolean;
  thickness: number;
}

export interface Food {
  id: string;
  position: Point;
  value: number;
  color: string;
  size: number;
}

export interface GameState {
  snakes: Snake[];
  foods: Food[];
  worldSize: { width: number; height: number };
}
