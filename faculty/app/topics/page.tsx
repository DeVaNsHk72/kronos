"use client";
import { useEffect, useState } from "react";
import { SubjectPicker, useSubjects } from "@/components/SubjectPicker";
import { Skeleton, Empty, SqlToggle, Tile, Banner } from "@/components/Bits";
import { runQuery } from "@/lib/util";

export default function Topics() {
  const { subjects } = useSubjects();
  const [key, setKey] = useState("");
  const [never, setNever] = useState<any>(null);
  const [fresh, setFresh] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [openTopic, setOpenTopic] = useState<string | null>(null);

  useEffect(() => { if (subjects?.length && !key) setKey(subjects[0].subject_key); }, [subjects, key]);
  useEffect(() => {
    if (!key) return;
    setNever(null); setFresh(null); setOpenTopic(null); setDetail(null);
    runQuery("neverAsked", { subject_key: key }).then(setNever);
    runQuery("freshness", { subject_key: key }).then(setFresh);
  }, [key]);

  async function drill(topic_id: string) {
    if (openTopic === topic_id) { setOpenTopic(null); return; }
    setOpenTopic(topic_id); setDetail(null);
    setDetail(await runQuery("topicDetail", { subject_key: key, topic_id }));
  }

  const thisYear = new Date().getFullYear();

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-end justify-between gap-6 flex-wrap">
        <div>
          <h1 className="serif-display text-4xl text-ink">Syllabus gaps and staleness</h1>
          <p className="text-[13px] text-ink-2 mt-2 max-w-2xl">
            Topics the exam has never touched, and units that have not been examined
            recently. Both are places a paper could reasonably go next.
          </p>
        </div>
        <SubjectPicker subjects={subjects} value={key} onChange={setKey} />
      </div>

      <section>
        <h2 className="serif text-xl text-ink mb-1">Unit freshness</h2>
        <p className="text-[12px] text-ink-2 mb-3">
          How recently each unit was examined, and how heavily overall.
        </p>
        {!fresh ? <Skeleton className="h-24" /> : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {fresh.rows.map((r: any) => {
              const age = thisYear - Number(r.last_asked);
              return (
                <Tile key={r.unit_no} label={`Unit ${r.unit_no}`}
                  value={r.last_asked} tone={age >= 3 ? "warn" : "normal"}
                  sub={`${age === 0 ? "this year" : `${age}y ago`} · ${r.marks} marks · ${r.years} yrs`} />
              );
            })}
          </div>
        )}
        {fresh && <SqlToggle sql={fresh.sql} ms={fresh.ms} backend={fresh.backend} />}
      </section>

      <section>
        <h2 className="serif text-xl text-ink mb-1">Never examined</h2>
        <p className="text-[12px] text-ink-2 mb-3">
          Topics that appear in the archive&apos;s topic list but have no question
          against them. Ranked by how much of the notes cover them — a well-taught
          topic that is never examined is the strongest candidate.
        </p>
        {!never ? <Skeleton className="h-32" />
          : never.rows.length === 0 ? (
            <Empty title="Every topic has been examined at least once" />
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-[13px] dense">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-ink-2">
                    <th className="px-4 py-2 font-medium">Topic</th>
                    <th className="px-4 py-2 font-medium">Unit</th>
                    <th className="px-4 py-2 font-medium text-right">Note pages</th>
                  </tr>
                </thead>
                <tbody>
                  {never.rows.map((r: any) => (
                    <tr key={r.topic_id} className="border-t">
                      <td className="px-4 py-2 serif">{r.topic_name}</td>
                      <td className="px-4 py-2 mono text-ink-2">{r.unit_no ?? "—"}</td>
                      <td className="px-4 py-2 mono text-right">{r.notes_pages}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <SqlToggle sql={never.sql} ms={never.ms} backend={never.backend} />
            </div>
          )}
      </section>
    </div>
  );
}
