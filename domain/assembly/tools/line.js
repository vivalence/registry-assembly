// one row, one line — what a tool says back about a row it minted or read
export const line = (row) =>
  [
    `${row.ontology} ${row.slug}`,
    row.trait?.LABELED?.name ?? "",
    row.trait?.COUNTED ? `qty ${row.trait.COUNTED.qty}` : null,
    row.trait?.PLACED ? `in ${row.trait.PLACED.layer} ← ${row.trait.PLACED.ref}` : null,
    row.trait?.JOINED?.joins?.length ? `holds ${row.trait.JOINED.joins.length}` : null,
    row.ontology === "guide" ? `${(row.trait?.SEQUENCED?.sections ?? []).reduce((n, section) => n + (section.steps?.length ?? 0), 0)} steps${row.trait?.SEQUENCED?.subject ? ` of ${row.trait.SEQUENCED.subject}` : ""}` : null,
    row.trait?.ASSEMBLED ? `${row.trait.ASSEMBLED.placements.length} placements` : null,
    row.trait?.INSTRUCTED?.lines?.length ? `${row.trait.INSTRUCTED.lines.length} lines` : null,
  ]
    .filter((part) => part != null && part !== "")
    .join(" · ");
