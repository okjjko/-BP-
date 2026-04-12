/**
 * 植物数据
 * 类型分类：副C、大C、辅助、前排
 */

export const PLANTS = [
  // ========== 副C (18个) ==========
  {
    id: 'scaredyshroom',
    name: '胆小菇',
    image: '/plants/胆.png',
    description: '射程远，但僵尸靠近时会躲藏',
    type: '副C'
  },
  {
    id: 'split_pea_reverse',
    name: '反向双发射手',
    image: '/plants/反.png',
    description: '向后和前方同时发射豌豆',
    type: '副C'
  },
  {
    id: 'sea_shroom',
    name: '海蘑菇',
    image: '/plants/海.png',
    description: '可以在水上种植',
    type: '副C'
  },
  {
    id: 'snow_pea',
    name: '寒冰射手',
    image: '/plants/寒.png',
    description: '发射冰豌豆，减速僵尸',
    type: '副C'
  },
  {
    id: 'cabbage_pult',
    name: '卷心菜投手',
    image: '/plants/卷.png',
    description: '投掷卷心菜攻击僵尸',
    type: '副C'
  },
  {
    id: 'split_pea',
    name: '裂荚射手',
    image: '/plants/裂.png',
    description: '向前和向后同时发射',
    type: '副C'
  },
  {
    id: 'cattail',
    name: '香蒲',
    image: '/plants/猫.png',
    description: '追踪攻击任意僵尸',
    type: '副C'
  },
  {
    id: 'milk_chestnut',
    name: '奶山竹',
    image: '/plants/奶.png',
    description: '防御型植物',
    type: '副C'
  },
  {
    id: 'flying_blue',
    name: '蓝飘飘',
    image: '/plants/飘.png',
    description: '漂浮类植物',
    type: '副C'
  },
  {
    id: 'diamond_shroom',
    name: '晶钻菇',
    image: '/plants/若.png',
    description: '钻石蘑菇类攻击植物',
    type: '副C'
  },
  {
    id: 'threepeater',
    name: '三线射手',
    image: '/plants/三.png',
    description: '同时向上、中、下三行发射豌豆',
    type: '副C'
  },
  {
    id: 'repeater',
    name: '双发射手',
    image: '/plants/双.png',
    description: '一次发射两颗豌豆',
    type: '副C'
  },
  {
    id: 'puffshroom',
    name: '小喷菇',
    image: '/plants/小.png',
    description: '免费植物，射程短',
    type: '副C'
  },
  {
    id: 'starfruit',
    name: '杨桃',
    image: '/plants/星.png',
    description: '向五个方向发射水果',
    type: '副C'
  },
  {
    id: 'squash',
    name: '窝瓜',
    image: '/plants/窝.png',
    description: '压扁附近的僵尸',
    type: '副C'
  },
  {
    id: 'seaweed',
    name: '缠绕水草',
    image: '/plants/缠.png',
    description: '束缚水中的僵尸',
    type: '副C'
  },
  {
    id: 'ghost_shroom',
    name: '幽冥菇',
    image: '/plants/幽.png',
    description: '幽灵类蘑菇植物',
    type: '副C'
  },
  {
    id: 'hypnoshroom',
    name: '魅惑菇',
    image: '/plants/魅.png',
    description: '让僵尸倒戈',
    type: '副C'
  },

  // ========== 大C (5个) ==========
  {
    id: 'fumeshroom',
    name: '大喷菇',
    image: '/plants/喷.png',
    description: '穿透僵尸，造成群体伤害',
    type: '大C'
  },
  {
    id: 'gloom_shroom',
    name: '忧郁蘑菇',
    image: '/plants/曾.png',
    description: '范围伤害蘑菇，既是前排也是大C',
    type: '大C/前排'
  },
  {
    id: 'sunshroom',
    name: '阳光菇',
    image: '/plants/阳.png',
    description: '免费植物，生产阳光',
    type: '大C'
  },
  {
    id: 'potato_mine',
    name: '土豆雷',
    image: '/plants/雷.png',
    description: '需要时间准备，准备后炸毁踩踏的僵尸',
    type: '大C'
  },
  {
    id: 'machine_gun_pea',
    name: '机枪射手',
    image: '/plants/机.png',
    description: '高速发射豌豆的强力射手',
    type: '大C'
  },

  // ========== 辅助 (14个) ==========
  {
    id: 'clover',
    name: '三叶草',
    image: '/plants/叶.png',
    description: '清除空中的僵尸',
    type: '辅助'
  },
  {
    id: 'gold_magnet',
    name: '吸金磁',
    image: '/plants/吸.png',
    description: '吸取金币和钻石',
    type: '辅助'
  },
  {
    id: 'umbrella_leaf',
    name: '叶子保护伞',
    image: '/plants/伞.png',
    description: '保护周围植物不被投掷物攻击',
    type: '辅助'
  },
  {
    id: 'spring_vine',
    name: '春分藤',
    image: '/plants/藤.png',
    description: '季节性藤蔓植物',
    type: '辅助'
  },
  {
    id: 'time_reverse',
    name: '逆时草',
    image: '/plants/逆.png',
    description: '逆转时间效果',
    type: '辅助'
  },
  {
    id: 'winter_melon',
    name: '冰瓜投手',
    image: '/plants/冰.png',
    description: '减速+高额伤害',
    type: '辅助'
  },
  {
    id: 'ice_shroom',
    name: '寒冰菇',
    image: '/plants/川.png',
    description: '冻结周围僵尸',
    type: '辅助'
  },
  {
    id: 'magnetshroom',
    name: '磁力菇',
    image: '/plants/磁.png',
    description: '吸走僵尸的金属物品',
    type: '辅助'
  },
  {
    id: 'plantern',
    name: '路灯花',
    image: '/plants/灯.png',
    description: '照亮迷雾',
    type: '辅助'
  },
  {
    id: 'marigold',
    name: '金盏花',
    image: '/plants/花.png',
    description: '生产金币',
    type: '辅助'
  },
  {
    id: 'gatling_pea',
    name: '狙击豌豆',
    image: '/plants/狙.png',
    description: '远程精确打击',
    type: '辅助'
  },
  {
    id: 'barley',
    name: '大麦',
    image: '/plants/麦.png',
    description: '生产类植物',
    type: '辅助'
  },
  {
    id: 'torchwood',
    name: '火炬树桩',
    image: '/plants/火.png',
    description: '将豌豆火焰化，增加伤害',
    type: '辅助'
  },
  {
    id: 'melon_pult',
    name: '西瓜投手',
    image: '/plants/瓜.png',
    description: '投掷西瓜，造成高额伤害',
    type: '辅助'
  },

  // ========== 前排 (9个) ==========
  {
    id: 'cherry_bomb_nut',
    name: '爆炸坚果',
    image: '/plants/爆.png',
    description: '爆炸坚果，瞬间造成伤害',
    type: '前排'
  },
  {
    id: 'spikerock',
    name: '地刺王',
    image: '/plants/刺.png',
    description: '强化版地刺，更耐久，扎破轮胎',
    type: '前排'
  },
  {
    id: 'tallnut',
    name: '高坚果',
    image: '/plants/高.png',
    description: '比坚果墙更耐打',
    type: '前排'
  },
  {
    id: 'wallnut',
    name: '坚果墙',
    image: '/plants/坚.png',
    description: '阻挡僵尸前进，有较高的生命值',
    type: '前排'
  },
  {
    id: 'pumpkin',
    name: '南瓜头',
    description: '保护套在里面的植物，Pick阶段选择不消耗BP步骤',
    image: '/plants/南.png',
    type: '前排'
  },
  {
    id: 'garlic',
    name: '大蒜',
    image: '/plants/蒜.png',
    description: '让僵尸换行',
    type: '前排'
  },
  {
    id: 'cactus',
    name: '仙人掌',
    image: '/plants/仙.png',
    description: '攻击气球僵尸',
    type: '前排'
  },
  {
    id: 'kernel_pult',
    name: '玉米投手',
    image: '/plants/玉.png',
    description: '投掷玉米和黄油',
    type: '前排'
  },
  {
    id: 'chomper',
    name: '大嘴花',
    image: '/plants/嘴.png',
    description: '能吞噬一个僵尸，但需要时间咀嚼',
    type: '前排'
  }
]

/**
 * 根据ID获取植物
 */
export const getPlantById = (id) => {
  return PLANTS.find(plant => plant.id === id)
}

/**
 * 根据类型获取植物列表
 */
export const getPlantsByType = (type) => {
  return PLANTS.filter(plant => plant.type === type)
}
