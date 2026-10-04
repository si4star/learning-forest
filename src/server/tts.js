// Natural voice for "Read aloud", using Cloudflare Workers AI (binding: AI).
// Each phrase is generated once and stored in D1, so repeats cost nothing.
// Model and voice can be changed with the TTS_MODEL / TTS_VOICE environment variables.
const DEFAULTS = [
  { model: '@cf/deepgram/aura-1', voice: 'athena' },   // British English, female
  { model: '@cf/myshell-ai/melotts', voice: null },    // fallback model
];

export const normText = t => String(t || '').replace(/\s+/g, ' ').trim();
// Only the plain phrases the app says: words, numbers and light punctuation.
export const TEXT_OK = /^[A-Za-z0-9 ,.?'!:-]{1,200}$/;

export const ttsConfig = env => (env.TTS_MODEL ? `${env.TTS_MODEL}|${env.TTS_VOICE || ''}` : 'default');

export async function synth(env, text) {
  const tries = env.TTS_MODEL ? [{ model: env.TTS_MODEL, voice: env.TTS_VOICE || null }] : DEFAULTS;
  let last;
  for (const t of tries) {
    try {
      const input = t.model.includes('melotts') ? { prompt: text, lang: 'en' } : { text, ...(t.voice ? { speaker: t.voice } : {}) };
      const bytes = await toBytes(await env.AI.run(t.model, input));
      if (bytes && bytes.length > 100) return { mime: sniff(bytes), bytes };
      last = new Error(`${t.model}: no audio`);
    } catch (e) {
      last = e;
    }
    console.log('tts failed', t.model, last && last.message);
  }
  throw last || new Error('no audio');
}

// Workers AI audio models answer in different shapes: a stream, raw bytes, or base64 JSON.
export async function toBytes(out) {
  if (!out) return null;
  if (out instanceof ReadableStream || out instanceof Response) return new Uint8Array(await new Response(out.body ?? out).arrayBuffer());
  if (out instanceof ArrayBuffer) return new Uint8Array(out);
  if (ArrayBuffer.isView(out)) return new Uint8Array(out.buffer, out.byteOffset, out.byteLength);
  if (typeof out.audio === 'string') return Uint8Array.from(atob(out.audio), c => c.charCodeAt(0));
  return null;
}

export function sniff(b) {
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'audio/wav';
  if (b[0] === 0x4f && b[1] === 0x67 && b[2] === 0x67 && b[3] === 0x53) return 'audio/ogg';
  return 'audio/mpeg';
}
