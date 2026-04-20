
import { Point, Snake, SnakeType, Food } from '../types';
import { 
  WORLD_WIDTH, WORLD_HEIGHT, BASE_SPEED, BOOST_SPEED, 
  TURN_SPEED, INITIAL_NODES, NODE_SPACING, FOOD_COUNT, 
  BOT_COUNT, NEON_COLORS 
} from './constants';

export class Simulation {
  snakes: Snake[] = [];
  foods: Food[] = [];
  
  constructor() {
    this.reset();
  }

  reset() {
    this.snakes = [];
    this.foods = [];
    
    // Add Player 1
    this.addSnake('Siz (1)', SnakeType.PLAYER1, NEON_COLORS[0]);
    
    // Add Player 2
    this.addSnake('Do\'st (2)', SnakeType.PLAYER2, NEON_COLORS[2]);
    
    // Add Bots
    for (let i = 0; i < BOT_COUNT; i++) {
      this.addSnake(`Bot ${i + 1}`, SnakeType.BOT, NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)]);
    }
    
    // Initial food
    for (let i = 0; i < FOOD_COUNT; i++) {
      this.spawnFood();
    }
  }

  addSnake(name: string, type: SnakeType, color: string) {
    const x = Math.random() * WORLD_WIDTH;
    const y = Math.random() * WORLD_HEIGHT;
    const angle = Math.random() * Math.PI * 2;
    
    const nodes: Point[] = [];
    for (let i = 0; i < INITIAL_NODES; i++) {
      nodes.push({ 
        x: x - Math.cos(angle) * i * NODE_SPACING, 
        y: y - Math.sin(angle) * i * NODE_SPACING 
      });
    }

    this.snakes.push({
      id: Math.random().toString(36).substr(2, 9),
      name,
      type,
      nodes,
      angle,
      speed: BASE_SPEED,
      color,
      score: 0,
      isDead: false,
      thickness: 15
    });
  }

  spawnFood(pos?: Point, value?: number) {
    this.foods.push({
      id: Math.random().toString(36).substr(2, 9),
      position: pos || { x: Math.random() * WORLD_WIDTH, y: Math.random() * WORLD_HEIGHT },
      value: value || 1,
      color: NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)],
      size: value ? 5 + value : 5 + Math.random() * 5
    });
  }

  update(inputs: { p1: number; p2: number; p1Boost: boolean; p2Boost: boolean }) {
    // 1. Update Angles & Movement
    this.snakes.forEach(snake => {
      if (snake.isDead) return;

      // Handle Inputs
      if (snake.type === SnakeType.PLAYER1) {
        if (inputs.p1 !== null) {
          const diff = this.normalizeAngle(inputs.p1 - snake.angle);
          snake.angle += diff * TURN_SPEED;
        }
        snake.speed = inputs.p1Boost ? BOOST_SPEED : BASE_SPEED;
      } else if (snake.type === SnakeType.PLAYER2) {
        if (inputs.p2 !== null) {
          const diff = this.normalizeAngle(inputs.p2 - snake.angle);
          snake.angle += diff * TURN_SPEED;
        }
        snake.speed = inputs.p2Boost ? BOOST_SPEED : BASE_SPEED;
      } else {
        // AI Logic
        this.updateBot(snake);
      }

      // Move Head
      const head = { ...snake.nodes[0] };
      head.x += Math.cos(snake.angle) * snake.speed;
      head.y += Math.sin(snake.angle) * snake.speed;
      
      // Update nodes positions (trailing)
      const newNodes = [head];
      let prev = head;
      for (let i = 1; i < snake.nodes.length; i++) {
        const curr = snake.nodes[i];
        const dx = prev.x - curr.x;
        const dy = prev.y - curr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > NODE_SPACING) {
          const ratio = NODE_SPACING / dist;
          curr.x = prev.x - dx * ratio;
          curr.y = prev.y - dy * ratio;
        }
        newNodes.push(curr);
        prev = curr;
      }
      snake.nodes = newNodes;

      // Wall collision
      if (head.x < 0 || head.x > WORLD_WIDTH || head.y < 0 || head.y > WORLD_HEIGHT) {
        this.killSnake(snake);
      }
    });

    // 2. Collision Detection (Head to Body)
    for (const snakeA of this.snakes) {
      if (snakeA.isDead) continue;
      const headA = snakeA.nodes[0];

      for (const snakeB of this.snakes) {
        if (snakeB.isDead) continue;
        if (snakeA.id === snakeB.id) continue; // Disable self-collision
        
        // Check headA against snakeB nodes
        for (let i = 0; i < snakeB.nodes.length; i++) {
          const nodeB = snakeB.nodes[i];
          const dx = headA.x - nodeB.x;
          const dy = headA.y - nodeB.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (dist < (snakeB.thickness / 2 + snakeA.thickness / 2)) {
            this.killSnake(snakeA);
            break;
          }
        }
        if (snakeA.isDead) break;
      }
    }

    // 3. Eating Food
    this.snakes.forEach(snake => {
      if (snake.isDead) return;
      const head = snake.nodes[0];
      
      for (let i = this.foods.length - 1; i >= 0; i--) {
        const food = this.foods[i];
        const dx = head.x - food.position.x;
        const dy = head.y - food.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < (snake.thickness + food.size)) {
          snake.score += food.value;
          // Grow snake
          for(let k = 0; k < food.value; k++) {
              const last = snake.nodes[snake.nodes.length - 1];
              snake.nodes.push({ ...last });
          }
          this.foods.splice(i, 1);
          this.spawnFood();
        }
      }
    });

    // 4. Boost consumption (optional: lose length when boosting)
    this.snakes.forEach(snake => {
        if (!snake.isDead && snake.speed === BOOST_SPEED && snake.nodes.length > 10 && Math.random() > 0.8) {
            const node = snake.nodes.pop();
            if (node) this.spawnFood(node, 1);
        }
    });
  }

  updateBot(snake: Snake) {
    // 1. Find nearest food
    let nearestFood: Food | null = null;
    let minDist = Infinity;
    const head = snake.nodes[0];

    for (const food of this.foods) {
      const dx = head.x - food.position.x;
      const dy = head.y - food.position.y;
      const d = dx * dx + dy * dy;
      if (d < minDist) {
        minDist = d;
        nearestFood = food;
      }
    }

    // 2. Steer towards food
    if (nearestFood) {
      const targetAngle = Math.atan2(nearestFood.position.y - head.y, nearestFood.position.x - head.x);
      const diff = this.normalizeAngle(targetAngle - snake.angle);
      snake.angle += diff * TURN_SPEED;
    }

    // 3. Simple Avoidance (Check few points ahead)
    const lookAhead = 50;
    const checkX = head.x + Math.cos(snake.angle) * lookAhead;
    const checkY = head.y + Math.sin(snake.angle) * lookAhead;

    // Boundary check
    if (checkX < 100 || checkX > WORLD_WIDTH - 100 || checkY < 100 || checkY > WORLD_HEIGHT - 100) {
        snake.angle += 0.2; // Turn away
    }

    // Snake avoidance
    for (const other of this.snakes) {
        if (other.isDead) continue;
        for (let i = 0; i < other.nodes.length; i += 5) {
            const node = other.nodes[i];
            const dx = checkX - node.x;
            const dy = checkY - node.y;
            if (dx * dx + dy * dy < 2500) { // 50px radius
                snake.angle += 0.3; // Obstacle! Turn hard
                break;
            }
        }
    }
  }

  killSnake(snake: Snake) {
    if (snake.isDead) return;
    snake.isDead = true;
    // Turn nodes into food
    snake.nodes.forEach((node, idx) => {
      if (idx % 2 === 0) {
        this.spawnFood(node, 2);
      }
    });
    
    // Respawn after 3 seconds if not player
    if (snake.type === SnakeType.BOT) {
        setTimeout(() => {
            const idx = this.snakes.indexOf(snake);
            if (idx !== -1) {
                this.snakes.splice(idx, 1);
                this.addSnake(`Bot ${Math.floor(Math.random() * 100)}`, SnakeType.BOT, NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)]);
            }
        }, 3000);
    }
  }

  normalizeAngle(angle: number) {
    while (angle <= -Math.PI) angle += Math.PI * 2;
    while (angle > Math.PI) angle -= Math.PI * 2;
    return angle;
  }
}
