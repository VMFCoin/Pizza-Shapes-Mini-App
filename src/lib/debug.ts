/**
 * Multiplayer Debugging Utility
 *
 * Enable debug mode by running in browser console:
 *   localStorage.setItem('PIZZA_DEBUG', 'true')
 *
 * Disable:
 *   localStorage.removeItem('PIZZA_DEBUG')
 *
 * Filter by category:
 *   localStorage.setItem('PIZZA_DEBUG_FILTER', 'matchmaking,game') // comma-separated
 */

export type DebugCategory =
  | 'matchmaking'  // Queue join, create-match, match detection
  | 'game'         // Game state, turn flow, dice rolls
  | 'realtime'     // Supabase subscriptions, DB updates
  | 'timer'        // Turn timer, timeouts
  | 'bot'          // Bot turns, bot strategy
  | 'settlement'   // Match settlement, payouts
  | 'wallet'       // Wallet connections, transactions
  | 'edge-fn';     // Edge function calls/responses

interface DebugEvent {
  timestamp: number;
  category: DebugCategory;
  label: string;
  data?: any;
  level: 'info' | 'warn' | 'error' | 'success';
}

class MultiplayerDebugger {
  private events: DebugEvent[] = [];
  private maxEvents = 500;
  private enabled = false;
  private filter: Set<DebugCategory> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      // Auto-enable in development mode OR if explicitly enabled
      const isDev = process.env.NODE_ENV === 'development';
      const explicitlyEnabled = localStorage.getItem('PIZZA_DEBUG') === 'true';
      const explicitlyDisabled = localStorage.getItem('PIZZA_DEBUG') === 'false';

      // Enable if: dev mode (unless explicitly disabled) OR explicitly enabled
      this.enabled = explicitlyDisabled ? false : (isDev || explicitlyEnabled);

      const filterStr = localStorage.getItem('PIZZA_DEBUG_FILTER');
      if (filterStr) {
        this.filter = new Set(filterStr.split(',').map(s => s.trim() as DebugCategory));
      } else if (isDev && !explicitlyDisabled) {
        // Default filter in dev mode: focus on game flow
        this.filter = new Set(['game', 'timer', 'bot', 'realtime'] as DebugCategory[]);
      }
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  shouldLog(category: DebugCategory): boolean {
    if (!this.enabled) return false;
    if (!this.filter) return true;
    return this.filter.has(category);
  }

  log(category: DebugCategory, label: string, data?: any, level: 'info' | 'warn' | 'error' | 'success' = 'info') {
    if (!this.shouldLog(category)) return;

    const event: DebugEvent = {
      timestamp: Date.now(),
      category,
      label,
      data,
      level,
    };

    this.events.push(event);
    if (this.events.length > this.maxEvents) {
      this.events.shift();
    }

    const emoji = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : level === 'success' ? '✅' : 'ℹ️';
    const style = level === 'error'
      ? 'color: #ff4444; font-weight: bold'
      : level === 'warn'
      ? 'color: #ff8800; font-weight: bold'
      : level === 'success'
      ? 'color: #44ff44; font-weight: bold'
      : 'color: #4488ff';

    console.log(
      `%c[${category.toUpperCase()}] ${emoji} ${label}`,
      style,
      data !== undefined ? data : ''
    );
  }

  info(category: DebugCategory, label: string, data?: any) {
    this.log(category, label, data, 'info');
  }

  warn(category: DebugCategory, label: string, data?: any) {
    this.log(category, label, data, 'warn');
  }

  error(category: DebugCategory, label: string, data?: any) {
    this.log(category, label, data, 'error');
  }

  success(category: DebugCategory, label: string, data?: any) {
    this.log(category, label, data, 'success');
  }

  // Group related events
  group(category: DebugCategory, label: string) {
    if (!this.shouldLog(category)) return;
    console.group(`[${category.toUpperCase()}] ${label}`);
  }

  groupEnd() {
    if (!this.enabled) return;
    console.groupEnd();
  }

  // Get event history
  getEvents(category?: DebugCategory): DebugEvent[] {
    if (category) {
      return this.events.filter(e => e.category === category);
    }
    return [...this.events];
  }

  // Print event summary
  summary() {
    if (!this.enabled) {
      console.log('Debug mode is disabled. Enable with: localStorage.setItem("PIZZA_DEBUG", "true")');
      return;
    }

    console.group('🍕 Multiplayer Debug Summary');

    const categories = Array.from(new Set(this.events.map(e => e.category)));
    categories.forEach(cat => {
      const catEvents = this.events.filter(e => e.category === cat);
      const errors = catEvents.filter(e => e.level === 'error').length;
      const warnings = catEvents.filter(e => e.level === 'warn').length;
      const successes = catEvents.filter(e => e.level === 'success').length;

      console.log(`${cat}: ${catEvents.length} events (✅${successes} ⚠️${warnings} ❌${errors})`);
    });

    console.groupEnd();
  }

  // Export events as JSON
  export(): string {
    return JSON.stringify(this.events, null, 2);
  }

  // Clear history
  clear() {
    this.events = [];
    console.log('Debug history cleared');
  }

  // Trace a flow (matchmaking → game → settlement)
  traceMatchmaking(matchId?: string) {
    console.group('🔍 Matchmaking Trace' + (matchId ? ` (${matchId})` : ''));
    const relevant = this.events.filter(e =>
      e.category === 'matchmaking' ||
      (matchId && e.data?.matchId === matchId)
    );
    relevant.forEach(e => {
      const emoji = e.level === 'error' ? '❌' : e.level === 'warn' ? '⚠️' : e.level === 'success' ? '✅' : 'ℹ️';
      console.log(`${emoji} [${new Date(e.timestamp).toISOString()}] ${e.label}`, e.data);
    });
    console.groupEnd();
  }

  traceGame(matchId: string) {
    console.group(`🎮 Game Trace (${matchId})`);
    const relevant = this.events.filter(e =>
      ['game', 'realtime', 'timer', 'bot'].includes(e.category) &&
      (e.data?.matchId === matchId || !e.data?.matchId)
    );
    relevant.forEach(e => {
      const emoji = e.level === 'error' ? '❌' : e.level === 'warn' ? '⚠️' : e.level === 'success' ? '✅' : 'ℹ️';
      console.log(`${emoji} [${new Date(e.timestamp).toISOString()}] [${e.category}] ${e.label}`, e.data);
    });
    console.groupEnd();
  }

  // Analyze stuck states
  analyzeStuckState() {
    console.group('🔧 Analyzing Stuck State');

    const recentEvents = this.events.slice(-50);

    // Check for repeated errors
    const errorPatterns = new Map<string, number>();
    recentEvents.filter(e => e.level === 'error').forEach(e => {
      errorPatterns.set(e.label, (errorPatterns.get(e.label) || 0) + 1);
    });

    if (errorPatterns.size > 0) {
      console.warn('Repeated errors:');
      errorPatterns.forEach((count, label) => {
        console.log(`  - ${label}: ${count}x`);
      });
    }

    // Check for timer issues
    const timerEvents = recentEvents.filter(e => e.category === 'timer');
    if (timerEvents.length > 0) {
      console.log('Recent timer events:', timerEvents.map(e => e.label));
    }

    // Check for realtime disconnects
    const realtimeEvents = recentEvents.filter(e => e.category === 'realtime');
    const disconnects = realtimeEvents.filter(e => e.label.includes('disconnect') || e.label.includes('closed'));
    if (disconnects.length > 0) {
      console.warn('Realtime disconnects detected:', disconnects.length);
    }

    console.groupEnd();
  }
}

// Global singleton
export const mpDebugger = new MultiplayerDebugger();

// Expose to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).pizzaDebug = mpDebugger;

  if (mpDebugger.isEnabled()) {
    console.log(`
🍕 Pizza Dots Multiplayer Debugger ENABLED

Available commands in console:
  pizzaDebug.summary()                  - Show event summary
  pizzaDebug.traceMatchmaking()         - Trace matchmaking flow
  pizzaDebug.traceGame('matchId')       - Trace game flow
  pizzaDebug.analyzeStuckState()        - Analyze stuck/frozen states
  pizzaDebug.export()                   - Export events as JSON
  pizzaDebug.clear()                    - Clear event history

Disable debug mode:
  localStorage.removeItem('PIZZA_DEBUG')
    `);
  }
}
