import { notFound } from "next/navigation";
import { findEsimsByIds } from "@/lib/db";
import { verifyShareSig } from "@/lib/share";
import ShareConsentGate from "./ShareConsentGate";

type Props = {
  searchParams: Promise<{ ids?: string; sig?: string }>;
};

export const dynamic = "force-dynamic";

export default async function SharePage({ searchParams }: Props) {
  const params = await searchParams;
  const idsRaw = params.ids || "";
  const sig = (params.sig || "").trim();
  const ids = idsRaw
    .split(",")
    .map((v) => Number(v.trim()))
    .filter((v) => !Number.isNaN(v) && v > 0);

  if (ids.length === 0 || !verifyShareSig(ids, sig)) {
    notFound();
  }

  const esims = findEsimsByIds(ids);

  if (!esims.length) {
    notFound();
  }

  return <ShareConsentGate esims={esims} idsRaw={idsRaw} sig={sig} />;
}

