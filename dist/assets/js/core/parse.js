/* Commercial Opportunity Network — deterministic requirement extraction.
   Supported formats are documented in docs/PARSER.md. Nothing is invented: a field is only returned
   when the text states it, and every returned field carries a status the user must be able to review. */
(function (root) {
  'use strict';
  const CON = root.CON = root.CON || {};
  const Dt = CON.Dates;

  const LIMITS = {
    budgetMinFils: 1000 * 100,        // below AED 1,000 → ask to confirm
    budgetMaxFils: 10000000 * 100,    // above AED 10,000,000 → ask to confirm
    targetMax: 10000000,
    durationMaxDays: 365
  };

  /* ---------- Normalisation (1:1 character mapping, so positions match the original text) ---------- */
  function normalize(text) {
    let out = '';
    for (const ch of String(text || '')) {
      const c = ch.charCodeAt(0);
      if (c >= 0x0660 && c <= 0x0669) out += String(c - 0x0660);          // Arabic-Indic digits
      else if (c >= 0x06F0 && c <= 0x06F9) out += String(c - 0x06F0);     // Eastern Arabic-Indic digits
      else if (ch === '٬') out += ',';                               // Arabic thousands separator
      else if (ch === '٫') out += '.';                               // Arabic decimal separator
      else if (ch === '،') out += ',';                               // Arabic comma (punctuation)
      else { const l = ch.toLowerCase(); out += l.length === 1 ? l : ch; }
    }
    return out;
  }

  /* ---------- Numbers ---------- */
  /* Returns { value: 'digits[.digits]' } or { ambiguous: true, reason }. */
  function parseNumber(tok) {
    const hasC = tok.indexOf(',') >= 0, hasD = tok.indexOf('.') >= 0;
    if (!hasC && !hasD) return { value: tok.replace(/^0+(?=\d)/, '') };
    if (hasC && hasD) {
      if (/^\d{1,3}(,\d{3})+\.\d+$/.test(tok)) return { value: tok.replace(/,/g, '') };
      return { ambiguous: true, reason: 'mixed-separators' };
    }
    if (hasC) {
      if (/^\d{1,3}(,\d{3})+$/.test(tok)) return { value: tok.replace(/,/g, '') };
      return { ambiguous: true, reason: 'comma' };
    }
    if (/^\d+\.\d{3}$/.test(tok)) return { ambiguous: true, reason: 'dot-thousands' };
    if (/^\d+\.\d+$/.test(tok)) return { value: tok };
    return { ambiguous: true, reason: 'dots' };
  }
  /* decimal string × integer factor → BigInt, or null if not exact */
  function decimalTimes(dec, factor) {
    const [w, f = ''] = dec.split('.');
    const num = BigInt(w + f), den = 10n ** BigInt(f.length);
    const v = num * BigInt(factor);
    return v % den === 0n ? v / den : null;
  }

  const MULT = [
    [/^\s?(k)(?![a-z؀-ۿ])/, 1000], [/^\s(thousands?)(?![a-z])/, 1000], [/^\s?(mn|m)(?![a-z؀-ۿ])/, 1000000],
    [/^\s(millions?)(?![a-z])/, 1000000], [/^\s?(bn)(?![a-z])/, 1000000000], [/^\s(billions?)(?![a-z])/, 1000000000],
    [/^\s?(ألف|الف|آلاف)(?![؀-ۿ])/, 1000], [/^\s?(مليون|ملايين)(?![؀-ۿ])/, 1000000], [/^\s?(مليار|مليارات)(?![؀-ۿ])/, 1000000000]
  ];
  const CUR_AFTER = /^\s?(aed|dhs|dh|dirhams?|درهم|دراهم|د\.\s?إ)(?![a-z؀-ۿ])/;
  const CUR_BEFORE = /(?:^|[^a-z؀-ۿ])(aed|dhs|dh|د\.\s?إ)\s?$/;
  const BUDGET_CUE = /(budget|spend|spending|ميزانية|بميزانية|ميزانيه)[^.;\d]{0,16}$/;

  function scanNumbers(n) {
    const out = []; const re = /\d[\d.,]*\d|\d/g; let m;
    while ((m = re.exec(n))) out.push({ tok: m[0], start: m.index, end: m.index + m[0].length });
    return out;
  }

  /* ---------- Money ---------- */
  function findMoney(n, orig, mode, reserved) {
    const res = [];
    const inReserved = (a, b) => (reserved || []).some(([x, y]) => a < y && b > x);
    for (const t of scanNumbers(n)) {
      const after = n.slice(t.end, t.end + 14);
      let mult = 1, multLen = 0, multWord = '';
      for (const [re, f] of MULT) { const mm = re.exec(after); if (mm) { mult = f; multLen = mm[0].length; multWord = mm[1]; break; } }
      const afterMult = n.slice(t.end + multLen, t.end + multLen + 12);
      const curA = CUR_AFTER.exec(afterMult);
      const before = n.slice(Math.max(0, t.start - 8), t.start);
      const curB = CUR_BEFORE.exec(before);
      const cue = BUDGET_CUE.test(n.slice(Math.max(0, t.start - 28), t.start));
      if (!curA && !curB && !cue) continue;
      if (mode === 'currency' && !(curA || curB)) continue;
      if (mode === 'cue' && (curA || curB || inReserved(t.start, t.end))) continue;
      const start = curB ? t.start - curB[0].replace(/^[^a-z؀-ۿ]/, '').length : t.start;
      const end = t.end + multLen + (curA ? curA[0].length : 0);
      const raw = orig.slice(start, end).trim();
      const negative = /-\s?$/.test(n.slice(Math.max(0, start - 2), start)) || /-\s?$/.test(before.replace(CUR_BEFORE, ''));
      const p = parseNumber(t.tok);
      const item = { raw, start, end: Math.max(end, t.end), currencyStated: !!(curA || curB), multiplier: multWord };
      if (negative) { res.push(Object.assign(item, { status: 'invalid', note: 'negative' })); continue; }
      if (p.ambiguous) { res.push(Object.assign(item, { status: 'ambiguous', note: p.reason })); continue; }
      const fils = decimalTimes(p.value, mult * 100);
      if (fils === null) { res.push(Object.assign(item, { status: 'invalid', note: 'precision' })); continue; }
      if (fils <= 0n) { res.push(Object.assign(item, { status: 'invalid', note: 'zero' })); continue; }
      if (fils > BigInt(Number.MAX_SAFE_INTEGER)) { res.push(Object.assign(item, { status: 'invalid', note: 'range' })); continue; }
      const minor = Number(fils);
      const plausible = minor >= LIMITS.budgetMinFils && minor <= LIMITS.budgetMaxFils;
      res.push(Object.assign(item, { minor, status: plausible ? (item.currencyStated ? 'recognized' : 'review') : 'confirm', note: plausible ? (item.currencyStated ? '' : 'currency-assumed') : (minor < LIMITS.budgetMinFils ? 'below-limit' : 'above-limit') }));
    }
    return res;
  }

  /* ---------- Objectives, targets, negation ---------- */
  const OBJ_RULES = [
    ['trial', /\b(trials?|sampl\w*|tast(?:e|ing)|try|tryouts?)\b|تجرب[ةه]|تذوق|عينات|عين[ةه]/g],
    ['launch', /\b(launch\w*|introduc\w*|new product)\b|إطلاق|اطلاق/g],
    ['leads', /\b(leads?|sign-?ups?|registrations?|demo requests?)\b|عملاء محتملين|تسجيلات|تسجيل/g],
    ['footfall', /\b(footfall|foot traffic|store visits?|walk-?ins?)\b|زيارات المتجر|حركة الزوار/g],
    ['acquisition', /\b(acquir\w*|acquisition|new customers?|customers?|clients?)\b|استقطاب|عملاء جدد|عملاء(?! محتملين)/g],
    ['awareness', /\b(awareness|visibility|brand recall)\b|الوعي|انتشار/g]
  ];
  const NEGATORS = /(?:^|[^a-z])(not|no|without|excluding|except|rather than|instead of|avoid|never)\s+(?:\w+\s+){0,2}$|(?:^|\s)(لا|ليس|ليست|بدون|دون|غير|عدا|وليس)\s+(?:\S+\s+){0,1}$/;
  function clauseBefore(n, idx) {
    const s = n.slice(Math.max(0, idx - 40), idx);
    const cut = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'), s.lastIndexOf(';'), s.lastIndexOf('!'), s.lastIndexOf('?'), s.lastIndexOf(' but '), s.lastIndexOf(' لكن '));
    return cut >= 0 ? s.slice(cut + 1) : s;
  }
  function isNegated(n, idx) { return NEGATORS.test(clauseBefore(n, idx)); }

  const TARGET_RE = /(\d[\d.,]*\d|\d)(\s?(?:k|thousand)(?![a-z]))?\s+(?:(?:new|qualified|more|additional|unique|extra|paying)\s+)*(customers?|clients?|buyers?|users?|leads?|sign-?ups?|signups|registrations?|trials?|samples?|visitors?|visits?|footfall|impressions?|views?)\b|(\d[\d.,]*\d|\d)\s?(ألف)?\s+(عملاء محتملين|عميل جديد|عملاء جدد|عميل|عملاء|تجربة|تجارب|عينة|عينات|زائر|زوار|زيارة|زيارات|تسجيل|تسجيلات|مشاهدة|مشاهدات)/g;
  const NOUN_OBJ = [
    [/^(customers?|clients?|buyers?|users?|عميل|عملاء|عملاء جدد|عميل جديد)$/, 'acquisition'],
    [/^(leads?|sign-?ups?|signups|registrations?|تسجيل|تسجيلات|عملاء محتملين)$/, 'leads'],
    [/^(trials?|samples?|تجربة|تجارب|عينة|عينات)$/, 'trial'],
    [/^(visitors?|visits?|footfall|زائر|زوار|زيارة|زيارات)$/, 'footfall'],
    [/^(impressions?|views?|مشاهدة|مشاهدات)$/, 'awareness']
  ];
  function nounObjective(noun) { for (const [re, o] of NOUN_OBJ) if (re.test(noun)) return o; return null; }

  /* ---------- Audience ---------- */
  const MALE = /\b(men|man|males?|gentlemen|fathers|dads)\b|رجال|ذكور|آباء/g;
  const FEMALE = /\b(women|woman|females?|ladies|mothers|mums|moms)\b|نساء|سيدات|إناث|أمهات/g;
  const STRICT = /\b(only|exclusively|must|strictly|required)\b|فقط|حصري|حصريا|يجب/;
  const AGE_CTX_BEFORE = /(aged?|ages|age group|between|years old|عمر|أعمار|اعمار|سن|من عمر|men|women|people|adults|males?|females?|ladies|students|parents|رجال|نساء|سيدات)[^.;\d]{0,14}$/;
  const AGE_CTX_AFTER = /^\s?(years?|yrs?|y\/?o|سنة|عام|عاما|عامًا)/;
  const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const MONTH_SHORT = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const AR_MONTHS = [['يناير'], ['فبراير'], ['مارس'], ['أبريل', 'ابريل'], ['مايو'], ['يونيو'], ['يوليو'], ['أغسطس', 'اغسطس'], ['سبتمبر'], ['أكتوبر', 'اكتوبر'], ['نوفمبر'], ['ديسمبر']];
  const MONTH_WORD = '(' + MONTH_NAMES.join('|') + '|sept|' + MONTH_SHORT.join('|') + ')';
  const AR_MONTH_WORD = '(' + AR_MONTHS.flat().join('|') + ')';
  function monthIndex(w) {
    w = w.replace(/\.$/, '');
    let i = MONTH_NAMES.indexOf(w); if (i >= 0) return i + 1;
    if (w === 'sept') return 9;
    i = MONTH_SHORT.indexOf(w); if (i >= 0) return i + 1;
    for (let k = 0; k < AR_MONTHS.length; k++) if (AR_MONTHS[k].includes(w)) return k + 1;
    return 0;
  }

  /* ---------- Areas ---------- */
  const AREA_RULES = { marina: /\bmarina\b|\bjbr\b|مارينا/, jlt: /\bjlt\b|lakes towers|أبراج بحيرات/, palm: /\bpalm\b|نخلة/, barsha: /\bbarsha\b|برشاء/, hills: /dubai hills|هيلز/, jvc: /\bjvc\b|jumeirah village|قرية جميرا/, downtown: /\bdowntown\b|وسط المدينة/, bizbay: /business bay|الخليج التجاري/, difc: /\bdifc\b|المالي العالمي/, jumeirah: /\bjumeirah\b(?! village| lakes)|جميرا(?! الدائرية)/, deira: /\bdeira\b|ديرة/, burdubai: /bur dubai|بر دبي/, festival: /festival city|فستيفال/, mirdif: /\bmirdif\b|مردف/, dso: /silicon oasis|\bdso\b|السيليكون/, academic: /academic city|الأكاديمية/ };

  const START_WORDS = ['start', 'starting', 'starts', 'from', 'begin', 'beginning', 'begins', 'commencing', 'launch', 'launching', 'on', 'live', 'من', 'يبدأ', 'تبدأ', 'ابتداء', 'ابتداءً', 'اعتبارا', 'بدءا', 'بدءًا'];
  const END_WORDS = ['by', 'before', 'until', 'till', 'through', 'to', 'ending', 'ends', 'end', 'deadline', 'due', 'than', 'حتى', 'إلى', 'الى', 'قبل', 'بحلول', 'ينتهي', 'تنتهي'];
  /* Role of a date = the nearest cue word before it (up to three words back). */
  function roleOf(clause) {
    const words = clause.replace(/[,:]/g, ' ').trim().split(/\s+/).filter(Boolean);
    for (let i = words.length - 1; i >= Math.max(0, words.length - 3); i--) {
      if (END_WORDS.includes(words[i])) return 'end';
      if (START_WORDS.includes(words[i])) return 'start';
    }
    return null;
  }

  /* ---------- Main ---------- */
  function extract(text, opts) {
    const o = opts || {};
    const tz = o.timeZone || Dt.TZ_DEFAULT;
    const today = o.today || Dt.today(tz);
    const orig = String(text || '');
    const n = normalize(orig);
    const found = []; const fields = {}; const excluded = { objectives: [], areas: [] }; const requirements = {};
    const push = (key, value, raw, status, note, extra) => { found.push(Object.assign({ key, value, raw: raw || '', status, note: note || '' }, extra || {})); };

    /* Money stated with a currency is found first; amounts known only from a "budget" cue are resolved
       after dates, ages and targets have claimed their numbers. */
    const moneyCur = findMoney(n, orig, 'currency');
    const moneySpans = moneyCur.map(m => [m.start, m.end]);
    const inMoney = (s, e) => moneySpans.some(([a, b]) => s < b && e > a);
    const reserved = [];

    /* Targets */
    const targets = []; let tm; TARGET_RE.lastIndex = 0;
    while ((tm = TARGET_RE.exec(n))) {
      const numTok = tm[1] || tm[4]; const numStart = tm.index; const noun = (tm[3] || tm[6] || '').trim();
      if (inMoney(numStart, numStart + numTok.length)) continue;
      if (isNegated(n, tm.index)) continue;
      const p = parseNumber(numTok);
      const mult = (tm[2] || tm[5]) ? 1000 : 1;
      const raw = orig.slice(tm.index, tm.index + tm[0].length);
      if (p.ambiguous || /\./.test(p.value || '')) { push('target', null, raw, 'ambiguous', p.reason || 'not-whole'); continue; }
      const v = Number(p.value) * mult;
      if (!Number.isSafeInteger(v) || v <= 0) { push('target', null, raw, 'invalid', 'range'); continue; }
      reserved.push([tm.index, tm.index + tm[0].length]);
      targets.push({ value: v, noun, objective: nounObjective(noun), raw, status: v > LIMITS.targetMax ? 'confirm' : 'recognized' });
    }
    if (targets.length) {
      const t = targets[0];
      fields.target = t.value; push('target', t.value, t.raw, targets.length > 1 ? 'review' : t.status, targets.length > 1 ? 'several-targets' : (t.status === 'confirm' ? 'above-limit' : ''), { candidates: targets.map(x => x.value) });
    }

    /* Objectives with negation */
    const mentions = [];
    for (const [key, re] of OBJ_RULES) {
      re.lastIndex = 0; let m;
      while ((m = re.exec(n))) mentions.push({ key, idx: m.index, raw: orig.slice(m.index, m.index + m[0].length), neg: isNegated(n, m.index) });
    }
    mentions.sort((a, b) => a.idx - b.idx);
    const pos = Array.from(new Set(mentions.filter(x => !x.neg).map(x => x.key)));
    const neg = Array.from(new Set(mentions.filter(x => x.neg).map(x => x.key)));
    neg.forEach(k => { if (!excluded.objectives.includes(k)) excluded.objectives.push(k); });
    const conflicted = pos.filter(k => neg.includes(k));
    const positive = pos.filter(k => !neg.includes(k));
    const fromTarget = targets.length && targets[0].objective && !neg.includes(targets[0].objective) ? targets[0].objective : null;
    let objective = null, objStatus = 'recognized', objNote = '';
    if (fromTarget) { objective = fromTarget; const others = positive.filter(k => k !== fromTarget); if (others.length) { objStatus = 'review'; objNote = 'several-objectives'; } }
    else if (positive.length === 1) objective = positive[0];
    else if (positive.length > 1) { objective = positive[0]; objStatus = 'review'; objNote = 'several-objectives'; }
    if (conflicted.length) { objStatus = 'review'; objNote = 'contradiction'; }
    if (objective) {
      fields.objective = objective;
      const raw = (mentions.find(x => x.key === objective && !x.neg) || {}).raw || (targets[0] && targets[0].raw) || '';
      push('objective', objective, raw, objStatus, objNote, { candidates: positive, excluded: neg });
    } else if (neg.length) {
      push('objective', null, mentions.filter(x => x.neg).map(x => x.raw).join(' · '), 'review', 'only-negated', { excluded: neg });
    }

    /* Gender */
    const genderHits = []; [['male', MALE], ['female', FEMALE]].forEach(([g, re]) => { re.lastIndex = 0; let m; while ((m = re.exec(n))) genderHits.push({ g, idx: m.index, len: m[0].length, raw: orig.slice(m.index, m.index + m[0].length), neg: isNegated(n, m.index) }); });
    const gPos = Array.from(new Set(genderHits.filter(h => !h.neg).map(h => h.g)));
    if (gPos.length === 1) {
      fields.gender = gPos[0];
      const h = genderHits.find(x => x.g === gPos[0] && !x.neg);
      const win = n.slice(Math.max(0, h.idx - 24), h.idx + h.len + 24);
      if (STRICT.test(win)) requirements.audience = 'required';
      push('gender', gPos[0], h.raw, 'recognized', requirements.audience === 'required' ? 'required' : '');
    } else if (gPos.length === 2) { fields.gender = 'all'; push('gender', 'all', genderHits.map(h => h.raw).join(' · '), 'recognized', 'both'); }

    /* Age range */
    const ageRe = /(?:between\s+)?(\d{2})\s*(?:-|–|—|to|and|إلى|الى|حتى|و)\s*(\d{2})(?![\d\/.:-])/g; let am;
    while ((am = ageRe.exec(n))) {
      const a = +am[1], b = +am[2];
      const before = n.slice(Math.max(0, am.index - 26), am.index);
      const after = n.slice(am.index + am[0].length, am.index + am[0].length + 10);
      const near = n.slice(am.index + am[0].length, am.index + am[0].length + 14);
      const looksDate = new RegExp('^\\s*' + MONTH_WORD + '|^\\s*' + AR_MONTH_WORD).test(near) || /[\/]/.test(n.slice(am.index - 1, am.index));
      if (looksDate || inMoney(am.index, am.index + am[0].length)) continue;
      if (!(AGE_CTX_BEFORE.test(before) || AGE_CTX_AFTER.test(after))) continue;
      if (a < 13 || b > 99 || a >= b) { push('age', null, orig.slice(am.index, am.index + am[0].length), 'invalid', 'range'); break; }
      reserved.push([am.index, am.index + am[0].length]);
      fields.ageMin = a; fields.ageMax = b; push('age', a + '–' + b, orig.slice(am.index, am.index + am[0].length).trim(), 'recognized', '');
      break;
    }

    /* Areas with negation and strictness */
    const areas = [];
    Object.keys(AREA_RULES).forEach(k => {
      const m = AREA_RULES[k].exec(n); if (!m) return;
      if (isNegated(n, m.index)) { excluded.areas.push(k); return; }
      areas.push({ k, idx: m.index, raw: orig.slice(m.index, m.index + m[0].length) });
    });
    if (areas.length) {
      fields.areas = areas.map(a => a.k);
      const win = n.slice(Math.max(0, areas[0].idx - 24), areas[areas.length - 1].idx + 40);
      if (STRICT.test(win)) requirements.areas = 'required';
      push('areas', fields.areas.join(','), areas.map(a => a.raw).join(' · '), 'recognized', requirements.areas === 'required' ? 'required' : '');
    } else if (/\bdubai\b|دبي/.test(n)) { fields.areas = ['all']; push('areas', 'all', 'Dubai', 'recognized', ''); }
    if (excluded.areas.length) push('areas-excluded', excluded.areas.join(','), '', 'recognized', 'excluded');

    /* Dates */
    const dates = [];
    const addDate = (y, mo, d, idx, len, assumedYear, dayFirstAmbiguous) => {
      const raw = orig.slice(idx, idx + len).trim();
      reserved.push([idx, idx + len]);
      if (!Dt.isValid(Dt.make(y, mo, d))) { push('date', null, raw, 'invalid', 'impossible-date'); return; }
      let iso = Dt.make(y, mo, d);
      if (assumedYear && iso < today) iso = Dt.make(y + 1, mo, d);
      if (assumedYear && !Dt.isValid(iso)) { push('date', null, raw, 'invalid', 'impossible-date'); return; }
      const role = roleOf(clauseBefore(n, idx));
      dates.push({ iso, idx, raw, role, assumedYear, dayFirstAmbiguous, len });
    };
    let dm;
    const isoRe = /\b(\d{4})-(\d{2})-(\d{2})\b/g; while ((dm = isoRe.exec(n))) addDate(+dm[1], +dm[2], +dm[3], dm.index, dm[0].length, false);
    const dmyRe = new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?' + MONTH_WORD + '\\.?,?(?:\\s+(\\d{4}))?(?![a-z])', 'g');
    while ((dm = dmyRe.exec(n))) { const mo = monthIndex(dm[2]); const ty = +today.slice(0, 4); addDate(dm[3] ? +dm[3] : ty, mo, +dm[1], dm.index, dm[0].length, !dm[3]); }
    const mdyRe = new RegExp('\\b' + MONTH_WORD + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?!\\d)(?:,?\\s+(\\d{4}))?', 'g');
    while ((dm = mdyRe.exec(n))) { if (dates.some(x => Math.abs(x.idx - dm.index) < 4)) continue; const mo = monthIndex(dm[1]); const ty = +today.slice(0, 4); addDate(dm[3] ? +dm[3] : ty, mo, +dm[2], dm.index, dm[0].length, !dm[3]); }
    const arRe = new RegExp('(\\d{1,2})\\s+' + AR_MONTH_WORD + '(?:\\s+(\\d{4}))?', 'g');
    while ((dm = arRe.exec(n))) { const mo = monthIndex(dm[2]); const ty = +today.slice(0, 4); addDate(dm[3] ? +dm[3] : ty, mo, +dm[1], dm.index, dm[0].length, !dm[3]); }
    const numRe = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
    while ((dm = numRe.exec(n))) { const d = +dm[1], mo = +dm[2]; addDate(+dm[3], mo, d, dm.index, dm[0].length, false, d <= 12 && mo <= 12 && d !== mo); }
    /* Relative dates, resolved in the business time zone */
    const rel = [
      [/\btoday\b|اليوم/, () => today], [/\btomorrow\b|غدا|غدًا/, () => Dt.addDays(today, 1)],
      [/\bnext week\b|الأسبوع القادم|الاسبوع القادم/, () => { const w = Dt.weekday(today); return Dt.addDays(today, ((8 - w) % 7) || 7); }],
      [/\bnext month\b|الشهر القادم/, () => { const y = +today.slice(0, 4), m = +today.slice(5, 7); return m === 12 ? Dt.make(y + 1, 1, 1) : Dt.make(y, m + 1, 1); }],
      [/\b(?:in|starting in|after)\s+(\d{1,3})\s+(days?|weeks?)\b|بعد\s+(\d{1,3})\s+(يوم|أيام|يوما|أسبوع|أسابيع)/, (m) => { const k = +(m[1] || m[3]); const u = m[2] || m[4]; return Dt.addDays(today, /week|أسبوع|أسابيع/.test(u) ? k * 7 : k); }]
    ];
    const relSpans = [];
    rel.forEach(([re, fn]) => { const m = re.exec(n); if (!m) return; const iso = fn(m); const r = roleOf(clauseBefore(n, m.index)); const role = r === 'end' && !/\bin\b|بعد/.test(m[0]) ? 'end' : 'start'; dates.push({ iso, idx: m.index, raw: orig.slice(m.index, m.index + m[0].length), role, relative: true, len: m[0].length }); relSpans.push([m.index, m.index + m[0].length]); });

    /* Duration (spans that are relative-start phrases are not durations) */
    const durRe = /(\d{1,3})\s*(days?|weeks?|months?|يوم|أيام|يوما|يومًا|أسبوع|أسابيع|أسبوعين|شهر|أشهر|شهور)(?![a-z])/g; let du; let duration = null;
    while ((du = durRe.exec(n))) {
      if (relSpans.some(([a, b]) => du.index >= a && du.index < b)) continue;
      if (inMoney(du.index, du.index + du[0].length)) continue;
      const k = +du[1]; const u = du[2];
      const days = /week|أسبوع|أسابيع/.test(u) ? k * 7 : /month|شهر|أشهر|شهور/.test(u) ? k * 30 : k;
      duration = { days, raw: orig.slice(du.index, du.index + du[0].length), monthApprox: /month|شهر|أشهر|شهور/.test(u) };
      break;
    }
    if (!duration) { // Arabic dual forms: يومين (2 days), أسبوعين (2 weeks), شهرين (2 months)
      const dm = /(?:^|[^؀-ۿ])(يومين|أسبوعين|اسبوعين|شهرين)(?![؀-ۿ])/.exec(n);
      if (dm && !relSpans.some(([a, b]) => dm.index >= a && dm.index < b)) {
        const w = dm[1]; const days = /يومين/.test(w) ? 2 : /سبوعين/.test(w) ? 14 : 60;
        const i0 = dm.index + dm[0].indexOf(w);
        duration = { days, raw: orig.slice(i0, i0 + w.length), monthApprox: /شهرين/.test(w) };
      }
    }

    dates.sort((a, b) => a.idx - b.idx);
    let start = dates.find(d => d.role === 'start') || null;
    let end = dates.find(d => d.role === 'end') || null;
    const unlabelled = dates.filter(d => !d.role);
    if (!start && unlabelled.length) { start = unlabelled[0]; start.review = true; }
    if (start && !end && unlabelled.length > 1 && unlabelled[1] !== start) end = unlabelled[1];
    if (start) {
      const st = start.iso < today ? 'past' : (start.review || start.assumedYear || start.dayFirstAmbiguous ? 'review' : 'recognized');
      fields.start = start.iso;
      push('start', start.iso, start.raw, st, start.iso < today ? 'past' : start.dayFirstAmbiguous ? 'day-first' : start.assumedYear ? 'assumed-year' : start.review ? 'no-cue' : (start.relative ? 'relative' : ''));
    }
    if (end) {
      const st = end.iso < today ? 'past' : (end.assumedYear || end.dayFirstAmbiguous ? 'review' : 'recognized');
      fields.end = end.iso;
      push('end', end.iso, end.raw, st, end.iso < today ? 'past' : end.assumedYear ? 'assumed-year' : '');
    }
    if (start && end && end.iso < start.iso) push('end', null, end.raw, 'invalid', 'end-before-start');
    if (duration) {
      const ok = duration.days >= 1 && duration.days <= LIMITS.durationMaxDays;
      if (!ok) push('duration', null, duration.raw, 'confirm', 'above-limit');
      else { fields.duration = duration.days; push('duration', duration.days, duration.raw, duration.monthApprox ? 'review' : 'recognized', duration.monthApprox ? 'month-30-days' : ''); }
    }
    if (fields.start && fields.end && fields.end >= fields.start) {
      const span = Dt.diffDays(fields.start, fields.end) + 1;
      if (fields.duration && fields.duration !== span) push('duration', fields.duration, '', 'conflict', 'dates-vs-duration', { candidates: [fields.duration, span] });
      else if (!fields.duration) { fields.duration = span; push('duration', span, '', 'derived', 'from-dates'); }
    } else if (fields.end && fields.duration && !fields.start) {
      fields.start = Dt.addDays(fields.end, -(fields.duration - 1)); push('start', fields.start, '', fields.start < today ? 'past' : 'derived', 'from-deadline');
    }

    /* Money: combine currency-stated and cue-only amounts */
    const money = moneyCur.concat(findMoney(n, orig, 'cue', reserved));
    const usable = money.filter(m => m.minor != null);
    const distinct = Array.from(new Set(usable.map(m => m.minor)));
    if (distinct.length === 1) {
      const m = usable[0];
      // Implausible amounts are reported for confirmation but never applied automatically.
      if (m.status !== 'confirm') { fields.budgetMinor = m.minor; fields.budget = CON.Money ? CON.Money.toDecimalString(m.minor) : String(m.minor / 100); }
      push('budget', m.minor, m.raw, m.status, m.note);
    } else if (distinct.length > 1) {
      push('budget', null, usable.map(m => m.raw).join(' · '), 'conflict', 'several-amounts', { candidates: distinct });
    }
    money.filter(m => m.minor == null).forEach(m => push('budget', null, m.raw, m.status, m.note));

    return { fields, found, excluded, requirements, today, timeZone: tz };
  }

  CON.Parse = { LIMITS, normalize, parseNumber, findMoney, extract };
})(typeof window !== 'undefined' ? window : globalThis);
