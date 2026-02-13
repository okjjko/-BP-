/**
 * 植物数据占位符
 * 用户可以自行替换为实际的植物图片和描述
 */

export const PLANTS = [
  {
    id: 'peashooter',
    name: '豌豆射手',
    image: 'https://placehold.co/100x100/4CAF50/white?text=豌豆',
    description: '向前方发射豌豆，是基础攻击植物',
    type: 'shooter'
  },
  {
    id: 'sunflower',
    name: '向日葵',
    image: 'https://placehold.co/100x100/FFD700/white?text=向日葵',
    description: '生产阳光，是经济基础',
    type: 'producer'
  },
  {
    id: 'wallnut',
    name: '坚果墙',
    image: 'https://placehold.co/100x100/8B4513/white?text=坚果',
    description: '阻挡僵尸前进，有较高的生命值',
    type: 'defense'
  },
  {
    id: 'cherry_bomb',
    name: '樱桃炸弹',
    image: 'https://placehold.co/100x100/DC143C/white?text=樱桃',
    description: '瞬间炸毁周围僵尸',
    type: 'instant'
  },
  {
    id: 'potato_mine',
    name: '土豆雷',
    image: 'https://placehold.co/100x100/DEB887/white?text=土豆',
    description: '需要时间准备，准备后炸毁踩踏的僵尸',
    type: 'instant'
  },
  {
    id: 'snow_pea',
    name: '寒冰射手',
    image: 'https://placehold.co/100x100/00CED1/white?text=寒冰',
    description: '发射冰豌豆，减速僵尸',
    type: 'shooter'
  },
  {
    id: 'chomper',
    name: '大嘴花',
    image: 'https://placehold.co/100x100/9370DB/white?text=大嘴',
    description: '能吞噬一个僵尸，但需要时间咀嚼',
    type: 'melee'
  },
  {
    id: 'repeater',
    name: '双发射手',
    image: 'https://placehold.co/100x100/32CD32/white?text=双发',
    description: '一次发射两颗豌豆',
    type: 'shooter'
  },
  {
    id: 'puffshroom',
    name: '小喷菇',
    image: 'https://placehold.co/100x100/9370DB/white?text=小喷',
    description: '免费植物，射程短',
    type: 'shooter'
  },
  {
    id: 'sunshroom',
    name: '阳光菇',
    image: 'https://placehold.co/100x100/9370DB/white?text=阳光',
    description: '免费植物，生产阳光',
    type: 'producer'
  },
  {
    id: 'fumeshroom',
    name: '大喷菇',
    image: 'https://placehold.co/100x100/9370DB/white?text=大喷',
    description: '穿透僵尸，造成群体伤害',
    type: 'shooter'
  },
  {
    id: 'scaredyshroom',
    name: '胆小菇',
    image: 'https://placehold.co/100x100/9370DB/white?text=胆小',
    description: '射程远，但僵尸靠近时会躲藏',
    type: 'shooter'
  },
  {
    id: 'squash',
    name: '窝瓜',
    image: 'https://placehold.co/100x100/556B2F/white?text=窝瓜',
    description: '压扁附近的僵尸',
    type: 'instant'
  },
  {
    id: 'threepeater',
    name: '三线射手',
    image: 'https://placehold.co/100x100/32CD32/white?text=三线',
    description: '同时向上、中、下三行发射豌豆',
    type: 'shooter'
  },
  {
    id: 'jalapeno',
    name: '火爆辣椒',
    image: 'https://placehold.co/100x100/FF4500/white?text=辣椒',
    description: '消灭整行的僵尸',
    type: 'instant'
  },
  {
    id: 'tallnut',
    name: '高坚果',
    image: 'https://placehold.co/100x100/8B4513/white?text=高坚',
    description: '比坚果墙更耐打',
    type: 'defense'
  },
  {
    id: 'pumpkin',
    name: '南瓜头',
    image: 'https://placehold.co/100x100/FF8C00/white?text=南瓜',
    description: '保护套在里面的植物',
    type: 'defense'
  },
  {
    id: 'flower_pot',
    name: '花盆',
    image: 'https://placehold.co/100x100/CD853F/white?text=花盆',
    description: '可以在屋顶种植植物',
    type: 'support'
  },
  {
    id: 'coffee_bean',
    name: '咖啡豆',
    image: 'https://placehold.co/100x100/8B4513/white?text=咖啡',
    description: '唤醒蘑菇类植物',
    type: 'support'
  },
  {
    id: 'garlic',
    name: '大蒜',
    image: 'https://placehold.co/100x100/F0E68C/white?text=大蒜',
    description: '让僵尸换行',
    type: 'defense'
  },
  {
    id: 'umbrella_leaf',
    name: '叶子保护伞',
    image: 'https://placehold.co/100x100/228B22/white?text=叶子',
    description: '保护周围植物不被投掷物攻击',
    type: 'defense'
  },
  {
    id: 'marigold',
    name: '金盏花',
    image: 'https://placehold.co/100x100/FFD700/white?text=金盏',
    description: '生产金币',
    type: 'producer'
  },
  {
    id: 'spikeweed',
    name: '地刺',
    image: 'https://placehold.co/100x100/556B2F/white?text=地刺',
    description: '扎破轮胎，伤害踩踏的僵尸',
    type: 'defense'
  },
  {
    id: 'spikerock',
    name: '地刺王',
    image: 'https://placehold.co/100x100/696969/white?text=地刺王',
    description: '强化版地刺，更耐久',
    type: 'defense'
  },
  {
    id: 'cob_cannon',
    name: '玉米加农炮',
    image: 'https://placehold.co/100x100/FFD700/white?text=加农',
    description: '需要两个玉米炮组合，强力群攻',
    type: 'shooter'
  },
  {
    id: 'kernel_pult',
    name: '玉米投手',
    image: 'https://placehold.co/100x100/FFD700/white?text=玉米',
    description: '投掷玉米和黄油',
    type: 'shooter'
  },
  {
    id: 'melon_pult',
    name: '西瓜投手',
    image: 'https://placehold.co/100x100/228B22/white?text=西瓜',
    description: '投掷西瓜，造成高额伤害',
    type: 'shooter'
  },
  {
    id: 'winter_melon',
    name: '冰瓜投手',
    image: 'https://placehold.co/100x100/00CED1/white?text=冰瓜',
    description: '减速+高额伤害',
    type: 'shooter'
  },
  {
    id: 'split_pea',
    name: '裂荚射手',
    image: 'https://placehold.co/100x100/32CD32/white?text=裂荚',
    description: '向前和向后同时发射',
    type: 'shooter'
  },
  {
    id: 'cattail',
    name: '香蒲',
    image: 'https://placehold.co/100x100/8B4513/white?text=香蒲',
    description: '追踪攻击任意僵尸',
    type: 'shooter'
  },
  {
    id: 'plantern',
    name: '灯笼草',
    image: 'https://placehold.co/100x100/FFD700/white?text=灯笼',
    description: '照亮迷雾',
    type: 'support'
  },
  {
    id: 'magnetshroom',
    name: '磁力菇',
    image: 'https://placehold.co/100x100/9370DB/white?text=磁力',
    description: '吸走僵尸的金属物品',
    type: 'support'
  },
  {
    id: 'hypnoshroom',
    name: '魅惑菇',
    image: 'https://placehold.co/100x100/9370DB/white?text=魅惑',
    description: '让僵尸倒戈',
    type: 'instant'
  },
  {
    id: 'lily_pad',
    name: '睡莲叶',
    image: 'https://placehold.co/100x100/228B22/white?text=睡莲',
    description: '在水上种植植物',
    type: 'support'
  },
  {
    id: 'sea_shroom',
    name: '海蘑菇',
    image: 'https://placehold.co/100x100/9370DB/white?text=海菇',
    description: '可以在水上种植',
    type: 'shooter'
  }
]

/**
 * 根据ID获取植物
 */
export const getPlantById = (id) => {
  return PLANTS.find(plant => plant.id === id)
}

/**
 * 获取植物类型列表
 */
export const getPlantsByType = (type) => {
  return PLANTS.filter(plant => plant.type === type)
}
