// KR NIGHT neon night theme (logo: neon blue ↔ pink on black)
export const C = {
  bg: '#0B0B14',
  card: '#15151F',
  card2: '#1D1D2B',
  border: '#2A2A3C',
  text: '#F4F4F8',
  sub: '#9A9AB0',
  blue: '#3B9EFF',
  pink: '#FF3B81',
  purple: '#8B5CF6',
  green: '#34D399',
  yellow: '#FBBF24',
  danger: '#F87171',
};

export const AREAS = [
  { key: 'itaewon', ko: '이태원', en: 'Itaewon', ja: '梨泰院', zh: '梨泰院' },
  { key: 'hongdae', ko: '홍대', en: 'Hongdae', ja: 'ホンデ', zh: '弘大' },
  { key: 'apgujeong', ko: '압구정', en: 'Apgujeong', ja: '狎鴎亭', zh: '狎鸥亭' },
  { key: 'gangnam', ko: '강남', en: 'Gangnam', ja: '江南', zh: '江南' },
  { key: 'seongsu', ko: '성수', en: 'Seongsu', ja: '聖水', zh: '圣水' },
  { key: 'euljiro', ko: '을지로', en: 'Euljiro', ja: '乙支路', zh: '乙支路' },
];

export const CATEGORIES = [
  { key: 'club', ko: '클럽', en: 'Club', ja: 'クラブ', zh: '夜店', emoji: '🪩' },
  { key: 'bar', ko: '바', en: 'Bar', ja: 'バー', zh: '酒吧', emoji: '🍸' },
  { key: 'lounge', ko: '라운지', en: 'Lounge', ja: 'ラウンジ', zh: '酒廊', emoji: '🥂' },
  { key: 'pocha', ko: '포차', en: 'Pocha', ja: 'ポチャ', zh: '布帐马车', emoji: '🍢' },
];

export const areaName = (key, lang) => {
  const a = AREAS.find((x) => x.key === key);
  return a ? a[lang] || a.en : key;
};
export const catInfo = (key) => CATEGORIES.find((x) => x.key === key) || { emoji: '🎶', ko: key, en: key, ja: key, zh: key };
