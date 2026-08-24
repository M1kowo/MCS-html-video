export interface StylePack {
  id: string;
  name: string;
  mood: string[];
  bestFor: string[];
  palette: Array<{ color: string; usage: string }>;
  typography: { heading: string; body: string };
  composition: string[];
  motion: string[];
  transitions: string[];
  antiPatterns: string[];
}

export interface ComponentGuide {
  id: string;
  name: string;
  useWhen: string;
  guidance: string[];
  avoid: string[];
}

/**
 * Optional visual directions, never fixed HTML templates. External AIs may
 * select one, combine several, or ignore all of them and design from scratch.
 */
export const STYLE_PACKS: StylePack[] = [
  {
    id: 'swiss-pulse', name: 'Swiss Pulse', mood: ['clinical', 'precise'], bestFor: ['SaaS', 'data', 'developer tools'],
    palette: [{ color: '#1A1A1A', usage: 'primary ink' }, { color: '#FFFFFF', usage: 'canvas' }, { color: '#0066FF', usage: 'single accent' }],
    typography: { heading: 'Helvetica or Inter Bold', body: 'Helvetica or Inter Regular' },
    composition: ['12-column grid', 'large numeric hierarchy', 'asymmetric information blocks'],
    motion: ['fast precise entrances', 'counter reveals', 'expo.out or power4.out'],
    transitions: ['geometric iris', 'cinematic zoom'],
    antiPatterns: ['decorative floating', 'multiple accent colors', 'generic centered hero'],
  },
  {
    id: 'velvet-standard', name: 'Velvet Standard', mood: ['premium', 'timeless'], bestFor: ['luxury', 'enterprise', 'keynotes'],
    palette: [{ color: '#0B0B0D', usage: 'canvas or ink' }, { color: '#F7F5EF', usage: 'paper or text' }, { color: '#C9A84C', usage: 'restrained accent' }],
    typography: { heading: 'Thin sans-serif, uppercase, wide tracking', body: 'Neutral sans-serif' },
    composition: ['architectural symmetry', 'generous negative space', 'restrained focal objects'],
    motion: ['slow sequential reveals', 'long holds', 'sine.inOut'],
    transitions: ['cross-warp morph', 'soft architectural wipe'],
    antiPatterns: ['frantic motion', 'crowded cards', 'cheap glow effects'],
  },
  {
    id: 'deconstructed', name: 'Deconstructed', mood: ['industrial', 'raw'], bestFor: ['tech launches', 'security', 'punk editorial'],
    palette: [{ color: '#1A1A1A', usage: 'industrial canvas' }, { color: '#F0F0F0', usage: 'raw white type' }, { color: '#D4501E', usage: 'rust accent' }],
    typography: { heading: 'Heavy condensed industrial sans', body: 'Monospace or grotesk' },
    composition: ['angled type', 'controlled overlap', 'elements escaping the grid'],
    motion: ['slam and scramble', 'stepped glitch', 'back.out or elastic.out'],
    transitions: ['glitch', 'whip pan'],
    antiPatterns: ['polished glass cards', 'perfect symmetry', 'soft corporate gradients'],
  },
  {
    id: 'maximalist-type', name: 'Maximalist Type', mood: ['loud', 'kinetic'], bestFor: ['launches', 'announcements', 'hype'],
    palette: [{ color: '#E63946', usage: 'dominant signal' }, { color: '#FFD60A', usage: 'contrast accent' }, { color: '#000000', usage: 'ink' }, { color: '#FFFFFF', usage: 'knockout text' }],
    typography: { heading: 'Extra-bold display grotesk', body: 'Bold compact sans-serif' },
    composition: ['type fills 50–80% of frame', 'scale collisions', 'text over imagery'],
    motion: ['rapid slide and scale', 'hard stops', 'expo.out or back.out'],
    transitions: ['ridged burn', 'typographic smash'],
    antiPatterns: ['empty generic background', 'timid typography', 'uniform card grids'],
  },
  {
    id: 'data-drift', name: 'Data Drift', mood: ['futuristic', 'immersive'], bestFor: ['AI', 'ML', 'speculative technology'],
    palette: [{ color: '#0A0A0A', usage: 'deep field' }, { color: '#7C3AED', usage: 'iridescent signal' }, { color: '#06B6D4', usage: 'data trace' }],
    typography: { heading: 'Thin futuristic sans-serif', body: 'Neutral technical sans-serif' },
    composition: ['micro-to-macro scale shifts', 'data fields', 'sparse floating labels'],
    motion: ['fluid morphs', 'particles coalescing', 'sine.inOut'],
    transitions: ['gravitational lens', 'domain warp'],
    antiPatterns: ['generic blue-purple neon gradient', 'static dashboard cards', 'hard mechanical cuts'],
  },
  {
    id: 'soft-signal', name: 'Soft Signal', mood: ['intimate', 'warm'], bestFor: ['wellness', 'personal stories', 'human-centered brands'],
    palette: [{ color: '#FFF8EC', usage: 'cream canvas' }, { color: '#F5A623', usage: 'warm accent' }, { color: '#C4A3A3', usage: 'dusty rose support' }, { color: '#8FAF8C', usage: 'sage support' }],
    typography: { heading: 'Humanist serif or handwritten display', body: 'Humanist sans-serif' },
    composition: ['close-up framing', 'one emotional object', 'organic whitespace'],
    motion: ['slow drift', 'breathing scale', 'power1.inOut'],
    transitions: ['thermal distortion', 'soft dissolve'],
    antiPatterns: ['corporate dashboards', 'sharp neon', 'hurried snap motion'],
  },
  {
    id: 'folk-frequency', name: 'Folk Frequency', mood: ['cultural', 'vivid'], bestFor: ['consumer apps', 'food', 'communities'],
    palette: [{ color: '#FF1493', usage: 'hot accent' }, { color: '#0047AB', usage: 'cobalt foundation' }, { color: '#FFE000', usage: 'sun highlight' }, { color: '#009B77', usage: 'emerald support' }],
    typography: { heading: 'Bold warm rounded display', body: 'Friendly rounded sans-serif' },
    composition: ['pattern and repetition', 'layered handcrafted density', 'rhythmic borders'],
    motion: ['bounce and pop', 'joyful spin', 'elastic.out'],
    transitions: ['swirl vortex', 'ripple waves'],
    antiPatterns: ['sterile minimalism', 'monochrome corporate palette', 'perfectly identical tiles'],
  },
  {
    id: 'shadow-cut', name: 'Shadow Cut', mood: ['dark', 'cinematic'], bestFor: ['dramatic reveals', 'security', 'investigative stories'],
    palette: [{ color: '#0A0A0A', usage: 'deep shadow canvas' }, { color: '#F5F5F5', usage: 'stark type' }, { color: '#C1121F', usage: 'narrative accent' }],
    typography: { heading: 'Sharp angular display sans', body: 'Condensed cinematic sans' },
    composition: ['noir framing', 'heavy negative shadow', 'off-axis reveals'],
    motion: ['creeping push-in', 'dramatic reveal', 'pause before impact'],
    transitions: ['domain warp', 'shadow wipe'],
    antiPatterns: ['soft pastel gradients', 'cheerful bounce', 'default centered title'],
  },
];

export const COMPONENT_CATALOG: ComponentGuide[] = [
  { id: 'title-card', name: '标题卡', useWhen: '建立主题、章节或强观点', guidance: ['先设计最完整的 hero frame', '标题层级与留白应匹配内容语气'], avoid: ['每个视频都使用居中大标题'] },
  { id: 'kinetic-captions', name: '动态字幕', useWhen: '语音是主要叙事线索', guidance: ['按语义分组而非逐字闪烁', '保证可读时长与安全边距'], avoid: ['所有词使用同一种夸张动画'] },
  { id: 'data-chart', name: '数据图表', useWhen: '趋势、比例或比较比文字更清晰', guidance: ['数据标签使用等宽数字', '动画应解释数据关系'], avoid: ['无数据含义的装饰图表'] },
  { id: 'timeline', name: '时间轴', useWhen: '事件有明确时间或因果顺序', guidance: ['当前节点应有清晰焦点', '让进度方向与阅读方向一致'], avoid: ['把所有节点一次性塞满画面'] },
  { id: 'person-card', name: '人物卡', useWhen: '人物身份或观点需要建立可信度', guidance: ['照片、姓名、身份形成单一视觉组', '为肖像保留呼吸空间'], avoid: ['通用社交资料卡样式'] },
  { id: 'quote-card', name: '引用卡', useWhen: '一句原话承担叙事转折', guidance: ['强调关键短语而非整段加粗', '标注来源'], avoid: ['长段落缩成小字'] },
  { id: 'comparison', name: '对比画面', useWhen: '前后、优劣或两种方案需要并置', guidance: ['用共同尺度建立可比性', '可采用擦除或匹配切换'], avoid: ['两侧视觉权重意外失衡'] },
  { id: 'image-wall', name: '图片墙', useWhen: '需要表现规模、多样性或记忆蒙太奇', guidance: ['建立主次和裁切节奏', '控制同时运动的图片数量'], avoid: ['机械均匀的九宫格默认布局'] },
  { id: 'product-demo', name: '产品演示', useWhen: '需要展示真实操作或关键功能', guidance: ['镜头聚焦当前操作', '指针、放大和标注保持同步'], avoid: ['展示无法辨认的完整界面'] },
  { id: 'chapter-transition', name: '章节转场', useWhen: '多场景叙事切换章节或语气', guidance: ['转场延续前后场景的形状或动势', '多场景必须有明确转场'], avoid: ['空帧后硬切'] },
  { id: 'progress-cue', name: '进度提示', useWhen: '教程、清单或长视频需要方向感', guidance: ['弱化为辅助层', '与章节结构保持一致'], avoid: ['让进度条抢过核心内容'] },
  { id: 'end-credit', name: '片尾署名', useWhen: '需要品牌、来源、行动号召或制作信息', guidance: ['作为最终节奏收束', '保留足够停留时间'], avoid: ['突然出现大量小字'] },
];

export const DESIGN_PRINCIPLES = [
  'Define the visual identity before generating HTML.',
  'Complete each scene’s static hero-frame layout before adding animation.',
  'Use deterministic finite animation; never use Math.random, Date.now, or infinite loops.',
  'Every multi-scene video needs transitions, and every scene element needs an entrance.',
  'Treat dark gradients, blue-purple neon, and centered oversized titles as deliberate choices, never defaults.',
  'For videos 12 seconds or longer, use at least three semantic visual beats; changing only subtitle text in one repeated layout is prohibited.',
];
