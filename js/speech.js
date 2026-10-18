// Scores omroepen als een echte caller, in het Engels of Nederlands.

let enabled = true;
let language = 'en';
let voice = null;

const LANG_CODES = { en: 'en-GB', nl: 'nl-NL' };

// Hoe duidelijker de stem, hoe hoger de score. Premium/verbeterde stemmen
// klinken veel natuurlijker dan de standaard "compacte" stemmen.
function voiceScore(v) {
  const name = v.name;
  const lang = v.lang.replace('_', '-');
  let score = 0;
  if (lang === LANG_CODES[language]) score += 10;
  if (/premium/i.test(name)) score += 40;
  else if (/enhanced|verbeterd|neural|natural/i.test(name)) score += 30;
  else if (/^Google/i.test(name)) score += 20;
  if (language === 'en' && /Daniel|Arthur|Male/i.test(name)) score += 5;
  if (language === 'nl' && /Xander|Claire|Fleur/i.test(name)) score += 5;
  // Grappige/vervormde macOS-stemmen nooit kiezen.
  if (/Bad News|Bahh|Bells|Boing|Bubbles|Cellos|Jester|Organ|Trinoids|Whisper|Wobble|Zarvox|Superstar|Albert|Fred|Junior|Ralph|Kathy|Grandpa|Grandma|Eddy|Flo|Reed|Rocko|Sandy|Shelley/i.test(name)) score -= 100;
  return score;
}

function pickVoice() {
  if (!('speechSynthesis' in window)) return;
  const candidates = speechSynthesis
    .getVoices()
    .filter((v) => v.lang.replace('_', '-').startsWith(language))
    .sort((a, b) => voiceScore(b) - voiceScore(a));
  voice = candidates[0] ?? null;
}

if ('speechSynthesis' in window) {
  pickVoice();
  speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
}

export function setSpeechLanguage(lang) {
  language = LANG_CODES[lang] ? lang : 'en';
  pickVoice();
}

export function setSpeechEnabled(on) {
  enabled = on;
  if (!on && 'speechSynthesis' in window) speechSynthesis.cancel();
}

// iOS laat pas geluid toe na een tik: roep dit aan vanuit een tik.
export function unlockSpeech() {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(' ');
  u.volume = 0;
  speechSynthesis.speak(u);
}

export function say(text) {
  if (!enabled || !('speechSynthesis' in window) || !text) return;
  speechSynthesis.cancel();
  // Stemmen worden soms pas later geladen (vooral op iOS).
  if (!voice || !voice.lang.replace('_', '-').startsWith(language)) pickVoice();
  const u = new SpeechSynthesisUtterance(text);
  if (voice) u.voice = voice;
  u.lang = voice?.lang ?? LANG_CODES[language];
  u.rate = 0.88; // iets rustiger, zodat elk woord goed te verstaan is
  u.pitch = 1;
  u.volume = 1;
  speechSynthesis.speak(u);
}

const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

// Britse uitspraak: "one hundred and forty".
export function numberWords(n) {
  if (n === 0) return 'zero';
  let out = '';
  if (n >= 100) {
    out = `${ONES[Math.floor(n / 100)]} hundred`;
    n %= 100;
    if (n) out += ' and ';
  }
  if (n >= 20) {
    out += TENS[Math.floor(n / 10)];
    if (n % 10) out += `-${ONES[n % 10]}`;
  } else if (n > 0) {
    out += ONES[n];
  }
  return out;
}

function callTurn(score) {
  if (score === 0) return 'No score.';
  if (score === 180) return 'One hundred and eighty!';
  return `${numberWords(score)}.`;
}

// Omroep-teksten per taal. Een Nederlandse stem spreekt cijfers zelf goed uit.
const PHRASES = {
  en: {
    gameOn: () => 'Game on!',
    first: (name) => `${name} to throw first.`,
    yourThrow: (name) => `${name}, it's your throw.`,
    turn: (score) => callTurn(score),
    bust: () => 'No score.',
    require: (name, score) => `${name}, you require ${numberWords(score)}.`,
    leg: (type, name) => `Game shot, and the ${type}, ${name}!`,
    match: (name) => `Game shot, and the match, ${name}!`,
  },
  nl: {
    gameOn: () => 'Game on!',
    first: (name) => `${name} begint.`,
    yourThrow: (name) => `${name}, jij bent aan de beurt.`,
    turn: (score) => (score === 0 ? 'Geen score.' : score === 180 ? 'Honderdtachtig!' : `${score}.`),
    bust: () => 'Bust! Geen score.',
    require: (name, score) => `${name}, nog ${score} om uit te gooien.`,
    leg: (type, name) => `Uitgegooid! De ${type} is voor ${name}.`,
    match: (name) => `Uitgegooid! ${name} wint de wedstrijd!`,
  },
};

// Tekst in de gekozen taal, bv. phrase('require', 'Max', 40).
export function phrase(key, ...args) {
  return PHRASES[language][key](...args);
}
