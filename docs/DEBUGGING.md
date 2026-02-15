# Multiplayer Debugging Guide

This guide explains how to use the built-in debugging tools to diagnose multiplayer issues.

## Quick Start

### Enable Debug Mode

Open your browser console and run:

```javascript
localStorage.setItem('PIZZA_DEBUG', 'true')
```

Then refresh the page. You'll see colorful debug output in the console.

### Disable Debug Mode

```javascript
localStorage.removeItem('PIZZA_DEBUG')
```

## Using the Debug Console

When debug mode is enabled, a global `pizzaDebug` object is available in the browser console with helpful commands:

### View Debug Summary

```javascript
pizzaDebug.summary()
```

Shows a breakdown of all events by category with error/warning/success counts.

### Trace Matchmaking Flow

```javascript
// View all matchmaking events
pizzaDebug.traceMatchmaking()

// View matchmaking for a specific match
pizzaDebug.traceMatchmaking('match_abc123')
```

### Trace Game Flow

```javascript
pizzaDebug.traceGame('match_abc123')
```

Shows all game events (turn flow, dice rolls, timer events, bot turns) for a specific match.

### Analyze Stuck States

```javascript
pizzaDebug.analyzeStuckState()
```

Detects common issues:
- Repeated errors
- Realtime disconnects
- Timer problems

### Export Debug Data

```javascript
pizzaDebug.export()
```

Returns JSON string of all events. Copy this to share with developers or save for later analysis.

### Clear History

```javascript
pizzaDebug.clear()
```

Clears all recorded events.

## Filtering by Category

If debug output is too noisy, filter to specific categories:

```javascript
localStorage.setItem('PIZZA_DEBUG_FILTER', 'matchmaking,game')
```

Available categories:
- `matchmaking` - Queue join, create-match, match detection
- `game` - Game state, turn flow, dice rolls, edge drawing
- `realtime` - Supabase subscriptions, DB updates
- `timer` - Turn timer, timeouts, force-end-turn
- `bot` - Bot turns, bot strategy
- `settlement` - Match settlement, payouts
- `wallet` - Wallet connections, transactions
- `edge-fn` - Edge function calls/responses

Example: only show game and timer events:

```javascript
localStorage.setItem('PIZZA_DEBUG_FILTER', 'game,timer')
```

Remove filter:

```javascript
localStorage.removeItem('PIZZA_DEBUG_FILTER')
```

## Understanding Debug Output

Debug messages use color coding:

- 🔵 **Blue (INFO)**: Normal flow events
- ⚠️ **Orange (WARN)**: Potential issues (e.g., version conflicts, retries)
- ❌ **Red (ERROR)**: Actual errors
- ✅ **Green (SUCCESS)**: Successful operations

Each message shows:
```
[CATEGORY] 🔵 Label: detailed message { data }
```

## Common Debugging Scenarios

### Matchmaking Not Starting

1. Enable debug mode
2. Join a queue
3. Run `pizzaDebug.traceMatchmaking()`
4. Look for:
   - Did `joinQueue` succeed?
   - Are queue players being fetched?
   - Is `create-match` being called?
   - Any errors in the server response?

### Game Stuck on Someone's Turn

1. Enable debug mode with game + timer categories:
   ```javascript
   localStorage.setItem('PIZZA_DEBUG_FILTER', 'game,timer')
   ```
2. Wait for the stuck state
3. Run `pizzaDebug.analyzeStuckState()`
4. Check:
   - Is the timer running?
   - Any realtime disconnects?
   - Did `endTurn` get called?

### Bot Not Taking Turn

1. Enable debug mode with bot category:
   ```javascript
   localStorage.setItem('PIZZA_DEBUG_FILTER', 'bot,game')
   ```
2. Wait for bot's turn
3. Check console for:
   - `botEffect: Bot is current player` - should appear
   - `botEffect: Calling trigger-bot-turn` - should trigger
   - `botEffect: trigger-bot-turn result` - check for errors

### Realtime Not Updating

1. Enable debug mode with realtime category:
   ```javascript
   localStorage.setItem('PIZZA_DEBUG_FILTER', 'realtime')
   ```
2. Look for:
   - Subscription status (should be `SUBSCRIBED`)
   - Incoming realtime events
   - Any disconnect/reconnect events

## Debug Event Structure

Events are stored with this structure:

```typescript
{
  timestamp: 1234567890,
  category: 'game',
  label: 'rollDice: Response',
  data: { diceRoll: 3, movesRemaining: 3 },
  level: 'info' | 'warn' | 'error' | 'success'
}
```

## Tips

1. **Enable before reproducing the bug** - Debug events are only captured while debug mode is active
2. **Use filters** - Reduces noise for specific issues
3. **Export before closing tab** - Debug history is lost on page refresh
4. **Share exports** - Include exported JSON when reporting bugs
5. **Check timing** - Timestamps help identify slow operations

## Example Session

```javascript
// Enable debugging
localStorage.setItem('PIZZA_DEBUG', 'true')

// Refresh page and reproduce the issue
// ...

// View summary
pizzaDebug.summary()

// Analyze the problem
pizzaDebug.analyzeStuckState()

// Export for reporting
const debugData = pizzaDebug.export()
console.log(debugData) // Copy this
```
