import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import * as Q from "@/lib/queries";
import { FORMATS, answerableMarks } from "@/lib/formats";

export const dynamic = "force-dynamic";

/**
 * Paper generation is constraint satisfaction over real past questions.
 *
 * No language model runs here. Every question on the output is a row from
 * fact_question, carrying its question_id, source PDF and page, so a paper can
 * be defended line by line to an exam committee. Rephrasing, where the user
 * opts into it, happens in a separate route and is marked on the page.
 *
 * When a constraint cannot be met it is RELAXED AND REPORTED, never silently
 * dropped: a paper that quietly misses a CO is worse than one that says so.
 */

type Cand = {
  question_id: string; question_text: string; marks: number; unit_no: number;
  course_outcome: number | null; program_outcome: number | null;
  bloom_level: string | null; exam_year: number;
  source_file: string; source_page: number | null;
  repeat_cluster_id: string | null; topic_id: string | null;
};
type Slot = { unit: number; marks: number; part: string; bloom?: string };
type Picked = Slot & { q: Cand | null; note?: string };

export async function POST(req: NextRequest) {
  const b = await req.json();
  const subject_key = String(b.subject_key);
  const exam_type = String(b.exam_type ?? "SEE");
  const totalTarget = Number(b.total_marks ?? 100);
  const excludeYears = Number(b.exclude_years ?? 3);
  const requireCo = Boolean(b.require_co);
  const internalChoice = b.internal_choice !== false;
  const bloomMix: Record<string, number> = b.bloom_mix ?? {};
  const locked: Record<string, string> = b.locked ?? {};   // slotKey -> question_id
  const excludeClusters: string[] = b.exclude_clusters ?? [];

  const warnings: string[] = [];
  const cutoff_year = new Date().getFullYear() - excludeYears;

  // A declared format (currently CIE) is authoritative: its structure is printed
  // on the papers, so there is nothing to infer and nothing to scale.
  const declared = FORMATS[exam_type];
  if (declared) {
    return NextResponse.json(
      await buildDeclared(declared, {
        subject_key, exam_type, cutoff_year, requireCo, bloomMix, locked,
        excludeClusters, warnings,
      }),
    );
  }

  // ---- 1. structure: blueprint, else observed shape (and say which) --------
  let bp = (await query(Q.BLUEPRINT, { subject_key, exam_type })).rows as any[];
  let basis: "blueprint" | "observed" = "blueprint";
  if (!bp.length) {
    bp = (await query(Q.OBSERVED_SHAPE, { subject_key })).rows as any[];
    basis = "observed";
    warnings.push(
      `No exam blueprint exists for this subject and exam type. Structure was ` +
      `derived from the observed shape of past papers instead — treat it as a ` +
      `description of what has happened, not a rule.`,
    );
  } else if (bp[0]?.basis === "observed") {
    basis = "observed";
    warnings.push(
      `The stored blueprint is itself marked 'observed' — measured from past ` +
      `papers, not a published departmental blueprint.`,
    );
  }
  if (!bp.length) {
    return NextResponse.json(
      { error: "No blueprint and no historical papers to infer structure from." },
      { status: 422 },
    );
  }

  // Which mark values actually exist per unit — a blueprint asking for a
  // 7-mark question in a unit that has never had one is unsatisfiable.
  const slotsAvail = (await query(Q.MARK_SLOTS, { subject_key })).rows as any[];
  const availByUnit = new Map<number, Set<number>>();
  for (const r of slotsAvail) {
    const u = Number(r.unit_no);
    if (!availByUnit.has(u)) availByUnit.set(u, new Set());
    availByUnit.get(u)!.add(Number(r.marks));
  }

  // ---- 2. build the slot list from the structure --------------------------
  const buildSlots = (unit: number, unitMarks: number, per: number, count: number): Slot[] => {
    const avail = [...(availByUnit.get(unit) ?? new Set<number>())].sort((a, b) => b - a);
    const out: Slot[] = [];
    let remaining = unitMarks;
    const n = Math.max(count, 1);
    for (let i = 0; i < n; i++) {
      const left = n - i;
      let want = i === n - 1 ? remaining : (per > 0 ? per : Math.round(remaining / left));
      if (want <= 0) want = Math.max(1, Math.round(remaining / left));
      // snap to a mark value that exists in this unit's history
      if (avail.length && !avail.includes(want)) {
        const near = avail.reduce((best, m) =>
          Math.abs(m - want) < Math.abs(best - want) ? m : best, avail[0]);
        if (near !== want) {
          warnings.push(
            `Unit ${unit}: no ${want}-mark question exists in the archive; ` +
            `used ${near} marks instead.`);
          want = near;
        }
      }
      want = Math.min(want, remaining);
      if (want <= 0) break;
      out.push({ unit, marks: want, part: "abcdef"[i] ?? String(i + 1) });
      remaining -= want;
    }
    // Deliberately NOT topping the last slot up to absorb leftover marks: that
    // would push it straight back off the mark values the archive actually has,
    // and the slot would then match nothing. Report the shortfall instead.
    if (remaining > 0 && out.length) {
      warnings.push(
        `Unit ${unit}: ${remaining} mark(s) could not be placed — the archive has ` +
        `no question of that size in this unit. Unit totals ` +
        `${unitMarks - remaining} instead of ${unitMarks}.`);
    }
    return out;
  };

  // ---- 3. bloom targets spread across slots --------------------------------
  const bloomOrder = Object.entries(bloomMix)
    .filter(([, v]) => Number(v) > 0)
    .sort((a, b) => Number(b[1]) - Number(a[1]));

  const usedIds = new Set<string>();
  const usedClusters = new Set<string>(excludeClusters);
  const cosSeen = new Set<number>();

  const allCos = (await query(Q.DISTINCT_COS, { subject_key })).rows
    .map((r: any) => Number(r.course_outcome)).filter(Number.isFinite);

  async function pick(slot: Slot, wantCo?: number): Promise<Cand | null> {
    const rows = (await query(Q.CANDIDATES, {
      subject_key, unit_no: slot.unit, marks: slot.marks,
      cutoff_year, target_bloom: slot.bloom ?? "",
    })).rows as unknown as Cand[];
    const pool = rows.filter(
      (c) => !usedIds.has(c.question_id) &&
             !(c.repeat_cluster_id && usedClusters.has(c.repeat_cluster_id)),
    );
    if (!pool.length) return null;
    // Rank inside the pool: an uncovered CO first when one is being chased,
    // then the requested Bloom level, then the oldest question.
    const score = (c: Cand) =>
      (wantCo !== undefined && Number(c.course_outcome) === wantCo ? 0 : 100) +
      (slot.bloom && c.bloom_level === slot.bloom ? 0 : 10) +
      (c.exam_year - 2000) * 0.01;
    return pool.sort((a, b) => score(a) - score(b))[0];
  }

  // ---- 4. fill every slot, per unit, with internal choice ------------------
  type UnitOut = { unit: number; alternatives: { qno: number; picks: Picked[] }[] };
  const units: UnitOut[] = [];
  let qno = 0;

  // Unit means from observed papers do not sum to the requested total, so scale
  // them onto it. Structure still comes from the data; only the scale is set by
  // the request, and the scaling is reported.
  const rawTotal = bp.reduce((s: number, r: any) => s + (Number(r.unit_max_marks) || 0), 0);
  const scale = rawTotal > 0 ? totalTarget / rawTotal : 1;
  if (rawTotal > 0 && Math.abs(rawTotal - totalTarget) > 1) {
    warnings.push(
      `${basis === "observed" ? "Observed" : "Blueprint"} unit totals sum to ` +
      `${rawTotal} marks, not the requested ${totalTarget}. Each unit was scaled ` +
      `by ×${scale.toFixed(2)} to reach the target.`);
  }

  for (const row of bp) {
    const unit = Number(row.unit_no);
    const unitMarks = Math.max(1, Math.round((Number(row.unit_max_marks) || 0) * scale));
    const per = Math.round((Number(row.marks_per_question) || 0) * scale);
    const count = Number(row.questions_asked) || 3;
    const alternatives: { qno: number; picks: Picked[] }[] = [];
    const nAlt = internalChoice ? 2 : 1;

    for (let alt = 0; alt < nAlt; alt++) {
      qno += 1;
      const slots = buildSlots(unit, unitMarks, per, count);
      const picks: Picked[] = [];
      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        slot.bloom = bloomOrder.length
          ? bloomOrder[i % bloomOrder.length][0]
          : undefined;
        const key = `${qno}${slot.part}`;

        if (locked[key]) {
          const rows = (await query(Q.CANDIDATES, {
            subject_key, unit_no: slot.unit, marks: slot.marks,
            cutoff_year, target_bloom: "",
          })).rows as unknown as Cand[];
          const found = rows.find((c) => c.question_id === locked[key]) ?? null;
          if (found) {
            usedIds.add(found.question_id);
            if (found.repeat_cluster_id) usedClusters.add(found.repeat_cluster_id);
            if (found.course_outcome != null) cosSeen.add(Number(found.course_outcome));
            picks.push({ ...slot, q: found, note: "locked" });
            continue;
          }
        }

        const missingCo = requireCo
          ? allCos.find((co) => !cosSeen.has(co))
          : undefined;
        let q = await pick(slot, missingCo);
        if (!q && missingCo !== undefined) q = await pick(slot);   // relax the CO chase
        if (!q) {
          warnings.push(
            `Unit ${unit}, Q${qno}${slot.part}: no unused ${slot.marks}-mark ` +
            `question remains after excluding everything asked since ${cutoff_year}. ` +
            `Slot left empty — lower "exclude recent" or widen the unit.`);
          picks.push({ ...slot, q: null });
          continue;
        }
        usedIds.add(q.question_id);
        if (q.repeat_cluster_id) usedClusters.add(q.repeat_cluster_id);
        if (q.course_outcome != null) cosSeen.add(Number(q.course_outcome));
        picks.push({ ...slot, q });
      }
      alternatives.push({ qno, picks });
    }
    units.push({ unit, alternatives });
  }

  // ---- 5. verify the constraints and report every miss ---------------------
  const firstAlt = units.flatMap((u) => u.alternatives[0].picks);
  const totalMarks = firstAlt.reduce((s, p) => s + (p.q ? p.marks : 0), 0);
  if (totalMarks !== totalTarget) {
    warnings.push(
      `Paper totals ${totalMarks} marks, not the requested ${totalTarget}. ` +
      (basis === "observed"
        ? `The structure came from observed papers, whose units sum to ${totalMarks}.`
        : `The blueprint's unit totals sum to ${totalMarks}.`));
  }
  if (requireCo) {
    const missing = allCos.filter((co) => !cosSeen.has(co));
    if (missing.length) {
      warnings.push(
        `CO coverage incomplete: CO ${missing.join(", ")} could not be placed. ` +
        `Only ${Math.round(100 * cosSeen.size / Math.max(allCos.length, 1))}% of COs appear.`);
    }
  }
  const empties = firstAlt.filter((p) => !p.q).length;

  // Bloom achieved vs requested, so the mix sliders are not decorative.
  const bloomAchieved: Record<string, number> = {};
  for (const p of firstAlt) if (p.q?.bloom_level) {
    bloomAchieved[p.q.bloom_level] = (bloomAchieved[p.q.bloom_level] ?? 0) + p.marks;
  }

  return NextResponse.json({
    subject_key, exam_type, basis, units, warnings,
    total_marks: totalMarks, target_marks: totalTarget,
    cos_required: allCos, cos_covered: [...cosSeen].sort((a, b) => a - b),
    bloom_requested: bloomMix, bloom_achieved: bloomAchieved,
    empty_slots: empties,
    cutoff_year,
    sql_used: Q.CANDIDATES,
  });
}


/**
 * Fill a declared format. Same selection rules as the unit path — SQL picks,
 * no duplicate cluster, CO chased when asked — but the structure is fixed, so
 * marks always total exactly what the format says.
 */
async function buildDeclared(
  fmt: import("@/lib/formats").Format,
  ctx: {
    subject_key: string; exam_type: string; cutoff_year: number;
    requireCo: boolean; bloomMix: Record<string, number>;
    locked: Record<string, string>; excludeClusters: string[]; warnings: string[];
  },
) {
  const { subject_key, cutoff_year, requireCo, bloomMix, locked, warnings } = ctx;
  const usedIds = new Set<string>();
  const usedClusters = new Set<string>(ctx.excludeClusters);
  const cosSeen = new Set<number>();

  const allCos = (await query(Q.DISTINCT_COS, { subject_key })).rows
    .map((r: any) => Number(r.course_outcome)).filter(Number.isFinite);

  const unitsRes = (await query(Q.MARK_SLOTS, { subject_key })).rows as any[];
  const units = [...new Set(unitsRes.map((r) => Number(r.unit_no)))].sort((a, b) => a - b);
  const bloomOrder = Object.entries(bloomMix)
    .filter(([, v]) => Number(v) > 0).sort((a, b) => Number(b[1]) - Number(a[1]));

  let n = 0;
  const sections = [];
  for (const sec of fmt.sections) {
    const picks = [];
    for (let i = 0; i < sec.slots; i++) {
      n += 1;
      const key = String(n);
      const bloom = bloomOrder.length ? bloomOrder[i % bloomOrder.length][0] : "";
      // Spread the section across units so one unit does not carry the paper.
      const unit = units.length ? units[(n - 1) % units.length] : 1;
      const wantCo = requireCo ? allCos.find((c) => !cosSeen.has(c)) : undefined;

      const attempt = async (u: number, m: number) => {
        const rows = (await query(Q.CANDIDATES, {
          subject_key, unit_no: u, marks: m, cutoff_year, target_bloom: bloom,
        })).rows as any[];
        const pool = rows.filter((c) =>
          !usedIds.has(c.question_id) &&
          !(c.repeat_cluster_id && usedClusters.has(c.repeat_cluster_id)));
        if (!pool.length) return null;
        const score = (c: any) =>
          (wantCo !== undefined && Number(c.course_outcome) === wantCo ? 0 : 100) +
          (bloom && c.bloom_level === bloom ? 0 : 10) + (c.exam_year - 2000) * 0.01;
        return pool.sort((a, b) => score(a) - score(b))[0];
      };

      let q = null;
      if (locked[key]) {
        const rows = (await query(Q.CANDIDATES, {
          subject_key, unit_no: unit, marks: sec.marks, cutoff_year, target_bloom: "",
        })).rows as any[];
        q = rows.find((c) => c.question_id === locked[key]) ?? null;
      }
      // Try the assigned unit, then any other unit at the same mark value: the
      // format fixes the marks, so relaxing the unit is the honest trade.
      if (!q) q = await attempt(unit, sec.marks);
      if (!q) {
        for (const u of units) {
          if (u === unit) continue;
          q = await attempt(u, sec.marks);
          if (q) {
            warnings.push(
              `${sec.label} Q${n}: no unused ${sec.marks}-mark question left in ` +
              `unit ${unit}; took one from unit ${u} instead.`);
            break;
          }
        }
      }
      if (!q) {
        warnings.push(
          `${sec.label} Q${n}: no unused ${sec.marks}-mark question remains in any ` +
          `unit after excluding everything asked since ${cutoff_year}. Slot empty.`);
        picks.push({ n, marks: sec.marks, q: null });
        continue;
      }
      usedIds.add(q.question_id);
      if (q.repeat_cluster_id) usedClusters.add(q.repeat_cluster_id);
      if (q.course_outcome != null) cosSeen.add(Number(q.course_outcome));
      picks.push({ n, marks: sec.marks, q, locked: Boolean(locked[key]) });
    }
    sections.push({ ...sec, picks });
  }

  const answerable = answerableMarks(fmt);
  const printed = fmt.sections.reduce((s, x) => s + x.slots * x.marks, 0);
  const filled = sections.flatMap((s) => s.picks).filter((p) => p.q).length;
  const empty = sections.flatMap((s) => s.picks).filter((p) => !p.q).length;

  if (requireCo) {
    const missing = allCos.filter((c) => !cosSeen.has(c));
    if (missing.length) {
      warnings.push(
        `CO coverage incomplete: CO ${missing.join(", ")} could not be placed in ` +
        `this format's ${filled} slots.`);
    }
  }

  const bloomAchieved: Record<string, number> = {};
  for (const p of sections.flatMap((s) => s.picks)) {
    if (p.q?.bloom_level) {
      bloomAchieved[p.q.bloom_level] = (bloomAchieved[p.q.bloom_level] ?? 0) + p.marks;
    }
  }

  return {
    subject_key, exam_type: ctx.exam_type, basis: "declared" as const,
    format: fmt.name, sections, instructions: fmt.instructions,
    total_marks: answerable, target_marks: answerable, printed_marks: printed,
    cos_required: allCos, cos_covered: [...cosSeen].sort((a, b) => a - b),
    bloom_requested: bloomMix, bloom_achieved: bloomAchieved,
    empty_slots: empty, cutoff_year, warnings, sql_used: Q.CANDIDATES,
  };
}
