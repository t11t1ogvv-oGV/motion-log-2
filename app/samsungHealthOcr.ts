export type OcrDraft = {
  date: string;
  type: '러닝' | '걷기' | '자전거' | '등산' | '수영' | '기타';
  distanceKm: string;
  duration: string;
  avgPace: string;
  bestPace: string;
  avgSpeed: string;
  bestSpeed: string;
  calories: string;
  steps: string;
  avgHeartRate: string;
  maxHeartRate: string;
  avgCadence: string;
  maxCadence: string;
  vo2max: string;
  elevationGain: string;
  elevationLoss: string;
};

export type OCRPassText = {
  imageIndex: number;
  mode: 'enhanced' | 'threshold' | 'original';
  text: string;
};

const blank = (): OcrDraft => ({
  date: '',
  type: '러닝',
  distanceKm: '',
  duration: '',
  avgPace: '',
  bestPace: '',
  avgSpeed: '',
  bestSpeed: '',
  calories: '',
  steps: '',
  avgHeartRate: '',
  maxHeartRate: '',
  avgCadence: '',
  maxCadence: '',
  vo2max: '',
  elevationGain: '',
  elevationLoss: '',
});

export const normalizeOcrText = (value: string) => value
  .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
  .replace(/[′’]/g, "'")
  .replace(/[″”]/g, '"')
  .replace(/[‐‑‒–—]/g, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\r/g, '')
  .split('\n')
  .map(line => line.replace(/[ \t]+/g, ' ').trim())
  .filter(Boolean)
  .join('\n');

const flat = (text: string) => normalizeOcrText(text).replace(/\n+/g, ' ');

const numberLike = (value: string) => value
  .replace(/[Oo]/g, '0')
  .replace(/[Il]/g, '1')
  .replace(/[Ss]/g, '5')
  .replace(/[, ]/g, '');

const validNumber = (value: string, min: number, max: number) => {
  const parsed = Number(numberLike(value));
  return Number.isFinite(parsed) && parsed >= min && parsed <= max;
};

const cleanNumber = (value: string) => numberLike(value).replace(/[^0-9.\-]/g, '');

const capture = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
};

const labelRegex = (labels: string[]) => new RegExp(`(?:${labels.join('|')})`, 'i');

const extractNumericCandidates = (text: string) => {
  const candidates: string[] = [];
  const regex = /[0-9OoIlSs]{1,6}(?:\.[0-9OoIlSs]+)?/g;
  for (const match of text.matchAll(regex)) candidates.push(match[0]);
  return candidates;
};

const findNearLabel = (
  text: string,
  labels: string[],
  min: number,
  max: number,
  unitPattern?: RegExp,
) => {
  const normalized = normalizeOcrText(text);
  const lines = normalized.split('\n');
  const matcher = labelRegex(labels);

  for (let index = 0; index < lines.length; index += 1) {
    if (!matcher.test(lines[index])) continue;
    const window = lines.slice(index, Math.min(lines.length, index + 4)).join(' ');
    if (unitPattern) {
      const unitMatch = window.match(new RegExp(`([0-9OoIlSs]{1,6}(?:\\.[0-9OoIlSs]+)?)\\s*${unitPattern.source}`, 'i'));
      if (unitMatch?.[1] && validNumber(unitMatch[1], min, max)) return cleanNumber(unitMatch[1]);
    }

    for (const candidate of extractNumericCandidates(window)) {
      if (validNumber(candidate, min, max)) return cleanNumber(candidate);
    }
  }

  return '';
};

const findUnitCandidates = (text: string, unitPattern: RegExp, min: number, max: number) => {
  const normalized = flat(text);
  const regex = new RegExp(`([0-9OoIlSs]{1,6}(?:\\.[0-9OoIlSs]+)?)\\s*${unitPattern.source}`, 'gi');
  const values: string[] = [];
  for (const match of normalized.matchAll(regex)) {
    if (match[1] && validNumber(match[1], min, max)) values.push(cleanNumber(match[1]));
  }
  return values;
};

const parsePaceValue = (value: string) => {
  const cleaned = value.replace(/\s+/g, '');
  const match = cleaned.match(/(\d{1,2})(?:'|:|분)?(\d{2})/);
  if (!match) return '';
  const minutes = Number(match[1]);
  const seconds = Number(match[2]);
  return seconds <= 59 && minutes <= 59 ? `${minutes}'${String(seconds).padStart(2, '0')}\"` : '';
};

const parseDateValue = (value: string) => {
  const match = value.match(/(20\d{2})[^0-9]?(\d{1,2})[^0-9]?(\d{1,2})/);
  if (!match) return '';
  return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}`;
};

export const parseOcrDraft = (texts: string[]): OcrDraft => {
  const draft = blank();
  const normalized = texts.map(normalizeOcrText);
  const text = normalized.join('\n');
  const flatText = flat(text);

  draft.date = parseDateValue(capture(flatText, [
    /((?:20\d{2})\s*[./년-]\s*\d{1,2}\s*[./월-]\s*\d{1,2}(?:\s*일)?)/i,
    /((?:20\d{2})[./-]\d{1,2}[./-]\d{1,2})/i,
  ]));

  if (/등산|하이킹|트레킹|hiking/i.test(text)) draft.type = '등산';
  else if (/러닝|달리기|running|run\b/i.test(text)) draft.type = '러닝';
  else if (/걷기|walking|walk\b/i.test(text)) draft.type = '걷기';
  else if (/자전거|사이클|cycling|biking/i.test(text)) draft.type = '자전거';
  else if (/수영|swimming/i.test(text)) draft.type = '수영';

  draft.distanceKm = capture(flatText, [
    /(?:거리|distance)\s*[^0-9]{0,70}([0-9OoIlSs]+(?:\.[0-9OoIlSs]+)?)\s*(?:km|킬로미터)/i,
    /([0-9OoIlSs]+(?:\.[0-9OoIlSs]+)?)\s*(?:km|킬로미터)/i,
  ]);
  if (!draft.distanceKm) draft.distanceKm = findNearLabel(text, ['거리', 'distance'], 0.05, 200, /(?:km|킬로미터)/i);

  draft.duration = capture(flatText, [
    /(?:운동\s*시간|운동시간|총\s*시간|duration)\s*[^0-9]{0,80}((?:\d{1,2}:){1,2}\d{2})/i,
    /(?:운동\s*시간|운동시간|총\s*시간|duration)\s*[^0-9]{0,80}(\d+\s*시간\s*\d+\s*분(?:\s*\d+\s*초)?)/i,
  ]);
  if (!draft.duration) draft.duration = capture(flatText, [/\b((?:\d{1,2}:){1,2}\d{2})\b/i]);

  const pacePatterns = (labels: string[]) => [
    new RegExp(`(?:${labels.join('|')})\\s*[^0-9]{0,70}([0-9]{1,2}\\s*(?:'|:|분)?\\s*[0-9]{2})`, 'i'),
    new RegExp(`(?:${labels.join('|')})[^0-9]{0,35}([0-9]{1,2}'?[0-9]{2})`, 'i'),
  ];
  draft.avgPace = parsePaceValue(capture(flatText, pacePatterns(['평균\\s*페이스', '평균페이스', 'average\\s*pace'])));
  draft.bestPace = parsePaceValue(capture(flatText, pacePatterns(['최고\\s*페이스', '최고페이스', 'best\\s*pace'])));

  draft.avgSpeed = capture(flatText, [
    /(?:평균\s*속도|평균속도|average\s*speed)\s*[^0-9]{0,70}([0-9OoIlSs]+(?:\.[0-9OoIlSs]+)?)\s*(?:km\s*\/?\s*h|kmh)/i,
  ]);
  draft.bestSpeed = capture(flatText, [
    /(?:최고\s*속도|최고속도|best\s*speed)\s*[^0-9]{0,70}([0-9OoIlSs]+(?:\.[0-9OoIlSs]+)?)\s*(?:km\s*\/?\s*h|kmh)/i,
  ]);

  const avgHrLabels = ['평균\s*심박(?:수)?', '평균심박(?:수)?', '평균\s*심장박동', '평균\s*심박', 'average\s*heart\s*rate'];
  const maxHrLabels = ['최대\s*심박(?:수)?', '최대심박(?:수)?', '최대\s*심장박동', '최대\s*심박', 'max(?:imum)?\s*heart\s*rate'];
  const avgCadenceLabels = ['평균\s*케이던스', '평균케이던스', '평균\s*보폭\s*수', 'average\s*cadence'];
  const maxCadenceLabels = ['최대\s*케이던스', '최대케이던스', '최대\s*보폭\s*수', 'max(?:imum)?\s*cadence'];

  draft.avgHeartRate = findNearLabel(text, avgHrLabels, 40, 220, /(?:bpm|BPM|회\/분|beats?\s*per\s*min)/i);
  draft.maxHeartRate = findNearLabel(text, maxHrLabels, 50, 240, /(?:bpm|BPM|회\/분|beats?\s*per\s*min)/i);
  draft.avgCadence = findNearLabel(text, avgCadenceLabels, 40, 240, /(?:spm|SPM|걸음\/분|steps?\s*per\s*min)/i);
  draft.maxCadence = findNearLabel(text, maxCadenceLabels, 40, 260, /(?:spm|SPM|걸음\/분|steps?\s*per\s*min)/i);

  if (!draft.avgHeartRate || !draft.maxHeartRate) {
    const hrCandidates = findUnitCandidates(text, /(?:bpm|BPM|회\/분|beats?\s*per\s*min)/i, 40, 240);
    if (!draft.avgHeartRate && hrCandidates[0]) draft.avgHeartRate = hrCandidates[0];
    if (!draft.maxHeartRate && hrCandidates[1]) draft.maxHeartRate = hrCandidates[1];
  }

  if (!draft.avgCadence || !draft.maxCadence) {
    const cadenceCandidates = findUnitCandidates(text, /(?:spm|SPM|걸음\/분|steps?\s*per\s*min)/i, 40, 260);
    if (!draft.avgCadence && cadenceCandidates[0]) draft.avgCadence = cadenceCandidates[0];
    if (!draft.maxCadence && cadenceCandidates[1]) draft.maxCadence = cadenceCandidates[1];
  }

  draft.calories = findNearLabel(text, ['칼로리', '소모\s*칼로리', '열량', 'calories?'], 1, 3000, /(?:kcal|cal)/i);
  draft.steps = findNearLabel(text, ['걸음\s*수', '걸음수', 'steps?', '총\s*걸음'], 10, 100000, /(?:걸음|steps?)/i);
  draft.vo2max = findNearLabel(text, ['VO[₂2]?\s*Max', 'VO2\s*Max', 'VO₂', '최대\s*산소\s*섭취량'], 10, 90);
  draft.elevationGain = findNearLabel(text, ['상승\s*고도', '고도\s*상승', 'elevation\s*gain', '누적\s*상승'], 0, 10000, /m/i);
  draft.elevationLoss = findNearLabel(text, ['하강\s*고도', '고도\s*하강', 'elevation\s*loss', '누적\s*하강'], 0, 10000, /m/i);

  return draft;
};

const loadImage = (file: File) => new Promise<HTMLImageElement>((resolve, reject) => {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => {
    URL.revokeObjectURL(url);
    resolve(image);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error('이미지를 열 수 없습니다.'));
  };
  image.src = url;
});

const renderVariant = async (file: File, mode: 'enhanced' | 'threshold' | 'original') => {
  const image = await loadImage(file);
  const maxWidth = 2600;
  const scale = Math.min(3.5, Math.max(1.8, maxWidth / Math.max(1, image.naturalWidth)));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('이미지 처리를 시작할 수 없습니다.');
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);

  if (mode === 'original') return canvas;

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const pixels = imageData.data;
  const contrast = mode === 'threshold' ? 1.7 : 1.45;
  const threshold = 176;
  for (let i = 0; i < pixels.length; i += 4) {
    const luminance = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
    let value = ((luminance - 128) * contrast) + 128;
    if (mode === 'threshold') value = value < threshold ? 0 : 255;
    value = Math.max(0, Math.min(255, value));
    pixels[i] = value;
    pixels[i + 1] = value;
    pixels[i + 2] = value;
  }
  context.putImageData(imageData, 0, 0);
  return canvas;
};

export const recognizeSamsungHealthImages = async (
  files: File[],
  onProgress?: (message: string) => void,
): Promise<{ texts: OCRPassText[]; draft: OcrDraft }> => {
  const { createWorker, PSM } = await import('tesseract.js');
  const worker = await createWorker(['kor', 'eng'], 1, {
    logger: message => {
      if (message.status === 'recognizing text') {
        onProgress?.(`OCR 진행 ${Math.round((message.progress || 0) * 100)}%`);
      }
    },
  });

  const texts: OCRPassText[] = [];
  try {
    await worker.setParameters({ user_defined_dpi: '300', preserve_interword_spaces: '1' });

    for (let index = 0; index < files.length; index += 1) {
      const passes: ('enhanced' | 'threshold')[] = ['enhanced', 'threshold'];
      for (const mode of passes) {
        onProgress?.(`캡처 ${index + 1}/${files.length} · ${mode === 'enhanced' ? '선명화' : '고대비'} 인식 중…`);
        const canvas = await renderVariant(files[index], mode);
        await worker.setParameters({
          tessedit_pageseg_mode: mode === 'enhanced' ? PSM.SINGLE_BLOCK : PSM.SPARSE_TEXT,
          tessedit_char_whitelist: '',
          user_defined_dpi: '300',
          preserve_interword_spaces: '1',
        });
        const result = await worker.recognize(canvas);
        texts.push({ imageIndex: index, mode, text: result.data.text || '' });
      }
    }

    let draft = parseOcrDraft(texts.map(item => item.text));
    const missingRequired = !draft.date || !draft.distanceKm || !draft.duration;
    if (missingRequired) {
      for (let index = 0; index < files.length; index += 1) {
        onProgress?.(`캡처 ${index + 1}/${files.length} · 원본 정밀 재인식 중…`);
        const canvas = await renderVariant(files[index], 'original');
        await worker.setParameters({
          tessedit_pageseg_mode: PSM.AUTO,
          tessedit_char_whitelist: '',
          user_defined_dpi: '300',
          preserve_interword_spaces: '1',
        });
        const result = await worker.recognize(canvas);
        texts.push({ imageIndex: index, mode: 'original', text: result.data.text || '' });
      }
      draft = parseOcrDraft(texts.map(item => item.text));
    }

    return { texts, draft };
  } finally {
    await worker.terminate();
  }
};
