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

## Testing & Quality Assurance

**Agent Testing System:**

This project includes an automated testing system using Agent architecture with Playwright:

```bash
# Run all agent tests
npm run test:agents

# Run quick tests (game initialization)
npm run test:quick

# Run Playwright tests only
npm run test

# Run tests in headed mode (for debugging)
npm run test:headed
```

**Agent Architecture:**

- **Test Coordinator** (`agents/test-coordinator.js`) - Main orchestration script
- **Tester Agent** (`agents/tester-agent.md`) - Executes Playwright automated tests
- **Error Analyst Agent** (`agents/error-analyst-agent.md`) - Analyzes test failures and provides fix suggestions

**Test Suites:**

- `agents/tests/basic-test.spec.js` - Game initialization, road selection, validation
- `agents/tests/plant-display-test.spec.js` - Plant image/name display verification
- `agents/tests/example.spec.js` - BP flow and state persistence tests

**Test Reports:**

- Test reports saved to `agents/test-reports/TEST-xxx.json`
- Error analysis saved to `agents/error-reports/ERROR-xxx.md`
- Screenshots saved to `agents/screenshots/`

**Quick Start with Agents:**

1. Start dev server: `npm run dev`
2. Run tests: `npm run test:quick`
3. Review reports in `agents/` directory
4. Fix issues and re-run tests

For detailed usage, see `agents/README.md` and `agents/QUICKSTART.md`

## Development Guidelines

**Code-Documentation Sync:**

- **MANDATORY**: When modifying code, update this documentation (CLAUDE.md) simultaneously
- Examples of documentation updates:
  - Adding new features → Document functionality in appropriate sections
  - Modifying components → Update "Key Files & Responsibilities"
  - Changing rules → Update "Rules Implementation"
  - Adding data formats → Update "Customization Points"
- Keep documentation and code in sync to ensure maintainability

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

- `src/data/plants.js` - Built-in plant data structure (currently placeholder images)
- `src/data/customPlants.js` - Custom plant management using IndexedDB storage
  - Supports adding/editing/deleting custom plants
  - Images stored as Blob objects in IndexedDB
  - Provides memory cache for synchronous access (`getAllPlantsSync()`)
  - Export/Import functionality (JSON with Base64 images)
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
- `src/components/PlantManager/` - Custom plant management module
  - `index.vue` - Main plant management interface
  - `PlantForm.vue` - Add/edit plant form
  - `ImageUploader.vue` - Image upload with auto-compression
  - `ImportExport.vue` - Export/import plants as JSON
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

**Custom Plants (via UI):**
The application supports importing custom plants through the PlantManager UI:

- **Supported Image Formats**: PNG, JPG/JPEG, WEBP
- **Image Requirements**:
  - Original file size: Maximum 2MB
  - Auto-compression: Images automatically resized to 100×100 pixels
  - Compressed format: JPEG at 70% quality
  - Compressed size limit: Maximum 500KB
- **Storage**: Images stored as Blob objects in IndexedDB
- **Export/Import**: Custom plants can be exported to JSON (images as Base64) and imported across devices

Access custom plant management through the "植物管理" (Plant Management) interface.

**Built-in Plant Data:**
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

**南瓜头特殊规则:**

- **判断方式**: 通过植物 ID 为 `'pumpkin'` 或植物名称为 `'南瓜头'` 来识别
- **效果**: Pick 阶段选择南瓜头不消耗 BP 步骤，允许选手继续选择
- **限制**: 仍受使用次数限制（最多 2 次），需通过 `canPick()` 验证
- **生效范围**: 仅在 Pick 阶段生效，Ban 阶段按原有逻辑处理
- **实现位置**:
  - `src/utils/validators.js:206-220` (isPumpkin 函数 - 支持 ID 和名称判断)
  - `src/store/gameStore.js:149-152` (isPumpkinPlant getter)
  - `src/store/gameStore.js:328` (confirmSelection 函数中的特殊处理)
  - `src/store/gameStore.js:703` (migrateLegacyPumpkinProtection 迁移逻辑)

**自定义南瓜头植物**:
用户可以通过植物管理界面添加自定义植物，如果将植物名称设置为 "南瓜头"，即使植物 ID 不是 `'pumpkin'`，也会触发南瓜头特殊规则。

## Rules Implementation

**Implemented:**
- ✅ Dynamic BP order based on road selection
- ✅ Mutual exclusion in road selection (players can't choose same road)
- ✅ Toggle road selection (click to deselect)
- ✅ **Same-round duplicate picks** - 选手可以在同一小分中选择同一植物多次（最多2次），但对手已选的植物不可选
  - 实现位置：`src/store/gameStore.js:89-128` (availablePlants getter)
  - 验证逻辑：`src/utils/validators.js:142-187` (canPick 函数)
  - UI显示：植物卡片和阵容区域会显示总使用次数（历史+当前小分）
- ✅ Usage limit tracking (max 2 times per plant per player, **including same-round picks**)
- ✅ Cannot pick opponent's already-selected plants
- ✅ Global bans (5 plants per match)
- ✅ Score tracking (first to 4 wins)
- ✅ Loser picks road for next round
- ✅ First-round special case: if loser chose road initially, no re-selection needed
- ✅ Custom plant management (add, edit, delete, export, import)
- ✅ IndexedDB storage for custom plants with memory cache
- ✅ 南瓜头特殊规则（Pick 阶段选择南瓜头不消耗 BP 步骤）

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
