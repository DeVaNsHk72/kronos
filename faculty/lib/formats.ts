/**
 * Declared paper formats.
 *
 * The CIE shape is not inferred from the archive — it is printed on the papers
 * themselves ("PART -A / Total 5 Marks (No Choice)", "Internal choice is
 * provided in Part C", "Maximum Marks: 40"). A declared blueprint beats an
 * observed average: averaging real papers produced a 155-mark structure that
 * had to be scaled, which is exactly the kind of quiet fudge a paper format
 * should not need.
 */
export type Section = {
  label: string;            // PART -A
  note: string;             // Total 5 Marks (No Choice)
  slots: number;            // questions printed
  answer: number;           // questions the student answers
  marks: number;            // marks per question
  units?: number[];         // units this section may draw from
};

export type Format = {
  name: string;
  total: number;
  instructions: string[];
  sections: Section[];
};

export const FORMATS: Record<string, Format> = {
  CIE: {
    name: "Internal Assessment",
    total: 40,
    instructions: ["Internal choice is provided in Part C."],
    sections: [
      { label: "PART - A", note: "Total 5 Marks (No Choice)",  slots: 1, answer: 1, marks: 5 },
      { label: "PART - B", note: "Total 15 Marks (No Choice)", slots: 3, answer: 3, marks: 5 },
      { label: "PART - C", note: "Total 20 Marks (Answer any 2 of 3)", slots: 3, answer: 2, marks: 10 },
    ],
  },
};

/** Marks a student can actually score = answered questions only, not printed ones. */
export function answerableMarks(f: Format) {
  return f.sections.reduce((s, x) => s + x.answer * x.marks, 0);
}
