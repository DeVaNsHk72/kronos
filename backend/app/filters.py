"""Shared, parameterized filter building for question queries.

All filterable metadata is denormalized onto the `questions` table, so filters
are simple column predicates. `course_code` also matches multi-code papers via
the paper_courses join table. Nothing here interpolates user input into SQL —
every value is bound.
"""

from typing import Optional

from fastapi import Query

FIELDS = ("course_code", "branch", "program", "exam_type", "semester", "year",
          "year_min", "year_max", "unit", "topic", "subtopic", "has_images")


class Filters:
    """Collected from query params; shared across search endpoints."""

    def __init__(
        self,
        course_code: Optional[str] = Query(None),
        branch: Optional[str] = Query(None),
        program: Optional[str] = Query(None),
        exam_type: Optional[str] = Query(None),
        semester: Optional[int] = Query(None),
        year: Optional[int] = Query(None),
        year_min: Optional[int] = Query(None),
        year_max: Optional[int] = Query(None),
        unit: Optional[int] = Query(None),
        topic: Optional[str] = Query(None),
        subtopic: Optional[str] = Query(None),
        has_images: Optional[bool] = Query(None),
    ):
        for name, val in zip(FIELDS, (course_code, branch, program, exam_type,
                                      semester, year, year_min, year_max, unit,
                                      topic, subtopic, has_images)):
            setattr(self, name, val)

    @classmethod
    def of(cls, mapping):
        """Build from a plain dict, ignoring keys that are not filters.

        Constructing Filters() directly is unsafe: the defaults above are
        FastAPI `Query` objects (truthy), so any field left out would filter on
        a Query instance. This bypasses __init__ and defaults everything None.
        """
        f = cls.__new__(cls)
        for name in FIELDS:
            setattr(f, name, mapping.get(name))
        return f

    def where(self, alias: str = "q"):
        """Return (sql_fragment, params). Fragment starts with ' AND ...' or ''."""
        clauses, params = [], []
        eq = {
            "exam_type": self.exam_type, "semester": self.semester,
            "year": self.year, "unit": self.unit, "topic": self.topic,
            "subtopic": self.subtopic,
        }
        for col, val in eq.items():
            if val is not None:
                clauses.append(f"{alias}.{col} = ?")
                params.append(val)
        # branch: include selected branch + shared branches (common to all)
        if self.branch is not None:
            clauses.append(f"({alias}.branch = ? OR {alias}.branch IN ('Common', 'Elective'))")
            params.append(self.branch)
        # program: include selected program + shared programs (common to all)
        if self.program is not None:
            clauses.append(f"({alias}.program = ? OR {alias}.program IN ('Kannada', 'Mathematics'))")
            params.append(self.program)
        if self.year_min is not None:
            clauses.append(f"{alias}.year >= ?"); params.append(self.year_min)
        if self.year_max is not None:
            clauses.append(f"{alias}.year <= ?"); params.append(self.year_max)
        if self.course_code:
            # primary code OR any code this paper serves (multi-code papers)
            clauses.append(
                f"({alias}.course_code = ? OR {alias}.sha IN "
                f"(SELECT sha FROM p.paper_courses WHERE course_code = ?))")
            params += [self.course_code, self.course_code]
        if self.has_images is True:
            clauses.append(
                f"{alias}.id IN (SELECT question_id FROM question_images)")
        frag = (" AND " + " AND ".join(clauses)) if clauses else ""
        return frag, params
