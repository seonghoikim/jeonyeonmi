// 리수갤러리 English name is "Leesoo Gallery" (artist confirmed), in both exhibition lists.
export default function patch(row) {
  for (const list of [row.current_exhibitions, row.exhibitions])
    for (const e of list) if (e.venue === "리수갤러리") e.venueEn = "Leesoo Gallery";
}
