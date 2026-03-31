export interface ExamplePreset {
  file: string;
  labelZh: string;
  labelEn: string;
  summaryZh: string;
  summaryEn: string;
}

export const EXAMPLE_PRESETS: ExamplePreset[] = [
  {
    file: '01-ore-weighing-hopper.json',
    labelZh: '矿石称量斗',
    labelEn: 'Ore Weighing Hopper',
    summaryZh: '参考 01019a4a...xml，包含斗体、放样锥体与组合逻辑。',
    summaryEn: 'Based on 01019a4a...xml, featuring body, lofted cone, and assembly logic.',
  },
  {
    file: '02-industrial-l-bracket.json',
    labelZh: '工业L型支架',
    labelEn: 'Industrial L-Bracket',
    summaryZh: '参考 1ff2e7a6...xml，演示支腿组、底板与角钢拼装。',
    summaryEn: 'Based on 1ff2e7a6...xml, demonstrating leg group, base plate, and brace assembly.',
  },
  {
    file: '03-spherical-washer.json',
    labelZh: '球锥垫圈',
    labelEn: 'Spherical Washer',
    summaryZh: '参考 0bd2d7a4...xml，经典的布尔切削工业件。',
    summaryEn: 'Based on 0bd2d7a4...xml, a classic boolean subtract industrial part.',
  },
  {
    file: '04-structural-h-beam.json',
    labelZh: '工字钢结构件',
    labelEn: 'Structural H-Beam',
    summaryZh: '标准 H 型钢梁，演示如何通过 Box 与 Translation 组合复杂型材。',
    summaryEn: 'Standard H-Beam, showing complex profile assembly using boxes and translation.',
  },
  {
    file: '05-bolted-assembly.json',
    labelZh: '螺栓连接件',
    labelEn: 'Bolted Assembly',
    summaryZh: '参数化螺栓组件，包含头、杆与尺寸联动逻辑。',
    summaryEn: 'Parametric bolt assembly, featuring head, shank, and dimension linking logic.',
  },
  {
    file: '06-industrial-pipe-joint.json',
    labelZh: '工业管道接头',
    labelEn: 'Industrial Pipe Joint',
    summaryZh: '管道与法兰盘接头，展示极坐标阵列生成螺栓孔模式。',
    summaryEn: 'Pipe and flange joint, showing polar array for bolt hole patterns.',
  },
  {
    file: '07-circular-heat-exchanger.json',
    labelZh: '环形换热器壳体',
    labelEn: 'Circular Exchanger Shell',
    summaryZh: '换热器大型壳体，包含内部空腔与管口连接逻辑。',
    summaryEn: 'Large heat exchanger shell with internal cavity and nozzle logic.',
  },
  {
    file: '08-conveyor-roller.json',
    labelZh: '输送机滚筒轴',
    labelEn: 'Conveyor Roller Axis',
    summaryZh: '工业输送机滚筒，多层圆柱体并集。',
    summaryEn: 'Industrial conveyor roller, a union of multiple cylinders.',
  },
];

export const getExampleLabel = (preset: ExamplePreset, language: 'zh' | 'en') =>
  language === 'zh' ? preset.labelZh : preset.labelEn;
