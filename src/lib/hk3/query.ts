const QUERY_URL = "http://3hk.wholesalesim.com:18080/3hknumber2.php";

export type Hk3Status = {
  iccid: string;
  phone: string;
  status: string;
  activatedAt: string;
  planName: string | null;
};

function field(html: string, label: string): string {
  const m = html.match(new RegExp(`<b>${label}[^<]*</b>([^<]*)`));
  return m ? m[1].trim() : "";
}

/** 回傳 null 代表查無此卡（號碼錯誤）；網路或網站錯誤會丟例外 */
export async function queryHk3(by: { phone: string } | { iccid: string }): Promise<Hk3Status | null> {
  const body = new URLSearchParams({
    iccid: "iccid" in by ? by.iccid : "",
    "3hknum": "phone" in by ? by.phone : "",
  });
  const res = await fetch(QUERY_URL, {
    method: "POST",
    body,
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`3HK 查詢網站回應 ${res.status}`);
  const html = await res.text();

  const iccid = field(html, "卡片ICCID號碼");
  if (!iccid) return null;

  const offers = [...html.matchAll(/OfferName:\s*([^<]+)/g)].map((m) => m[1].trim());
  return {
    iccid,
    phone: field(html, "卡片電話號碼:"),
    status: field(html, "卡片狀態"),
    activatedAt: field(html, "卡片電話號碼激活時間"),
    planName: offers.find((o) => /\d+\s*Days?/i.test(o)) ?? null,
  };
}

export function isFreshCard(s: Hk3Status): boolean {
  return s.status.toUpperCase() === "PREACTIVE" && !s.activatedAt;
}
