// Trailing line break in the new artist-statement slide heading ("슬퍼해도 되고, 기뻐해도 된다\n").
export default function patch(row) {
  for (const s of row.slides) {
    if (typeof s.heading === "string") s.heading = s.heading.trim();
    if (typeof s.headingEn === "string") s.headingEn = s.headingEn.trim();
  }
}
