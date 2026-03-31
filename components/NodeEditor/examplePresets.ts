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
];

export const getExampleLabel = (preset: ExamplePreset, language: 'zh' | 'en') =>
  language === 'zh' ? preset.labelZh : preset.labelEn;
