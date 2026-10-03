export type ParsedEsim = {
  orderNo: string | null;
  iccid: string;
  planName: string | null;
  country: string | null;
  smdp: string;
  activationCode: string;
  lpa: string;
};

const ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|td|th|li|h[1-6]|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

const LABEL_CONTINUATION = /^(啟用碼|卡號|位址|地址)$/;

function findField(lines: string[], label: RegExp): string | null {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!label.test(line)) continue;
    const rest = line.replace(label, "").replace(/^[\s:：|]+/, "").trim();
    if (rest && !LABEL_CONTINUATION.test(rest)) return rest;
    for (let j = i + 1; j < lines.length; j++) {
      if (LABEL_CONTINUATION.test(lines[j])) continue;
      return lines[j];
    }
  }
  return null;
}

export function countryFromPlanName(planName: string | null): string | null {
  if (!planName) return null;
  return planName.match(/[\u4e00-\u9fff]{2,}/)?.[0] ?? null;
}

function parseSegment(lines: string[]): ParsedEsim | null {
  const joined = lines.join("\n");
  const lpaMatch = joined.match(/LPA:1\$([^$\s]+)\$([A-Z0-9-]+)/i);

  const iccidRaw = findField(lines, /^ICCID(\s*\/\s*卡號)?/i);
  const iccid = iccidRaw?.replace(/\s/g, "").match(/\d{18,22}/)?.[0] ?? null;

  const smdp =
    lpaMatch?.[1] ??
    findField(lines, /^SM-?DP\+?[_\s]*(位址|地址|Address)?/i)?.replace(/\s/g, "") ??
    null;

  const activationRaw =
    lpaMatch?.[2] ??
    findField(lines, /^Activation[_\s]*Code(\s*啟用碼)?/i) ??
    null;
  const activationCode = activationRaw?.replace(/\s/g, "") ?? null;

  if (!iccid || !smdp || !activationCode) return null;
  if (!/^[A-Z0-9-]{8,}$/i.test(activationCode)) return null;
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(smdp)) return null;

  const planName = findField(lines, /^方案名稱/);
  const orderNo = findField(lines, /^訂單編號/);

  return {
    orderNo,
    iccid,
    planName,
    country: countryFromPlanName(planName),
    smdp,
    activationCode,
    lpa: `LPA:1$${smdp}$${activationCode}`,
  };
}

export function parseEsimEmail(content: string): ParsedEsim[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const starts = lines
    .map((l, i) => (/^訂單編號/.test(l) ? i : -1))
    .filter((i) => i >= 0);
  const segments =
    starts.length > 1
      ? starts.map((s, k) => lines.slice(s, starts[k + 1] ?? lines.length))
      : [lines];

  const result: ParsedEsim[] = [];
  const seen = new Set<string>();
  for (const segment of segments) {
    const parsed = parseSegment(segment);
    if (parsed && !seen.has(parsed.iccid)) {
      seen.add(parsed.iccid);
      result.push(parsed);
    }
  }
  return result;
}
