/**
 * Bangla / Banglish / English keyword matching for the bot.
 * All matching is done on a normalized (lowercased, trimmed) string.
 */

export const normalize = (text: string) =>
  (text ?? '').toString().toLowerCase().replace(/\s+/g, ' ').trim()

const has = (normalized: string, list: string[]) => {
  const tokens = normalized.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
  return list.some((raw) => {
    const key = raw.trim().toLowerCase()
    if (!key) return false
    if (key.includes(' ')) return normalized.includes(key)
    if (key.length <= 2) return tokens.includes(key)
    return tokens.includes(key) || normalized.includes(key)
  })
}

export const HUMAN_KEYWORDS = [
  'human', 'agent', 'support', 'customer care', 'representative',
  'মানুষ', 'এজেন্ট', 'সাপোর্ট', 'কেয়ার', 'সাপোর্টার', 'লাইভ চ্যাট',
  'ejent', 'live chat',
]

export const RESUME_KEYWORDS = [
  'bot', 'auto', 'automatic', 'resume', 'চালাও', 'বট', 'অটো', 'বট চালাও',
]

export const BROWSE_KEYWORDS = [
  'menu', 'product', 'products', 'catalog', 'shop', 'order', 'start', 'browse',
  'পণ্য', 'প্রোডাক্ট', 'পণ্যসমূহ', 'মেনু', 'অর্ডার', 'কিনব', 'কিনতে', 'শপ',
  'দেখাও', 'লিস্ট', 'স্টার্ট', 'হাই', 'hello', 'hi', 'hey', 'সালাম', 'assalamu',
  'assalamu alaikum', 'আসসালামু আলাইকুম', 'সলাম',
]

export const YES_KEYWORDS = [
  'yes', 'y', 'ok', 'okay', 'confirm', 'sure', 'done', 'হ্যাঁ', 'হ্যাই', 'হ্যাঁ।',
  'ঠিক আছে', 'কনফার্ম', 'অর্ডার করি', 'করো', 'জি',
]

export const NO_KEYWORDS = [
  'no', 'n', 'cancel', 'stop', 'quit', 'না', 'বাতিল', 'বাদ', 'ক্যানসেল', 'থাম',
]

export const MORE_KEYWORDS = [
  'more', 'again', 'next', 'আরও', 'আবার', 'পরের', 'নেক্সট',
]

export const isHumanRequest = (t: string) => has(normalize(t), HUMAN_KEYWORDS)
export const isResumeRequest = (t: string) => has(normalize(t), RESUME_KEYWORDS)
export const isBrowseRequest = (t: string) => has(normalize(t), BROWSE_KEYWORDS)
export const isYes = (t: string) => has(normalize(t), YES_KEYWORDS)
export const isNo = (t: string) => has(normalize(t), NO_KEYWORDS)
export const isMore = (t: string) => has(normalize(t), MORE_KEYWORDS)

/** BD phone: 01[3-9]XXXXXXXX — also accepts +880 / 880 prefixes. */
export const BD_PHONE_REGEX = /^01[3-9]\d{8}$/

export function normalizePhone(raw: string): string | null {
  const digits = (raw ?? '').toString().replace(/[\s\-().+]/g, '')
  let candidate = digits
  if (candidate.startsWith('880')) candidate = `0${candidate.slice(3)}`
  if (candidate.startsWith('+880')) candidate = `0${candidate.slice(4)}`
  return BD_PHONE_REGEX.test(candidate) ? candidate : null
}

/** Delivery zone heuristic: inside Dhaka vs outside. */
export function isInsideDhaka(address: string) {
  const a = normalize(address)
  const inside = ['ঢাকা', 'dhaka', 'dhanmondi', 'gulshan', 'banani', 'uttara', 'mirpur', 'mohakhali', 'motijheel', 'bashundhara', 'rab']
  const outside = ['চট্টগ্রাম', 'chittagong', 'চিটাগাং', 'খুলনা', 'khulna', 'রাজশাহী', 'rajshahi', 'সিলেট', 'sylhet', 'বরিশাল', 'barishal', 'রংপুর', 'rangpur', 'ময়মনসিংহ', 'mymensingh', 'কক্সবাজার', 'cox', 'কুমিল্লা', 'cumilla', 'নোয়াখালী', 'noakhali']
  if (outside.some((k) => a.includes(k))) return false
  if (inside.some((k) => a.includes(k))) return true
  return true // default to inside charge when unknown
}

/** First integer found in a message (for quantity / product index). */
export function extractNumber(text: string): number | null {
  const match = (text ?? '').toString().match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}
