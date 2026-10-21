import Link from "next/link";
import { renderPullSheetHtml } from "@/lib/print";
import { PrintButton } from "@/components/PrintButton";
import { loadRecordPage } from "../../load";

export const dynamic = "force-dynamic";

export default async function PrintPullSheet({ params }: { params: Promise<{ id: string }> }) {
  const { data } = await loadRecordPage(params);
  return (
    <>
      <div className="print-bar">
        <Link href={`/records/${data.record.id}`}>← Back</Link>
        <PrintButton label="Print Pull Sheet" />
        <span className="muted">Items come from today&apos;s Production Record. Staff fill in the rest by hand.</span>
      </div>
      <div className="print-page" dangerouslySetInnerHTML={{ __html: renderPullSheetHtml(data) }} />
    </>
  );
}
