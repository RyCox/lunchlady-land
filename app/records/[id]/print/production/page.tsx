import Link from "next/link";
import { renderProductionRecordHtml } from "@/lib/print";
import { PrintButton } from "@/components/PrintButton";
import { loadRecordPage } from "../../load";

export const dynamic = "force-dynamic";

export default async function PrintProductionRecord({ params }: { params: Promise<{ id: string }> }) {
  const { data } = await loadRecordPage(params);
  return (
    <>
      <div className="print-bar">
        <Link href={`/records/${data.record.id}`}>← Back</Link>
        <PrintButton label="Print Production Record" />
        <span className="muted">Prints landscape on letter paper.</span>
      </div>
      <div className="print-page" dangerouslySetInnerHTML={{ __html: renderProductionRecordHtml(data) }} />
    </>
  );
}
