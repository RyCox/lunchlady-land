import Link from "next/link";
import { redirect } from "next/navigation";
import { validateRecord } from "@/lib/validate";
import { Notice, type Search } from "@/components/Notice";
import { RecordForm } from "@/components/RecordForm";
import { loadRecordPage } from "../load";

export const dynamic = "force-dynamic";

export default async function AmendPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Search }) {
  const { data } = await loadRecordPage(params);
  const { record } = data;
  if (record.status !== "finalized") redirect(`/records/${record.id}`);
  return (
    <>
      <p className="muted" style={{ margin: 0 }}><Link href={`/records/${record.id}`}>← Back to record</Link></p>
      <h1>Amend {record.school_name} · {record.record_date}</h1>
      <p className="muted">
        Version {record.version} is on file. Saving creates version {record.version + 1}; the earlier version and its printed copy are kept.
      </p>
      <Notice searchParams={searchParams} />
      <RecordForm data={data} mode="amend" foodItems={[]} validation={validateRecord(record, data.lines)} />
    </>
  );
}
