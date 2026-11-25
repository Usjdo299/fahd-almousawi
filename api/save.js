const crypto = require('crypto');
const OWNER_REPO = process.env.GITHUB_REPO || 'Usjdo299/fahd-almousawi';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const h = (s) => crypto.createHash('sha256').update(String(s)).digest();

async function gh(path, opt = {}) {
  const r = await fetch('https://api.github.com/repos/' + OWNER_REPO + '/contents/' + path, {
    ...opt,
    headers: {
      Authorization: 'Bearer ' + process.env.GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'site-admin',
      ...(opt.headers || {}),
    },
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && r.status !== 404) throw new Error(j.message || 'GitHub error ' + r.status);
  return { status: r.status, json: j };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected || !process.env.GITHUB_TOKEN) return res.status(500).json({ error: 'Server not configured' });
  if (!crypto.timingSafeEqual(h(body.password), h(expected))) {
    await new Promise((r) => setTimeout(r, 1200));
    return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
  }
  try {
    if (body.action === 'check') return res.status(200).json({ ok: true });
    if (body.action === 'save') {
      const c = body.content;
      if (!c || typeof c !== 'object' || !c.hero || !c.about || !c.results || !c.contact) {
        return res.status(400).json({ error: 'محتوى غير صالح' });
      }
      const cur = await gh('content.json?ref=' + BRANCH);
      const text = JSON.stringify(c, null, 1);
      await gh('content.json', {
        method: 'PUT',
        body: JSON.stringify({
          message: 'Update content from admin',
          content: Buffer.from(text, 'utf8').toString('base64'),
          sha: cur.json.sha,
          branch: BRANCH,
        }),
      });
      return res.status(200).json({ ok: true });
    }
    if (body.action === 'upload') {
      const data = String(body.data || '');
      if (!data || data.length > 4000000) return res.status(400).json({ error: 'الصورة كبيرة جدًا' });
      const buf = Buffer.from(data, 'base64');
      if (!(buf[0] === 0xff && buf[1] === 0xd8)) return res.status(400).json({ error: 'JPEG only' });
      const path = 'uploads/' + Date.now() + '.jpg';
      await gh(path, {
        method: 'PUT',
        body: JSON.stringify({ message: 'Upload image', content: buf.toString('base64'), branch: BRANCH }),
      });
      return res.status(200).json({ ok: true, path });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
