import Link from "next/link";
import { notFound } from "next/navigation";
import { getArchive } from "@/lib/records";
import { PrintButton } from "@/components/PrintButton";
import { loadRecordPage } from "../../load";

export const dynamic = "force-dynamic";

export default async function ArchivePage({ params }: { params: Promise<{ id: string; version: string }> }) {
  const { user, data } = await loadRecordPage(params);
  const version = Number((await params).version);
  const archive = await getArchive(user, data.record.id, version);
  if (!archive) notFound();
  return (
    <>
      <div className="print-bar">
        <Link href={`/records/${data.record.id}`}>← Back</Link>
        <PrintButton label="Print this copy" />
        <span className="muted">Archived version {version} · SHA-256 <code>{archive.sha256}</code></span>
      </div>
      <div className="print-page" dangerouslySetInnerHTML={{ __html: archive.html }} />
    </>
  );
}
