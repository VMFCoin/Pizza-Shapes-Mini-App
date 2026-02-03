/**
 * Pizza Dots - Phaser Game Scene
 *
 * WebGL-powered game board for smooth animations and effects.
 * Can be used as an alternative to the SVG-based SquareGrid component.
 */

import Phaser from 'phaser';

interface Node {
  id: string;
  x: number;
  y: number;
}

interface Edge {
  id: string;
  nodeA: string;
  nodeB: string;
  claimed: boolean;
  claimedBy: string | null;
}

interface Triangle {
  id: string;
  nodes: [string, string, string];
  captured: boolean;
  capturedBy: string | null;
}

interface GameConfig {
  gridSize: number;
  cellSize: number;
  padding: number;
  playerColors: Record<string, number>;
}

export class PizzaBoardScene extends Phaser.Scene {
  private nodes: Map<string, Node> = new Map();
  private edges: Map<string, Edge> = new Map();
  private triangles: Map<string, Triangle> = new Map();
  private config: GameConfig;

  private nodeSprites: Map<string, Phaser.GameObjects.Arc> = new Map();
  private edgeLines: Map<string, Phaser.GameObjects.Line> = new Map();
  private triangleGraphics: Map<string, Phaser.GameObjects.Graphics> = new Map();

  private selectedNode: string | null = null;
  private currentPlayerId: string = '';

  private onEdgeClick: ((edgeId: string) => void) | null = null;

  constructor() {
    super({ key: 'PizzaBoardScene' });
    this.config = {
      gridSize: 4,
      cellSize: 60,
      padding: 40,
      playerColors: {},
    };
  }

  init(data: {
    gridSize: number;
    cellSize: number;
    padding: number;
    playerColors: Record<string, number>;
    onEdgeClick: (edgeId: string) => void;
  }) {
    this.config = {
      gridSize: data.gridSize,
      cellSize: data.cellSize,
      padding: data.padding,
      playerColors: data.playerColors,
    };
    this.onEdgeClick = data.onEdgeClick;
  }

  create() {
    // Set background
    this.cameras.main.setBackgroundColor(0x1a1a2e);

    // Create grid
    this.createGrid();

    // Add input handling
    this.input.on('gameobjectdown', this.handleNodeClick, this);
  }

  createGrid() {
    const { gridSize, cellSize, padding } = this.config;

    // Create nodes
    for (let y = 0; y <= gridSize; y++) {
      for (let x = 0; x <= gridSize; x++) {
        const nodeId = `node_${x}_${y}`;
        const posX = padding + x * cellSize;
        const posY = padding + y * cellSize;

        this.nodes.set(nodeId, { id: nodeId, x: posX, y: posY });

        // Create node sprite
        const circle = this.add.circle(posX, posY, 8, 0xffffff);
        circle.setStrokeStyle(2, 0x333333);
        circle.setInteractive({ useHandCursor: true });
        circle.setData('nodeId', nodeId);

        this.nodeSprites.set(nodeId, circle);
      }
    }

    // Create edges (horizontal, vertical, diagonal)
    this.createEdges();
  }

  createEdges() {
    const { gridSize, cellSize, padding } = this.config;

    for (let y = 0; y <= gridSize; y++) {
      for (let x = 0; x <= gridSize; x++) {
        const nodeA = `node_${x}_${y}`;
        const posA = this.nodes.get(nodeA)!;

        // Horizontal edge
        if (x < gridSize) {
          const nodeB = `node_${x + 1}_${y}`;
          this.addEdge(nodeA, nodeB);
        }

        // Vertical edge
        if (y < gridSize) {
          const nodeB = `node_${x}_${y + 1}`;
          this.addEdge(nodeA, nodeB);
        }

        // Diagonal edges
        if (x < gridSize && y < gridSize) {
          // Down-right diagonal
          const nodeB = `node_${x + 1}_${y + 1}`;
          this.addEdge(nodeA, nodeB);

          // Down-left diagonal
          if (x > 0) {
            const nodeC = `node_${x - 1}_${y + 1}`;
            // Only add if not already exists
            const edgeId = this.getEdgeId(nodeA, nodeC);
            if (!this.edges.has(edgeId)) {
              this.addEdge(nodeA, nodeC);
            }
          }
        }
      }
    }
  }

  addEdge(nodeA: string, nodeB: string) {
    const edgeId = this.getEdgeId(nodeA, nodeB);
    const posA = this.nodes.get(nodeA)!;
    const posB = this.nodes.get(nodeB)!;

    this.edges.set(edgeId, {
      id: edgeId,
      nodeA,
      nodeB,
      claimed: false,
      claimedBy: null,
    });

    // Create line (initially hidden/faint)
    const line = this.add.line(0, 0, posA.x, posA.y, posB.x, posB.y, 0x444444);
    line.setLineWidth(1);
    line.setAlpha(0.3);
    line.setOrigin(0, 0);

    this.edgeLines.set(edgeId, line);
  }

  getEdgeId(nodeA: string, nodeB: string): string {
    const sorted = [nodeA, nodeB].sort();
    return `edge_${sorted[0]}_${sorted[1]}`;
  }

  handleNodeClick(
    pointer: Phaser.Input.Pointer,
    gameObject: Phaser.GameObjects.GameObject
  ) {
    const nodeId = gameObject.getData('nodeId') as string;
    if (!nodeId) return;

    if (this.selectedNode === null) {
      // First node selected
      this.selectedNode = nodeId;
      this.highlightNode(nodeId, true);
    } else if (this.selectedNode === nodeId) {
      // Same node - deselect
      this.highlightNode(nodeId, false);
      this.selectedNode = null;
    } else {
      // Try to draw edge
      const edgeId = this.getEdgeId(this.selectedNode, nodeId);
      const edge = this.edges.get(edgeId);

      if (edge && !edge.claimed && this.onEdgeClick) {
        this.onEdgeClick(edgeId);
      }

      // Reset selection
      this.highlightNode(this.selectedNode, false);
      this.selectedNode = null;
    }
  }

  highlightNode(nodeId: string, highlight: boolean) {
    const sprite = this.nodeSprites.get(nodeId);
    if (!sprite) return;

    if (highlight) {
      sprite.setFillStyle(this.config.playerColors[this.currentPlayerId] || 0xff6b35);
      sprite.setRadius(10);

      // Add pulse animation
      this.tweens.add({
        targets: sprite,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 300,
        yoyo: true,
        repeat: -1,
      });
    } else {
      sprite.setFillStyle(0xffffff);
      sprite.setRadius(8);
      this.tweens.killTweensOf(sprite);
      sprite.setScale(1);
    }
  }

  /**
   * Draw an edge between two nodes
   */
  drawEdge(nodeA: string, nodeB: string, playerId: string) {
    const edgeId = this.getEdgeId(nodeA, nodeB);
    const edge = this.edges.get(edgeId);
    const line = this.edgeLines.get(edgeId);

    if (!edge || !line) return;

    edge.claimed = true;
    edge.claimedBy = playerId;

    const color = this.config.playerColors[playerId] || 0xffb703;

    // Animate the edge being drawn
    this.tweens.add({
      targets: line,
      alpha: 1,
      duration: 200,
      onStart: () => {
        line.setStrokeStyle(6, color);
      },
    });
  }

  /**
   * Capture a pizza slice (triangle)
   */
  captureSlice(triangleId: string, playerId: string) {
    const triangle = this.triangles.get(triangleId);
    if (!triangle) return;

    triangle.captured = true;
    triangle.capturedBy = playerId;

    const nodes = triangle.nodes.map(id => this.nodes.get(id)!);
    const centerX = (nodes[0].x + nodes[1].x + nodes[2].x) / 3;
    const centerY = (nodes[0].y + nodes[1].y + nodes[2].y) / 3;

    const color = this.config.playerColors[playerId] || 0xff6b35;

    // Create triangle fill
    const graphics = this.add.graphics();
    graphics.fillStyle(color, 0.3);
    graphics.beginPath();
    graphics.moveTo(nodes[0].x, nodes[0].y);
    graphics.lineTo(nodes[1].x, nodes[1].y);
    graphics.lineTo(nodes[2].x, nodes[2].y);
    graphics.closePath();
    graphics.fill();

    this.triangleGraphics.set(triangleId, graphics);

    // Add pizza emoji at center
    const pizzaEmoji = this.add.text(centerX, centerY, '🍕', {
      fontSize: '24px',
    });
    pizzaEmoji.setOrigin(0.5, 0.5);
    pizzaEmoji.setScale(0);

    // Animate capture
    this.tweens.add({
      targets: pizzaEmoji,
      scale: 1,
      rotation: Math.PI * 2,
      duration: 500,
      ease: 'Back.out',
    });

    // Particle burst
    this.createCaptureParticles(centerX, centerY, color);
  }

  createCaptureParticles(x: number, y: number, color: number) {
    const particles = this.add.particles(x, y, undefined, {
      speed: { min: 50, max: 150 },
      scale: { start: 0.4, end: 0 },
      lifespan: 800,
      quantity: 10,
      tint: color,
    });

    // Auto-destroy particles
    this.time.delayedCall(1000, () => {
      particles.destroy();
    });
  }

  /**
   * Set current player (for highlighting)
   */
  setCurrentPlayer(playerId: string) {
    this.currentPlayerId = playerId;
  }

  /**
   * Update player colors
   */
  setPlayerColors(colors: Record<string, number>) {
    this.config.playerColors = colors;
  }

  /**
   * Reset the board for a new game
   */
  resetBoard() {
    // Clear triangles
    this.triangleGraphics.forEach(g => g.destroy());
    this.triangleGraphics.clear();

    // Reset edges
    this.edges.forEach((edge, id) => {
      edge.claimed = false;
      edge.claimedBy = null;

      const line = this.edgeLines.get(id);
      if (line) {
        line.setStrokeStyle(1, 0x444444);
        line.setAlpha(0.3);
      }
    });

    // Reset triangles
    this.triangles.forEach(t => {
      t.captured = false;
      t.capturedBy = null;
    });

    this.selectedNode = null;
  }
}

/**
 * Create Phaser game instance
 */
export function createPhaserGame(
  parent: HTMLElement,
  config: {
    gridSize: number;
    cellSize: number;
    padding: number;
    playerColors: Record<string, number>;
    onEdgeClick: (edgeId: string) => void;
  }
): Phaser.Game {
  const width = config.gridSize * config.cellSize + config.padding * 2;
  const height = config.gridSize * config.cellSize + config.padding * 2;

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    width,
    height,
    parent,
    backgroundColor: '#1a1a2e',
    scene: PizzaBoardScene,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
  });

  // Pass config to scene
  game.scene.start('PizzaBoardScene', config);

  return game;
}
