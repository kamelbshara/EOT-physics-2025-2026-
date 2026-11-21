// Automatic marking of written (FRQ) responses.
// Each question gets a rubric derived from its own worked solution: the numerical results it states and the key
// physics ideas it uses. A student's whole response (free text, LaTeX and structured boxes, in English or Arabic)
// is then read for those results and ideas in any equivalent form: scientific notation, fractions, π, roots,
// Arabic-Indic digits, any convertible unit, any order and any wording that contains an accepted synonym.
import { readFileSync } from 'node:fs'
import { keyed } from '../bank/steps.mjs'
const OVERRIDES = JSON.parse(readFileSync(new URL('../bank/rubric-overrides.json', import.meta.url), 'utf8'))
const FILE_OVERRIDES = { ...OVERRIDES }
// Rubrics edited by the teacher are stored in the progress database and take precedence over the shipped file.
export function setRuntimeRubrics(map) {
  for (const k of Object.keys(OVERRIDES)) delete OVERRIDES[k]
  Object.assign(OVERRIDES, FILE_OVERRIDES, map)
  cache.clear()
}
export const fileRubric = id => FILE_OVERRIDES[id] || null

// ---------------------------------------------------------------- units
const UNIT = new Map()
function def(dim, factor, ...aliases) { for (const a of aliases) UNIT.set(a.toLowerCase() === a ? a : a, { dim, factor, name: aliases[0] }) }
def('L', 1, 'm', 'metre', 'metres', 'meter', 'meters', 'م', 'متر', 'مترا', 'أمتار')
def('L', 1e-2, 'cm', 'centimetre', 'centimetres', 'centimeter', 'centimeters', 'سم')
def('L', 1e-3, 'mm', 'millimetre', 'millimetres', 'millimeter', 'millimeters', 'مم', 'ملم')
def('L', 1e3, 'km', 'kilometre', 'kilometres', 'kilometer', 'kilometers', 'كم')
def('L', 1e-9, 'nm', 'nanometre', 'nanometres', 'nanometer', 'nanometers', 'نانومتر', 'نانو متر')
def('L', 1e-6, 'μm', 'µm', 'um', 'micrometre', 'micrometer', 'ميكرومتر')
def('T', 1, 's', 'sec', 'secs', 'second', 'seconds', 'ث', 'ثانية', 'ثوان', 'ثواني')
def('T', 1e-3, 'ms', 'millisecond', 'milliseconds')
def('T', 60, 'min', 'mins', 'minute', 'minutes', 'دقيقة', 'دقائق')
def('T', 3600, 'h', 'hr', 'hrs', 'hour', 'hours', 'ساعة', 'ساعات')
def('V', 1, 'm/s', 'm s^-1', 'm s⁻¹', 'ms^-1', 'م/ث', 'م / ث')
def('V', 1 / 3.6, 'km/h', 'kmh', 'km/hr', 'كم/س', 'كم/ساعة', 'كم / ساعة')
def('V', 1e-2, 'cm/s', 'سم/ث')
def('A', 1, 'm/s²', 'm/s^2', 'm/s2', 'm s^-2', 'm s⁻²', 'm/s/s', 'م/ث²', 'م/ث^2', 'م/ث2')
def('A', 1e-2, 'cm/s²', 'cm/s^2')
def('ANG', Math.PI / 180, '°', 'deg', 'degree', 'degrees', 'درجة', 'درجات', 'º')
def('ANG', 1, 'rad', 'radian', 'radians', 'راديان', 'رad')
def('ANG', 2 * Math.PI, 'rev', 'revs', 'revolution', 'revolutions', 'دورة', 'دورات')
def('W', 1, 'rad/s', 'rad s^-1', 'rad s⁻¹', 'راديان/ث')
def('W', 2 * Math.PI / 60, 'rpm', 'rev/min', 'دورة/دقيقة')
def('W', 2 * Math.PI, 'rev/s', 'دورة/ث')
def('AL', 1, 'rad/s²', 'rad/s^2', 'rad/s2', 'rad s^-2', 'راديان/ث²')
def('F', 1, 'Hz', 'hz', 'hertz', 's^-1', 's⁻¹', '1/s', 'هيرتز', 'هرتز')
def('F', 1e3, 'kHz', 'khz'); def('F', 1e6, 'MHz', 'mhz'); def('F', 1e9, 'GHz', 'ghz'); def('F', 1e12, 'THz', 'thz')
def('E', 1, 'J', 'joule', 'joules', 'جول')
def('E', 1e3, 'kJ', 'kilojoule', 'kilojoules', 'كيلوجول')
def('E', 1.602176634e-19, 'eV', 'ev', 'electronvolt', 'electronvolts', 'electron volt', 'electron volts', 'إلكترون فولت', 'الكترون فولت')
def('E', 1.602176634e-16, 'keV'); def('E', 1.602176634e-13, 'MeV')
def('FO', 1, 'N', 'newton', 'newtons', 'نيوتن')
def('FO', 1e3, 'kN', 'kilonewton', 'kilonewtons')
def('TQ', 1, 'N·m', 'N.m', 'Nm', 'N m', 'N⋅m', 'N*m', 'نيوتن·م', 'نيوتن.م', 'نيوتن م')
def('TQ', 1e-2, 'N·cm', 'N.cm', 'N cm')
def('P', 1, 'kg·m/s', 'kg m/s', 'kgm/s', 'kg.m/s', 'kg⋅m/s', 'kg m s^-1', 'N·s', 'N.s', 'Ns', 'N s', 'N⋅s', 'كجم·م/ث', 'كجم.م/ث', 'نيوتن·ث', 'نيوتن.ث')
def('I', 1, 'kg·m²', 'kg m²', 'kgm²', 'kg.m²', 'kg m^2', 'kg·m^2', 'kg.m^2', 'kg⋅m²', 'كجم·م²', 'كجم.م²')
def('LM', 1, 'kg·m²/s', 'kg m²/s', 'kg.m²/s', 'kg m^2/s', 'kg·m^2/s', 'kg⋅m²/s', 'كجم·م²/ث')
def('H', 1, 'J·s', 'J.s', 'Js', 'J s', 'J⋅s', 'جول·ث', 'جول.ث')
def('H', 1.602176634e-19, 'eV·s', 'eV.s', 'eVs', 'eV s', 'إلكترون فولت·ث')
def('M', 1, 'kg', 'kilogram', 'kilograms', 'كجم', 'كغ', 'كيلوجرام', 'كيلوغرام')
def('M', 1e-3, 'g', 'gram', 'grams', 'جم', 'غ', 'غرام', 'جرام')
def('VO', 1, 'V', 'volt', 'volts', 'فولت')
def('PW', 1, 'W', 'watt', 'watts', 'واط')
def('VOL', 1e-6, 'mL', 'ml', 'مل', 'millilitre', 'milliliter', 'millilitres', 'milliliters')
def('VOL', 1e-3, 'L', 'litre', 'liter', 'litres', 'liters', 'لتر')
def('VOL', 1, 'm³', 'm^3', 'م³')
def('UNITS', 1, 'units', 'unit', 'وحدة', 'وحدات')
const ALIASES = [...UNIT.keys()].sort((a, b) => b.length - a.length)
const unitInfo = u => UNIT.get(u) || null

// ---------------------------------------------------------------- text normalisation
const SUP = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁻': '-', '⁺': '+' }
const fmt = v => { const n = Number(v.toPrecision(12)); return Math.abs(n) >= 1e-6 && Math.abs(n) < 1e15 || n === 0 ? String(n) : n.toExponential() }
function evaluateSimple(expr) {
  // Only digits, dots and the operators of a single product/quotient; anything else is left untouched.
  if (!/^[\d.+\-*/() ]+$/.test(expr)) return NaN
  try { return Function('"use strict";return (' + expr + ')')() } catch { return NaN }
}
export function normalise(src) {
  let s = String(src ?? '')
  s = s.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/[۰-۹]/g, c => String(c.charCodeAt(0) - 1776))
  s = s.replace(/٫/g, '.').replace(/[−–—]/g, '-').replace(/ /g, ' ')
  // LaTeX → plain
  s = s.replace(/\\left|\\right|\\displaystyle/g, '').replace(/\\[,;:! ]/g, ' ')
  s = s.replace(/\\(?:mathrm|text|operatorname|mathit)\{([^{}]*)\}/g, ' $1 ')
  s = s.replace(/\\(?:degree|circ)\b/g, '°').replace(/\^\{?\\circ\}?/g, '°').replace(/\\%/g, '%')
  s = s.replace(/\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}/g, '(($1)/($2))')
  s = s.replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
  s = s.replace(/\\(?:times|cdot|ast)(?![a-zA-Z])/g, '×').replace(/\\div(?![a-zA-Z])/g, '/')
  s = s.replace(/\\pi(?![a-zA-Z])/g, 'π').replace(/\\(?:lambda|theta|omega|alpha|tau|Delta|mu)(?![a-zA-Z])/g, ' ')
  s = s.replace(/\^\{([^{}]*)\}/g, '^($1)').replace(/_\{[^{}]*\}/g, '').replace(/[{}]/g, ' ')
  // superscripts: 10⁻⁷ → 10^(-7), m² → m^2 is kept as ² for unit aliases
  s = s.replace(/10([⁻⁺]?[⁰¹²³⁴⁵⁶⁷⁸⁹]+)/g, (_, e) => '10^(' + [...e].map(c => SUP[c]).join('') + ')')
  // scientific notation in every spelling → plain decimal
  s = s.replace(/(\d+(?:\.\d+)?|\.\d+)\s*(?:×|x|X|\*|·)\s*10\s*\^\s*\(?\s*([+-]?\d+)\s*\)?/g, (_, m, e) => fmt(Number(m) * 10 ** Number(e)))
  s = s.replace(/(\d+(?:\.\d+)?|\.\d+)[eE]([+-]?\d+)\b/g, (_, m, e) => fmt(Number(m) * 10 ** Number(e)))
  s = s.replace(/(?<![\w.])10\s*\^\s*\(?\s*([+-]?\d+)\s*\)?/g, (_, e) => fmt(10 ** Number(e)))
  // roots, π multiples and simple numeric fractions → decimals
  s = s.replace(/(\d+(?:\.\d+)?)?\s*√\s*\(?\s*(\d+(?:\.\d+)?)\s*\)?/g, (_, k, r) => fmt((k ? Number(k) : 1) * Math.sqrt(Number(r))))
  s = s.replace(/(\d+(?:\.\d+)?)?\s*(?:π|\bpi\b)(?:\s*\/\s*(\d+(?:\.\d+)?))?/g, (_, k, d) => fmt((k ? Number(k) : 1) * Math.PI / (d ? Number(d) : 1)))
  s = s.replace(/\(\(\s*([\d.+\-*/ ]+?)\s*\)\s*\/\s*\(\s*([\d.+\-*/ ]+?)\s*\)\)/g, (m, a, b) => { const v = evaluateSimple('(' + a + ')/(' + b + ')'); return Number.isFinite(v) ? fmt(v) : m })
  s = s.replace(/(?<![\d.\w/])(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)(?!\d|\.\d)/g, (m, a, b) => Number(b) ? fmt(Number(a) / Number(b)) : m)
  return s
}
const sigFigs = raw => { const d = raw.replace(/^[+-]/, '').replace(/^0+\.?0*/, ''); const digits = d.replace('.', '').replace(/^0+/, ''); return Math.max(1, (raw.includes('.') ? digits : digits.replace(/0+$/, '')).length || 1) }

// Every number in a text, with the unit written straight after it (if any).
export function quantities(text) {
  const s = normalise(text)
  const out = []
  const re = /(?<![\w.^])([+-]?\s?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?)(?!\d|\.\d)/g
  let m
  while ((m = re.exec(s))) {
    const raw = m[1].replace(/\s/g, '')
    const value = Number(raw)
    if (!Number.isFinite(value)) continue
    const rest = s.slice(m.index + m[0].length).replace(/^\s+/, '')
    let unit = null
    for (const a of ALIASES) {
      if (rest.startsWith(a)) {
        const next = rest.charAt(a.length)
        if (!next || !/[\p{L}\d²³^]/u.test(next) || a === '°') { unit = a; break }
      }
    }
    // a sign straight after a number or unit is an operator (90° − 34°), not part of the value
    let r = raw, v = value, idx = m.index, len = m[0].length, prevOp = false
    const lead = s.slice(0, m.index).replace(/\s+$/, '')
    if (/^[+-]/.test(raw) && /(?:\d\s*(?:°|[A-Za-zμ·/²³\u0600-\u06ff]{1,8})?|[)°²³])$/u.test(lead)) { r = raw.slice(1); v = Number(r); idx = m.index + m[0].indexOf(r); len = r.length; prevOp = true }
    else if (/[+\-×*/(^]$/.test(lead)) prevOp = true
    const tail = rest.slice(unit ? unit.length : 0).replace(/^\s+/, '')
    const nextOp = /^[+\-×*/^]\s*[\d(.π√]/.test(tail)
    out.push({ raw: r, value: v, sf: sigFigs(r), unit, index: idx, length: len, prevOp, nextOp })
  }
  return { text: s, list: out }
}

// ---------------------------------------------------------------- ideas (EN | AR synonyms; * = prefix match)
const IDEAS = [
  ['virtual focus', 'بؤرة وهمية', 'البؤرة الوهمية', 'بؤرة تقديرية'],
  ['virtual', 'virtual image', 'وهمي', 'وهمية', 'تقديري', 'تقديرية', '!real'],
  ['real', 'real image', 'حقيقي', 'حقيقية', '!virtual'],
  ['upright', 'erect', 'معتدل', 'معتدلة', '!inverted'],
  ['inverted', 'upside down', 'مقلوب', 'مقلوبة', '!upright'],
  ['enlarged', 'magnified', 'مكبر', 'مكبرة', 'أكبر', '!reduced'],
  ['reduced', 'diminished', 'مصغر', 'مصغرة', 'أصغر', '!enlarged'],
  ['behind the mirror', 'behind the lens', 'خلف المرآة', 'خلف العدسة', 'وراء المرآة'],
  ['in front of', 'أمام'],
  ['parallel', 'متواز*', 'موازي*'],
  ['perpendicular', 'normal to', 'عمودي*', 'متعامد*'],
  ['focus', 'focal point', 'بؤرة', 'البؤرة'],
  ['centre of curvature', 'center of curvature', 'مركز التكور', 'مركز الانحناء'],
  ['principal axis', 'المحور الرئيسي'],
  ['converging', 'convex lens', 'لامة', 'محدبة', 'مجمعة', '!diverging'],
  ['diverging', 'concave lens', 'مفرقة', 'مقعرة', '!converging'],
  ['refraction', 'refract*', 'انكسار', 'ينكسر', 'تنكسر'],
  ['reflection', 'reflect*', 'انعكاس', 'ينعكس', 'تنعكس'],
  ['total internal reflection', 'TIR', 'انعكاس كلي', 'الانعكاس الكلي الداخلي', 'انعكاس داخلي كلي'],
  ['critical angle', 'الزاوية الحرجة', 'زاوية حرجة'],
  ['toward the normal', 'towards the normal', 'closer to the normal', 'نحو العمود', 'يقترب من العمود', 'تقترب من العمود', 'يقترب الهدب من العمود', 'مقتربا من العمود', '!away from the normal'],
  ['away from the normal', 'away from it', 'يبتعد عن العمود', 'تبتعد عن العمود', 'مبتعدا عن العمود', '!toward the normal'],
  ['refractive index', 'index of refraction', 'معامل الانكسار'],
  ['dispersion', 'dispers*', 'تشتت', 'تفريق', 'تحلل'],
  ['wavelength', 'الطول الموجي', 'طول موجي', 'طول الموجة'],
  ['frequency', 'التردد', 'تردد'],
  ['coherent', 'متر*ابط*', 'مترابط*'],
  ['in phase', 'same phase', 'نفس الطور', 'متفق* في الطور', 'في الطور نفسه'],
  ['phase reversal', 'phase change', 'phase shift', 'π shift', 'half-wavelength shift', 'انقلاب الطور', 'انعكاس الطور', 'تغير في الطور', 'إزاحة طور'],
  ['path difference', 'فرق المسار', 'فرق المسافة'],
  ['constructive', 'reinforce*', 'بناء', 'بناءة', 'تقوية', '!destructive'],
  ['destructive', 'cancel*', 'هدام', 'هدامة', 'إلغاء', 'يلغي', 'تلغي', '!constructive'],
  ['bright', 'مضيء', 'مضيئة', 'لامع', 'لامعة', 'هدب مضيء', '!dark'],
  ['dark', 'معتم', 'معتمة', 'مظلم', 'مظلمة', '!bright'],
  ['interference', 'interfer*', 'تداخل', 'تتداخل', 'يتداخل', 'متداخل*'],
  ['diffraction', 'diffract*', 'حيود'],
  ['superposition', 'تراكب'],
  ['thin film', 'thin-film', 'غشاء رقيق', 'الأغشية الرقيقة', 'طبقة رقيقة'],
  ['thickness', 'سمك', 'سماكة'],
  ['grating', 'محزوز'],
  ['spectrum', 'spectra', 'spectral', 'طيف', 'أطياف'],
  ['absorption', 'absorb*', 'امتصاص', 'يمتص', 'تمتص'],
  ['emission', 'emit*', 'انبعاث', 'ينبعث', 'يطلق', 'تبعث', 'ابتعاث'],
  ['myopia', 'short-sighted*', 'nearsighted*', 'قصر النظر'],
  ['hyperopia', 'long-sighted*', 'farsighted*', 'طول النظر'],
  ['retina', 'شبكية'],
  ['spherical aberration', 'الزيغ الكروي', 'زيغ كروي'],
  ['chromatic aberration', 'الزيغ اللوني', 'زيغ لوني'],
  ['increase', 'increas*', 'larger', 'greater', 'higher', 'rises', 'يزداد', 'تزداد', 'يزيد', 'تزيد', 'زيادة', 'يكبر', 'يرتفع', '!decrease'],
  ['decrease', 'decreas*', 'smaller', 'lower', 'reduces', 'falls', 'يقل', 'تقل', 'يتناقص', 'تتناقص', 'نقصان', 'يصغر', 'ينخفض', '!increase'],
  ['doubles', 'twice', 'double', 'factor of 2', 'يتضاعف', 'تتضاعف', 'الضعف', 'ضعف', 'مثلي'],
  ['halves', 'half', 'النصف', 'نصف', 'يقل للنصف'],
  ['unchanged', 'constant', 'stays the same', 'remains the same', 'ثابت', 'ثابتة', 'لا يتغير', 'لا تتغير', 'يبقى', 'تبقى'],
  ['zero', 'صفر', 'صفرا', 'منعدم'],
  ['proportional', 'proportion*', 'يتناسب', 'تتناسب', 'طردي*'],
  ['inversely proportional', 'inverse*', 'عكسي*', 'يتناسب عكسيا'],
  ['conserved', 'conservation', 'conserv*', 'محفوظ', 'محفوظة', 'حفظ', 'يبقى ثابتا'],
  ['momentum', 'الزخم', 'زخم', 'كمية الحركة'],
  ['impulse', 'الدفع', 'دفع'],
  ['angular momentum', 'الزخم الزاوي', 'زخم زاوي'],
  ['moment of inertia', 'rotational inertia', 'عزم القصور', 'القصور الذاتي الدوراني', 'قصور دوراني'],
  ['torque', 'moment of force', 'العزم', 'عزم الدوران', 'عزم القوة'],
  ['lever arm', 'moment arm', 'ذراع القوة', 'ذراع العزم', 'ذراع'],
  ['centre of mass', 'center of mass', 'centre of gravity', 'center of gravity', 'مركز الكتلة', 'مركز الثقل'],
  ['equilibrium', 'balanced', 'اتزان', 'متزن', 'توازن'],
  ['net force', 'resultant force', 'القوة المحصلة', 'محصلة القوى', 'القوة الكلية'],
  ['external torque', 'العزم الخارجي', 'عزم خارجي'],
  ['isolated', 'closed system', 'معزول', 'معزولة', 'مغلق'],
  ['angular velocity', 'angular speed', 'السرعة الزاوية', 'سرعة زاوية'],
  ['angular acceleration', 'التسارع الزاوي', 'تسارع زاوي'],
  ['tangential', 'مماسي', 'مماسية', 'المماسي'],
  ['radius', 'radii', 'نصف القطر', 'نصف قطر', 'أنصاف'],
  ['axis', 'axis of rotation', 'المحور', 'محور الدوران', 'محور'],
  ['coriolis', 'كوريوليس'],
  ['rotating frame', 'rotating reference frame', 'إطار دوار', 'إطار مرجعي دوار', 'الإطار الدوار'],
  ['inertial', 'قصوري', 'إطار قصوري'],
  ['elastic', 'مرن', 'مرنة', '!inelastic'],
  ['inelastic', 'غير مرن', 'غير مرنة', '!elastic'],
  ['kinetic energy', 'KE', 'الطاقة الحركية', 'طاقة الحركة', 'طاقة حركية'],
  ['potential energy', 'PE', 'GPE', 'طاقة الوضع', 'الطاقة الكامنة', 'طاقة كامنة'],
  ['elastic potential energy', 'طاقة الوضع المرونية', 'الطاقة المرونية', 'طاقة مرونية'],
  ['rest energy', 'mc²', 'mc^2', 'طاقة السكون'],
  ['work', 'الشغل', 'شغل'],
  ['thermal energy', 'internal energy', 'heat', 'الطاقة الحرارية', 'طاقة حرارية', 'حرارة', 'الطاقة الداخلية'],
  ['photon', 'فوتون', 'الفوتون', 'فوتونات'],
  ['photoelectron', 'photoelectric', 'إلكترون ضوئي', 'الإلكترونات الضوئية', 'الكهروضوئي'],
  ['threshold frequency', 'cut-off frequency', 'تردد العتبة', 'التردد الحرج'],
  ['work function', 'دالة الشغل', 'اقتران الشغل'],
  ['stopping potential', 'stopping voltage', 'جهد الإيقاف', 'جهد القطع'],
  ['intensity', 'brightness', 'الشدة', 'شدة'],
  ['quantised', 'quantized', 'quanta', 'quantum', 'مكمم', 'مكممة', 'كمات'],
  ['blackbody', 'black body', 'black-body', 'الجسم الأسود', 'جسم أسود'],
  ['de broglie', 'matter wave', 'دي برولي', 'موجة مادية'],
  ['uncertainty', 'عدم التحديد', 'عدم اليقين', 'الشك'],
  ['compton', 'كومبتون'],
  ['nucleus', 'nuclei', 'نواة', 'النواة'],
  ['energy level', 'energy state', 'مستوى طاقة', 'مستويات الطاقة', 'مستوى الطاقة'],
  ['ground state', 'الحالة الأرضية', 'المستوى الأرضي'],
  ['excited', 'مثار', 'مثارة', 'إثارة'],
  ['ionization', 'ionisation', 'ionize*', 'ionise*', 'تأين'],
  ['stimulated emission', 'الانبعاث المحفز', 'انبعاث محفز', 'الانبعاث المستحث'],
  ['population inversion', 'انقلاب الإسكان', 'انعكاس التوزيع', 'انقلاب التوزيع'],
  ['balmer', 'بالمر'], ['lyman', 'ليمان'], ['paschen', 'باشن'],
  ['displacement', 'الإزاحة', 'إزاحة'],
  ['distance', 'المسافة', 'مسافة'],
  ['velocity', 'السرعة المتجهة', 'سرعة متجهة'],
  ['speed', 'السرعة', 'سرعة', 'السرعة القياسية'],
  ['acceleration', 'التسارع', 'تسارع'],
  ['slope', 'gradient', 'الميل', 'ميل'],
  ['area under', 'area', 'المساحة', 'مساحة'],
  ['tangent', 'المماس', 'مماس'],
  ['free fall', 'freely falling', 'السقوط الحر', 'سقوط حر'],
  ['vector', 'متجه', 'متجهة', 'كمية متجهة', '!scalar'],
  ['scalar', 'قياسي', 'قياسية', 'كمية قياسية', '!vector'],
  ['direction', 'الاتجاه', 'اتجاه'],
  ['magnitude', 'المقدار', 'مقدار'],
  ['opposite', 'opposite direction', 'معاكس', 'معاكسة', 'عكس', 'متعاكس*'],
  ['same direction', 'نفس الاتجاه', 'الاتجاه نفسه'],
  ['speeding up', 'speeds up', 'تتزايد سرعته', 'تزداد سرعته', 'متسارع'],
  ['slowing down', 'slows down', 'تتناقص سرعته', 'تقل سرعته', 'متباطئ'],
  ['uniform', 'منتظم', 'منتظمة', '!non-uniform'],
  ['non-uniform', 'nonuniform', 'غير منتظم', 'غير منتظمة'],
  ['instantaneous', 'لحظي', 'لحظية', 'اللحظية'],
  ['average', 'mean', 'متوسط', 'متوسطة', 'المتوسطة'],
  ['precision', 'precise', 'الدقة', 'دقيق', 'دقيقة', 'تقارب القراءات'],
  ['accuracy', 'accurate', 'الضبط', 'مضبوط', 'صحة القياس'],
  ['uncertainty in measurement', 'measurement uncertainty', 'عدم اليقين في القياس', 'خطأ القياس'],
  ['independent variable', 'المتغير المستقل', 'متغير مستقل'],
  ['dependent variable', 'المتغير التابع', 'متغير تابع'],
  ['controlled variable', 'control variable', 'constant variable', 'المتغير الضابط', 'متغيرات ضابطة', 'المتغيرات الثابتة'],
  ['hypothesis', 'فرضية', 'الفرضية'],
  ['theory', 'نظرية', 'النظرية'],
  ['law', 'قانون', 'القانون'],
  ['model', 'نموذج', 'النموذج'],
  ['base quantity', 'base quantities', 'are base', 'كمية أساسية', 'كميات أساسية', 'أساسية'],
  ['derived quantity', 'derived quantities', 'are derived', 'كمية مشتقة', 'كميات مشتقة', 'مشتقة', 'مشتقتان'],
  ['significant figures', 'significant digits', 'الأرقام المعنوية', 'أرقام معنوية'],
  ['linear', 'خطي', 'خطية', 'علاقة خطية'],
  ['quadratic', 'تربيعي', 'تربيعية'],
]
const GENERIC = new Set(['speed', 'direction', 'magnitude', 'average', 'model', 'law', 'theory', 'axis', 'radius', 'area under', 'distance', 'focus', 'same direction', 'in front of', 'work', 'zero', 'unchanged', 'increase', 'decrease', 'reflection', 'refraction', 'velocity', 'acceleration', 'displacement', 'interference', 'frequency', 'wavelength', 'spectrum', 'intensity', 'momentum', 'torque', 'photon', 'emission', 'absorption'])
const arNorm = s => s.normalize('NFKC').replace(/[ً-ْـ]/g, '').replace(/[إأآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
const isArabic = s => /[؀-ۿ]/.test(s)
const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function pattern(term) {
  const prefix = term.endsWith('*')
  const body = prefix ? term.slice(0, -1) : term
  // a term that starts with a digit (0–2 s) may follow a letter directly, as in من0–2
  const left = /^\d/.test(body) ? '(?:^|[^\\d.])' : '(?:^|[^\\p{L}])'
  if (isArabic(body)) {
    const core = escape(arNorm(body)).replace(/\s+/g, '\\s+')
    return new RegExp(left + '(?:[وفبلك]?(?:ال)?)' + core + (prefix ? '\\p{L}*' : '(?:ه|ات|ين|ون|ان|ي|يه|ها|ا)?') + '(?=[^\\p{L}]|$)', 'u')
  }
  return new RegExp(left + escape(body.normalize('NFKC').toLowerCase()).replace(/\s+/g, '[\\s-]+') + (prefix ? '\\p{L}*' : '(?:s|es|d|ed)?') + '(?=[^\\p{L}]|$)', 'u')
}
const IDEA_INDEX = IDEAS.map(([key, ...rest]) => {
  const terms = [key, ...rest.filter(t => !t.startsWith('!'))]
  return { key, terms, opposites: rest.filter(t => t.startsWith('!')).map(t => t.slice(1)), en: terms.filter(t => !isArabic(t)).map(pattern), ar: terms.filter(isArabic).map(pattern) }
})
const prep = text => ' ' + arNorm(String(text || '').replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/٫/g, '.')).replace(/[−–—]/g, '-').toLowerCase() + ' '
const LEAD = new Map()
const findIdea = key => LEAD.get(key) || IDEA_INDEX.find(i => i.key === key)
// An opposite phrase is removed first, so غير مرنة (inelastic) never counts as مرنة (elastic).
function mentions(idea, text, lang) {
  let t = text
  for (const o of idea.opposites) { const oi = findIdea(o); if (oi) for (const re of [...oi.en, ...oi.ar]) t = t.replace(new RegExp(re.source, 'gu'), ' ') }
  const groups = lang === 'en' ? idea.en : lang === 'ar' ? idea.ar : [...idea.en, ...idea.ar]
  if (idea.all) return groups.some(group => group.every(re => re.test(t)))   // every content word of one language
  return groups.some(re => re.test(t))
}

// ---------------------------------------------------------------- rubric
const sentences = text => String(text || '').split(/(?<=[.!?؟؛])\s+|\n+/).filter(Boolean)
function blankSentence(text, raw) {
  for (const line of sentences(text)) {
    const n = normalise(line)
    // the whole written number only: 2 must not match inside 2.0 or 12
    const m = new RegExp('(?<![\\d.])' + raw.replace(/[.+]/g, c => '\\' + c) + '(?:\\.0+)?(?![\\d]|\\.\\d)').exec(n)
    if (m) return n.slice(0, m.index) + '_____' + n.slice(m.index + m[0].length)
  }
  return null
}
function cloze(text, idea, lang) {
  const res = lang === 'en' ? idea.en : idea.ar
  for (const line of sentences(text)) {
    const p = prep(line)
    for (const re of res) { const m = p.match(re); if (m) { const start = m.index + (m[0].match(/^[^\p{L}]/u) ? 1 : 0); return p.slice(1, start) + '_____' + p.slice(m.index + m[0].length).trimEnd() } }
  }
  return null
}
const STOP = new Set('the a an it its is are be to of and or then so in on at by for with as this that from same each both one two light ray rays image wave waves value answer سيكون هو هي في من على إلى الى عن ثم أو او و مع ذلك هذا هذه التي الذي كل الضوء ضوء الشعاع الأشعة الصورة قيمة'.split(' '))
// Arabic counterparts for one-word answers when the Arabic solution has no short opening sentence.
const ANSWER_WORDS = { red: 'أحمر', violet: 'بنفسجي', green: 'أخضر', blue: 'أزرق', white: 'أبيض', yellow: 'أصفر', dashed: 'متقطع*', diverges: 'متباعد*', diverge: 'متباعد*', converges: 'متقارب*', yes: 'نعم', no: 'لا', toward: 'نحو', towards: 'نحو', away: 'يبتعد', left: 'يسار*', right: 'يمين*', east: 'شرق*', west: 'غرب*', north: 'شمال*', south: 'جنوب*', overlap: 'تتداخل', larger: 'أكبر', smaller: 'أصغر', wider: 'أعرض', narrower: 'أضيق', closer: 'أقرب', farther: 'أبعد', vertex: 'الرأس', between: 'بين' }
// The first sentence of many worked solutions is the short answer itself ("Red light.", "−2.0.", "Dashed lines.").
function leadAnswer(text) {
  const first = sentences(text)[0] || ''
  const words = first.replace(/[.,;:!؟?،؛]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (!first || words.length > 5 || /[=≈]/.test(first) || /^(let|use|using|take|for|since|because|system|choose|define|assume|from|with|at|in|the)\b/i.test(first)) return null
  return { sentence: first, words: words.filter(w => !STOP.has(arNorm(w).toLowerCase()) && !STOP.has(w.toLowerCase()) && !/^[\d.+\-−]+$/.test(w)) }
}
function solutionNumbers(q) {
  const given = new Set(quantities(q.question_en).list.map(x => x.value).concat(quantities(q.question_ar).list.map(x => x.value)))
  const fromAnswer = q.answer && !/see worked solution/i.test(q.answer)
  const source = fromAnswer ? q.answer : q.solution_en
  const { text, list } = quantities(source)
  const ar = new Set(quantities(q.solution_ar + ' ' + (q.answer || '')).list.map(x => Math.abs(x.value)))
  const lead = !fromAnswer && leadAnswer(q.solution_en)
  const leadEnd = lead ? normalise(lead.sentence).length : -1
  const picked = []
  for (const x of list) {
    const before = text.slice(Math.max(0, x.index - 24), x.index)
    const after = text.slice(x.index + x.length, x.index + x.length + 2)
    const inLead = x.index < leadEnd
    const afterEquals = /[=≈]\s*[+-]?\s*$/.test(before)
    const isResult = fromAnswer || inLead || x.unit || afterEquals || /\b(?:gives?|is|are|equals?|about|becomes?)\s*[+-]?\s*$/.test(before)
    if (!isResult) continue
    if (!x.unit && /^\s*[\p{L}(×*/^]/u.test(after)) continue                    // a coefficient such as 2λL/w
    // n = 2, m = 1: a bare small integer assigned to a single symbol is a label, not a result
    if (!fromAnswer && !inLead && !x.unit && !x.raw.includes('.') && Math.abs(x.value) <= 3 && (!afterEquals || /(?:^|[\s(,;])[A-Za-zα-ωθλ]\s*[=≈]\s*[+-]?\s*$/.test(before))) continue
    if (!fromAnswer && !inLead && given.has(x.value) && !afterEquals) continue
    if (!fromAnswer && !ar.has(Math.abs(x.value))) continue
    if (!fromAnswer && !inLead && (x.prevOp || x.nextOp)) continue   // operands: keep only the result of 2.0 + 2.0 = 4.0
    picked.push(x)
  }
  // one value stated twice (55/135 = 0.407407…, then 0.407 m; −8 cm, then 8 cm) is one result: keep the clearer form
  const kept = []
  for (const x of picked) {
    const rounded = (a, b) => Number(Math.abs(a.value).toPrecision(Math.min(b.sf, 15))) === Math.abs(b.value)
    const twin = kept.findIndex(p => (p.unit === x.unit || !p.unit || !x.unit || unitInfo(p.unit)?.dim === unitInfo(x.unit)?.dim) && (Math.abs(Math.abs(p.value) - Math.abs(x.value)) <= 0.011 * Math.abs(x.value || 1) || rounded(p, x) || rounded(x, p)))
    if (twin < 0) { kept.push(x); continue }
    const p = kept[twin]
    const better = (x.unit && !p.unit) || (!!x.unit === !!p.unit && x.raw.length < p.raw.length && Math.sign(x.value) === Math.sign(p.value))
    if (better) kept[twin] = { ...x, value: Math.sign(p.value) < 0 && x.value > 0 && /^[+-]/.test(p.raw) ? -x.value : x.value }
  }
  return kept.slice(-6)
}
const cache = new Map()
export function rubricFor(q) {
  const id = q.id + '|' + (q.solution_en || '').length
  if (cache.has(id)) return cache.get(id)
  const override = OVERRIDES[q.id] || (q.base_id && OVERRIDES[q.base_id])
  if (override) {
    const numbers = (override.numbers || []).map(([value, unit]) => ({ value, unit, raw: String(value), sf: Math.max(2, sigFigs(String(value))), en: blankSentence(q.solution_en, String(value)), ar: blankSentence(q.solution_ar, String(value)) }))
    const ideas = (override.ideas || []).map((o, k) => {
      if (o.key) { const i = findIdea(o.key); return { key: o.key, en: cloze(q.solution_en, i, 'en'), ar: cloze(q.solution_ar, i, 'ar') } }
      const key = 'custom:' + q.id + ':' + k
      LEAD.set(key, { key, opposites: [], en: (o.en || []).map(pattern), ar: (o.ar || []).map(pattern) })
      return { key, en: cloze(q.solution_en, LEAD.get(key), 'en'), ar: cloze(q.solution_ar, LEAD.get(key), 'ar') }
    })
    const rubric = { numbers, ideas, drawing: /\b(sketch|draw|construct|label)\b|ارسم/i.test(q.question_en + ' ' + q.question_ar) }
    cache.set(id, rubric)
    return rubric
  }
  const numbers = []
  const markId = keyed[q.base_id] && q.kind === q.original_kind && !q.revised_content ? q.base_id : q.id
  if (keyed[markId]) {
    for (const [en, ar, value, unit] of keyed[markId]) numbers.push({ value, unit: UNIT.has(unit) ? unit : null, raw: String(Number(value.toPrecision(4))), sf: 3, en, ar })
  } else {
    for (const x of solutionNumbers(q)) {
      numbers.push({ value: x.value, unit: x.unit, raw: x.raw, sf: x.sf, en: blankSentence(q.solution_en, x.raw) || blankSentence(q.answer, x.raw), ar: blankSentence(q.solution_ar, x.raw) })
    }
  }
  const solEn = prep(q.solution_en + ' ' + (q.answer || '')), solAr = prep(q.solution_ar), qEn = prep(q.question_en), qAr = prep(q.question_ar)
  let ideas = IDEA_INDEX.filter(i => mentions(i, solEn, 'en') && mentions(i, solAr, 'ar'))
  // a more specific idea absorbs a general one it contains (virtual focus ⊃ focus, angular momentum ⊃ momentum)
  ideas = ideas.filter(i => !ideas.some(j => j !== i && j.key.includes(i.key)))
  const fresh = ideas.filter(i => !mentions(i, qEn, 'en') && !mentions(i, qAr, 'ar'))
  const specific = [...fresh.filter(i => !GENERIC.has(i.key)), ...ideas.filter(i => !fresh.includes(i) && !GENERIC.has(i.key))]
  // numerical questions are marked on their results; only clearly specific ideas are added to them
  const ranked = numbers.length ? specific : [...specific, ...fresh.filter(i => GENERIC.has(i.key))]
  const limit = numbers.length ? 2 : 3
  const chosen = ranked.slice(0, limit).map(i => ({ key: i.key, en: cloze(q.solution_en, i, 'en'), ar: cloze(q.solution_ar, i, 'ar') }))
  // A worded short answer that the lexicon does not cover becomes its own idea: all its content words (EN or AR).
  const leadEn = leadAnswer(q.solution_en), leadAr = leadAnswer(q.solution_ar)
  const arWords = leadAr?.words.length ? leadAr.words : leadEn?.words.every(w => ANSWER_WORDS[w.toLowerCase()]) ? leadEn.words.map(w => ANSWER_WORDS[w.toLowerCase()]) : null
  if (leadEn?.words.length && leadEn.words.length <= 3 && arWords && !numbers.some(n => normalise(leadEn.sentence).includes(n.raw))) {
    const covered = chosen.some(c => mentions(findIdea(c.key), prep(leadEn.sentence), 'en'))
    if (!covered) {
      const key = 'lead:' + leadEn.words.join(' ')
      LEAD.set(key, { key, opposites: [], en: [leadEn.words.map(w => pattern(w.toLowerCase().replace(/(?:s|es|ed|ing)$/, '') + '*'))], ar: [arWords.map(w => pattern(w))], all: true })
      chosen.unshift({ key, en: '_____', ar: '_____', lead: { en: leadEn.sentence, ar: leadAr?.words.length ? leadAr.sentence : arWords.join(' ').replace(/\*/g, '') } })
      if (chosen.length > limit + 1) chosen.pop()
    }
  }
  const drawing = /\b(sketch|draw|construct|label)\b|ارسم|ارسمي|ارسموا/i.test(q.question_en + ' ' + q.question_ar)
  const rubric = { numbers, ideas: chosen, drawing }
  cache.set(id, rubric)
  return rubric
}

// ---------------------------------------------------------------- marking
function close(a, b, targetSf, studentSf) {
  if (b === 0) return Math.abs(a) < 1e-9
  if (Math.abs(a - b) <= Math.abs(b) * 0.005) return true
  // a correctly rounded value at the target's own precision (or better) is always accepted
  const sf = Math.max(Math.min(targetSf || 3, 3), 2)
  return studentSf >= sf && Number(b.toPrecision(studentSf)) === Number(a.toPrecision(studentSf))
}
function judgeNumber(target, found) {
  const t = unitInfo(target.unit)
  let best = 'missing', hit = null
  const rank = { correct: 5, sign: 4, scale: 3, unit: 2, missing: 0 }
  for (const x of found) {
    const u = unitInfo(x.unit)
    let code = null
    if (u && t && u.dim !== t.dim) { if (close(Math.abs(x.value), Math.abs(target.value), target.sf, x.sf)) code = 'unit' }
    else {
      const a = u && t ? x.value * u.factor / t.factor : x.value
      if (close(a, target.value, target.sf, x.sf)) code = 'correct'
      else if (close(-a, target.value, target.sf, x.sf)) code = 'sign'
      else if (a && target.value && [2, 3, 6, 9].some(n => Math.abs(Math.abs(Math.log10(Math.abs(a / target.value))) - n) < 0.002)) code = 'scale'
    }
    if (code && rank[code] > rank[best]) { best = code; hit = x }
  }
  return { code: best, hit, unitMissing: best === 'correct' && t && t.dim !== 'UNITS' && !hit?.unit }
}
function responseText(draft) {
  const parts = (draft.parts || []).map(p => p?.value ? p.value + (p.unit ? ' ' + p.unit : '') : '').filter(Boolean)
  return [...parts, draft.text || '', draft.latex || ''].filter(Boolean).join('\n')
}
// Split a text into display segments, marking the given character ranges.
function segments(text, ranges) {
  const out = []; let at = 0
  for (const r of ranges.filter(r => r.start >= 0).sort((a, b) => a.start - b.start)) {
    if (r.start < at) continue
    if (r.start > at) out.push({ t: text.slice(at, r.start) })
    out.push({ t: text.slice(r.start, r.end), m: r.m }); at = r.end
  }
  if (at < text.length) out.push({ t: text.slice(at) })
  return out
}
// The normalised text used for matching, with a map from each of its characters back to the original text.
function prepMap(text) {
  let out = ''; const map = []
  const src = String(text || '')
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (/[\u064B-\u0652\u0640]/.test(c)) continue
    for (const ch of prep(c).slice(1, -1)) { out += ch; map.push(i) }
  }
  return { out, map }
}
function ideaRanges(text, idea, m) {
  const { out, map } = prepMap(text); const ranges = []
  const padded = ' ' + out + ' '
  for (const re of [...idea.en, ...idea.ar].flat()) {
    const g = new RegExp(re.source, 'gu'); let x
    while ((x = g.exec(padded))) {
      const lead = /^[^\p{L}\d]/u.test(x[0]) ? 1 : 0
      const a = x.index + lead - 1, b = x.index + x[0].length - 2
      if (a >= 0 && b < map.length && b >= a) ranges.push({ start: map[a], end: map[b] + 1, m })
      if (!x[0].length) g.lastIndex++
    }
  }
  return ranges
}
export function grade(q, draft) {
  const rubric = rubricFor(q)
  const total = rubric.numbers.length + rubric.ideas.length
  const studentRaw = responseText(draft)
  if (!total || !studentRaw.trim()) return { total, score: 0, verdict: total ? 'empty' : 'manual', items: [], drawing: rubric.drawing }
  const { text: studentText, list } = quantities(studentRaw)
  const student = prep(studentRaw)
  const items = [], studentRanges = []
  // a number the student wrote counts once: exact matches are assigned first, then near misses from what is left
  const used = new Set()
  const exactHits = rubric.numbers.map((n, k) => {
    const r = judgeNumber(n, list.filter(x => !used.has(x)))
    if (r.code === 'correct') { used.add(r.hit); return r }
    // two results with the same value (displacement and distance both 62.5 m) may share one written number
    const twin = rubric.numbers.slice(0, k).some(p => p.value === n.value && p.unit === n.unit)
    const again = twin && judgeNumber(n, list)
    return again?.code === 'correct' ? again : null
  })
  for (const [k, n] of rubric.numbers.entries()) {
    const r = exactHits[k] || judgeNumber(n, list.filter(x => !used.has(x)))
    if (!exactHits[k] && r.hit) used.add(r.hit)
    items.push({ type: 'number', code: r.code, ok: r.code === 'correct', unitMissing: r.unitMissing, unit: n.unit, en: n.en, ar: n.ar, expected: n.raw + (n.unit ? ' ' + n.unit : '') })
    if (r.hit) studentRanges.push({ start: r.hit.index, end: r.hit.index + r.hit.length, m: r.code === 'correct' ? 'hit' : 'warn' })
  }
  for (const i of rubric.ideas) {
    const idea = findIdea(i.key)
    let ok = mentions(idea, student)
    const opposite = !ok && idea.opposites.some(o => mentions(findIdea(o) || { en: [pattern(o)], ar: [] }, student))
    items.push({ type: 'idea', code: ok ? 'correct' : opposite ? 'opposite' : 'missing', ok, key: i.key, en: i.en, ar: i.ar })
  }
  const score = items.filter(i => i.ok).length
  const verdict = score === total ? 'correct' : score / total >= 0.5 ? 'partial' : 'incorrect'
  // comparison view: the student's own text and the original model solution, with rubric matches marked
  const shown = studentRaw.trim()
  const sameLength = (a, b) => a.length === b.length
  const shownRanges = []
  for (const i of rubric.ideas) shownRanges.push(...ideaRanges(shown, findIdea(i.key), items.find(x => x.key === i.key)?.ok ? 'hit' : 'warn'))
  // locate a number in the original text by its written digits (4.57 of 4.57×10^14, Arabic-Indic digits included)
  const latinShown = shown.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/٫/g, '.')
  const digitForms = v => { const a = Math.abs(v); return [...new Set([String(a), Number(a.toPrecision(3)).toString(), a.toExponential().split('e')[0], Number(a.toExponential(2).split('e')[0]).toString()])].filter(f => f.length) }
  const locate = (text, forms, taken) => {
    for (const f of forms) { let at = -1; while ((at = text.indexOf(f, at + 1)) >= 0) { const before = text.charAt(at - 1), after = text.charAt(at + f.length); if (/[\d.]/.test(before) || /\d/.test(after) || (after === '.' && /\d/.test(text.charAt(at + f.length + 1)))) continue; if (!taken.some(r => at < r.end && at + f.length > r.start)) return { start: at, end: at + f.length } } }
    return null
  }
  items.forEach((it, k) => {
    if (it.type !== 'number' || it.code === 'missing') return
    const r = judgeNumber(rubric.numbers[k], quantities(studentRaw).list)
    const spot = r.hit && locate(latinShown, [r.hit.raw.replace(/^[+-]/, ''), ...digitForms(r.hit.value)], shownRanges)
    if (spot) shownRanges.push({ ...spot, m: it.ok ? 'hit' : 'warn' })
  })
  const model = lang => {
    const text = String(lang === 'en' ? q.solution_en : q.solution_ar), ranges = []
    const latin = text.replace(/[٠-٩]/g, c => String(c.charCodeAt(0) - 1632)).replace(/٫/g, '.')
    rubric.numbers.forEach((n, k) => { const spot = locate(latin, [n.raw.replace(/^[+-]/, ''), ...digitForms(n.value)], ranges); if (spot) ranges.push({ ...spot, m: items[k].ok ? 'hit' : 'miss' }) })
    for (const i of rubric.ideas) ranges.push(...ideaRanges(text, findIdea(i.key), items.find(x => x.key === i.key)?.ok ? 'hit' : 'miss'))
    return segments(text, ranges)
  }
  // reasoning check without any external service: an "explain/why" question needs a stated reason
  const asks = /\b(explain|why|justify|account for|reason)\b|فسر|فسّر|علل|علّل|لماذا|وضح|وضّح|برر|برّر/i.test(q.question_en + ' ' + q.question_ar)
  const gives = /\b(because|since|so|therefore|thus|hence|as a result|due to|this means)\b|لأن|لان|بسبب|إذن|اذن|لذلك|لذا|بما أن|بما ان|حيث|مما يعني|وبالتالي|نتيجة/i.test(studentRaw)
  const reasoning = { asks, gives, unitsMissing: items.filter(i => i.unitMissing).length }
  return { total, score, verdict, items, reasoning, drawing: rubric.drawing, compare: { student: segments(shown, shownRanges), en: model('en'), ar: model('ar') } }
}
