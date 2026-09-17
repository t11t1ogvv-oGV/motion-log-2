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
  .replace(/[, ]/g, '');

const scoreNumber = (value: string, min: number, max: number) => {
  const parsed = Number(numberLike(value));
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return '';
  return value.trim();
};

const capture = (text: string, patterns: RegExp[]) => {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return '';
};

const captureLabelNumber = (text: string, labels: string[], min: number, max: number) => {
  const label = labels.join('|');
  const patterns = [
    new RegExp(`(?:${label})[^0-9]{0,55}([0-9OoIl]{2,6}(?:\\.[0-9OoIl]+)?)`, 'i'),
    new RegExp(`(?:${label})[^0-9]{0,20}([0-9OoIl]{1,3})\\s*(?:bpm|spm|회|개|걸음)?`, 'i'),
  ];
  for (const pattern of patterns) {
    const value = capture(text, [pattern]);
    const checked = scoreNumber(value, min, max);
    if (checked) return checked;
  }
  return '';
};

export const parseOcrDraft = (texts: string[]): OcrDraft => {
  const draft = blank();
  const normalized = texts.map(normalizeOcrText);
  const text = normalized.join('\n');
  const flatText = flat(text);

  draft.date = (() => {
    const raw = capture(flatText, [
      /((?:20\d{2})\s*[./년-]\s*\d{1,2}\s*[./월-]\s*\d{1,2}(?:\s*일)?)/i,
      /((?:20\d{2})[./-]\d{1,2}[./-]\d{1,2})/i,
    ]);
    const match = raw.match(/(20\d{2})[^0-9]?(\d{1,2})[^0-9]?(\d{1,2})/);
    if (!match) return '';
    return `${match[1]}-${String(Number(match[2])).padStart(2, '0')}-${String(Number(match[3])).padStart(2, '0')}`;
  })();

  if (/등산|하이킹|hiking/i.test(text)) draft.type = '등산';
  else if (/러닝|달리기|running|run\b/i.test(text)) draft.type = '러닝';
  else if (/걷기|walking|walk\b/i.test(text)) draft.type = '걷기';
  else if (/자전거|cycling|biking/i.test(text)) draft.type = '자전거';
  else if (/수영|swimming/i.test(text)) draft.type = '수영';

  draft.distanceKm = capture(flatText, [
    /(?:거리|distance)\s*[^0-9]{0,45}(\d+(?:\.\d+)?)\s*(?:km|킬로미터)/i,
    /(\d+(?:\.\d+)?)\s*(?:km|킬로미터)/i,
  ]);

  draft.duration = capture(flatText, [
    /(?:운동\s*시간|운동시간|총\s*시간|duration)\s*[^0-9]{0,55}((?:\d{1,2}:){1,2}\d{2})/i,
    /(?:운동\s*시간|운동시간|총\s*시간|duration)\s*[^0-9]{0,55}(\d+\s*시간\s*\d+\s*분(?:\s*\d+\s*초)?)/i,
    /\b((?:\d{1,2}:){1,2}\d{2})\b/i,
  ]);

  draft.avgPace = capture(flatText, [
    /(?:평균\s*페이스|평균페이스|average\s*pace)\s*[^0-9]{0,50}(\d{1,2}\s*(?:'|:|분)?\s*\d{2})(?:\s*(?:["″]|\/km|분\/km))?/i,
    /(?:평균\s*페이스|평균페이스|average\s*pace)[^0-9]{0,20}(\d{1,2}'?\d{2})/i,
  ]);
  draft.bestPace = capture(flatText, [
    /(?:최고\s*페이스|최고페이스|best\s*pace)\s*[^0-9]{0,50}(\d{1,2}\s*(?:'|:|분)?\s*\d{2})(?:\s*(?:["″]|\/km|분\/km))?/i,
    /(?:최고\s*페이스|최고페이스|best\s*pace)[^0-9]{0,20}(\d{1,2}'?\d{2})/i,
  ]);

  draft.avgSpeed = capture(flatText, [
    /(?:평균\s*속도|평균속도|average\s*speed)\s*[^0-9]{0,50}(\d+(?:\.\d+)?)\s*(?:km\s*\/?\s*h|kmh)/i,
  ]);
  draft.bestSpeed = capture(flatText, [
    /(?:최고\s*속도|최고속도|best\s*speed)\s*[^0-9]{0,50}(\d+(?:\.\d+)?)\s*(?:km\s*\/?\s*h|kmh)/i,
  ]);

  draft.calories = captureLabelNumber(text, ['칼로리', '소모\s*칼로리', '열량', 'calories?'], 1, 3000);
  draft.steps = captureLabelNumber(text, ['걸음\s*수', '걸음수', 'steps?'], 10, 100000);
  draft.avgHeartRate = captureLabelNumber(text, ['평균\s*심박(?:수)?', '평균심박(?:수)?', 'average\s*heart\s*rate'], 40, 220);
  draft.maxHeartRate = captureLabelNumber(text, ['최대\s*심박(?:수)?', '최대심박(?:수)?', 'max(?:imum)?\s*heart\s*rate'], 50, 240);
  draft.avgCadence = captureLabelNumber(text, ['평균\s*케이던스', '평균케이던스', 'average\s*cadence'], 40, 240);
  draft.maxCadence = captureLabelNumber(text, ['최대\s*케이던스', '최대케이던스', 'max(?:imum)?\s*cadence'], 40, 260);
  draft.vo2max = captureLabelNumber(text, ['VO[₂2]?\s*Max', 'VO2\s*Max', 'VO₂'], 10, 90);
  draft.elevationGain = captureLabelNumber(text, ['상승\s*고도', '고도\s*상승', 'elevation\s*gain'], 0, 10000);
  draft.elevationLoss = captureLabelNumber(text, ['하강\s*고도', '고도\s*하강', 'elevation\s*loss'], 0, 10000);

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
  const maxWidth = 2200;
  const scale = Math.min(3, Math.max(1.6, maxWidth / Math.max(1, image.naturalWidth)));
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
  const contrast = mode === 'threshold' ? 1.55 : 1.38;
  const threshold = 178;
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
