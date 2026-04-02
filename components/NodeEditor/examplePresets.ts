export interface ExamplePreset {
  file: string;
  labelZh: string;
  labelEn: string;
  summaryZh: string;
  summaryEn: string;
}

export const EXAMPLE_PRESETS: ExamplePreset[] = [
  {
    file: '01-flange.json',
    labelZh: '法兰',
    labelEn: 'Flange',
    summaryZh: '',
    summaryEn: '',
  },
  {
    file: '02-valve.json',
    labelZh: '阀门',
    labelEn: 'Valve',
    summaryZh: '',
    summaryEn: '',
  }
];

export const getExampleLabel = (preset: ExamplePreset, language: 'zh' | 'en') =>
  language === 'zh' ? preset.labelZh : preset.labelEn;
