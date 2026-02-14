# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

```bash
# Install dependencies (first time only)
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Architecture

This is a **Vue 3 + Pinia** web application for managing a Ban/Pick (BP) battle system for a modified Plants vs. Zombies game. The tool handles complex tournament rules with dynamic player-road assignments.

### Core Data Flow

1. **Game Initialization** (`GameSetup.vue`)
   - Two players input IDs and select initial roads (2路 or 4路)
   - System randomly bans 5 plants globally
   - Road selection determines who is "二路选手" and "四路选手" (NOT fixed to player1/player2!)

2. **Dynamic BP Sequence Generation** (`bpRules.js`)
   - BP sequence uses `road2`/`road4` placeholders (NOT player1/player2)
   - `getBPSequence(road2Player, road4Player)` dynamically converts to actual players
   - This allows the BP order to adapt to whichever player chose which road
   - Total steps: Stage1(4) + Stage2(6) + Stage3(6) + Stage4(4) = 20 actions

3. **State Management** (`gameStore.js`)
   - Central Pinia store managing all game state
   - `currentRound.bpSequence` stores the dynamically generated BP steps
   - `updateCurrentStep()` converts `road2`/`road4` → actual player IDs
   - Auto-saves to localStorage after every action

4. **BP Phases** (4 stages, total 20 steps)
   - **Stage 1**: Ban order: 二路→四路→二路→四路 (4 bans)
   - **Stage 2**: Pick order: 二路→四路→四路→二路→二路→四路 (6 picks)
   - **Stage 3**: Ban order: 四路→二路→四路→二路→四路→二路 (6 bans)
   - **Stage 4**: Pick order: 四路→二路→二路→四路 (4 picks)

5. **Round Flow**
   - BP阶段 → Positioning (站位设置) → Result (小分结算) → Next Round
   - Winner gets 1 point, first to 4 points wins the match
   - Loser selects road for next round (败者选路权)

### Key Files & Responsibilities

**Data Layer:**
- `src/data/plants.js` - Plant data structure (currently placeholder images)
- `src/utils/bpRules.js` - BP order templates and dynamic sequence generation
- `src/utils/validators.js` - Rule validation (ban checks, usage limits, etc.)

**State Management:**
- `src/store/gameStore.js` - Pinia store with getters, actions, and localStorage persistence
  - `road2Player` getter - identifies who chose road 2
  - `road4Player` getter - identifies who chose road 4
  - `initGame()` - initializes new match with both players' road selections
  - `startRound()` - generates dynamic BP sequence for each round
  - `updateCurrentStep()` - translates road2/road4 to actual player IDs

**UI Components:**
- `src/components/GameSetup.vue` - Player registration & road selection (mutual exclusion between players)
- `src/components/PlayerInfo.vue` - Displays player ID, score, and current road
- `src/components/StageIndicator.vue` - Shows current phase/stage/step in BP process
- `src/components/BanArea.vue` - Displays banned plants per player
- `src/components/PickArea.vue` - Displays picked plants per player
- `src/components/PlantSelector.vue` - Grid for selecting plants to ban/pick
- `src/components/PositionSetup.vue` - Road and position configuration (not yet implemented)
- `src/components/RoundResult.vue` - Round winner & next round road selection

### Critical Design Decisions

**Dynamic Player-Road Mapping:**
The most important architectural decision: **二路/四路 are NOT fixed to player1/player2**.

- If player1 chooses road 2 and player2 chooses road 4:
  - `road2Player = 'player1'`, `road4Player = 'player2'`
  - Stage 1 starts with player1 banning (二路 first)

- If player1 chooses road 4 and player2 chooses road 2:
  - `road2Player = 'player2'`, `road4Player = 'player1'`
  - Stage 1 starts with player2 banning (二路 first)

This is implemented via `getBPSequence()` which takes actual player IDs as parameters and substitutes them into the BP templates.

**BP Sequence Storage:**
- `currentRound.bpSequence` is a 2D array: `[[stage1_steps], [stage2_steps], ...]`
- Each step has `{ player: 'road2'|'road4', action: 'ban'|'pick', count: N }`
- `updateCurrentStep()` dynamically resolves road2/road4 to player1/player2 based on `this.player1.road` and `this.player2.road`

## Customization Points

**Plant Data:**
Edit `src/data/plants.js` to replace placeholder images/data:
```javascript
{
  id: 'peashooter',
  name: '豌豆射手',
  image: '/actual/path/to/peashooter.png',  // Replace this
  description: '向前方发射豌豆',
  type: 'shooter'
}
```

**Tailwind Colors:**
Custom colors defined in `tailwind.config.js`:
- `plant-green` - Primary action color
- `ban-red` - Ban action color
- `pick-blue` - Pick action color

## Rules Implementation

**Implemented:**
- ✅ Dynamic BP order based on road selection
- ✅ Mutual exclusion in road selection (players can't choose same road)
- ✅ Toggle road selection (click to deselect)
- ✅ Usage limit tracking (max 2 times per plant per player)
- ✅ Cannot pick opponent's already-selected plants
- ✅ Global bans (5 plants per match)
- ✅ Score tracking (first to 4 wins)
- ✅ Loser picks road for next round
- ✅ First-round special case: if loser chose road initially, no re-selection needed

**Not Yet Implemented:**
- ⚠️ Position validation rules (副C/大C requirements)
- ⚠️ Pumpkin shell rules (南瓜套规则)
- ⚠️ 巅峰对决 mode (3:3 tiebreaker)

## Testing Flows

**Complete Game Flow:**
1. Start dev server: `npm run dev`
2. Enter two player names, select roads (one 2路, one 4路)
3. Verify BP sequence starts with correct player (二路选手 first)
4. Complete all 4 stages (20 total ban/pick actions: 4+6+6+4)
5. Set up positions (placeholder for now)
6. Click "完成小分" to end round
7. Select round winner
8. Verify loser can select road for next round
9. Verify scores update correctly

**Road Selection Edge Cases:**
- Player1 selects 2路, then tries to select 4路 → should toggle
- Player1 has 2路 selected, Player2's 2路 button should be disabled
- Deselecting a road should re-enable it for the other player

## Browser Compatibility

Modern browsers with ES6+ support: Chrome, Firefox, Edge, Safari.

LocalStorage is used for persistence - clearing browser data or clicking "重置游戏" resets everything.
