// 2026-10-11 data cleanup (owner's answers to the content review):
// phone hidden + emptied, footer to city level, new "결" series, exhibition/press names unified
// to their official forms, a few typos.
const byId = (list, id) => {
  const item = (list || []).find((x) => x.id === id);
  if (!item) throw new Error(`id ${id} not found`);
  return item;
};
const set = (obj, fields) => Object.assign(obj, fields);

export default function patch(row) {
  // 1. phone: keep the entry (the edit panel expects it) but leave nothing in it
  set(byId(row.contacts, "phone"), { visible: false, display: "", href: "" });

  // footer: city level only
  set(row.content, { footerLocation: "경기도 안산", footerLocationEn: "Ansan, Gyeonggi-do, Korea" });

  // 3. "결" series for the large works ending in -결; 코르셋·결연 without a series.
  // 작열 isn't a -결 title — left without a series until the artist decides.
  if (!row.series_list.some((s) => s.name === "결")) row.series_list.unshift({ id: 2, name: "결", nameEn: "Gyeol" });
  for (const id of [1, 3, 4, 5, 6, 53]) byId(row.artworks, id).series = "결";
  for (const id of [2, 52, 54]) byId(row.artworks, id).series = "";

  // 8–10. exhibitions: same official names in "current" and "history"
  const cur = (id, f) => set(byId(row.current_exhibitions, id), f);
  const his = (id, f) => set(byId(row.exhibitions, id), f);
  cur(12, { location: "파주", locationEn: "Paju" });
  his(14, { title: "흐릿하게, 선명하게", titleEn: "Faintly, Vividly" });
  cur(3, { titleEn: "2026 JoongAng Fine Arts Competition" });
  cur(2, { venueEn: "Art Chosun Space" });
  his(12, { venueEn: "Art Chosun Space" });
  cur(4, { title: "제5회 서울아트페어", titleEn: "The 5th Seoul Art Fair" });
  cur(5, { venue: "와이케이갤러리", venueEn: "YK Gallery", location: "안양", locationEn: "Anyang" });
  const yearEnd = { title: "연말, 마음에 머문 빛 展", titleEn: "Year-end, The Light that Lingered in the Heart", venueEn: "Risu Gallery" };
  cur(7, yearEnd);
  his(2, yearEnd);
  const gyeongju = { title: "2025 경주아트페어", titleEn: "2025 Gyeongju Art Fair", venue: "경주화백컨벤션센터", venueEn: "Gyeongju Hwabaek International Convention Center (HICO)" };
  cur(8, gyeongju);
  his(11, gyeongju);
  cur(9, { title: "나만의 무늬 - 뮤턴트 : AI 시대" });
  const bank = { title: "제15회 뱅크아트페어", titleEn: "The 15th Bank Art Fair" };
  cur(10, bank);
  his(5, bank);
  cur(11, { venue: "갤러리 라메르", venueEn: "Gallery La Mer" });
  his(15, { title: "거친 결로 다져온 시간 뒤, 가볍게 만개한 순간", titleEn: "Time Hardened, Lightly in Bloom" });
  const seongsu = { title: "2026 크리에이티브X성수, 성수아트페어", titleEn: "2026 Creative X Seongsu, Seongsu Art Fair" };
  cur(16, seongsu);
  his(16, seongsu);
  cur(13, { titleEn: "Title TBA" });

  // press: outlet names in official form, no " - outlet" tails in titles, spacing
  const press = (id, f) => set(byId(row.press, id), f);
  press(9, { outlet: "크리에이티브X성수", outletEn: "Creative X Seongsu" });
  press(7, {
    title: "전연미 작가 개인전, 한지의 거친 결 위에 피어난 시간",
    titleEn: "Yeonmi Jeon Solo Exhibition: Time Blossoming Across the Rough Grain of Hanji",
    outlet: "한국현대미술신문", outletEn: "Korea Contemporary Art News",
  });
  press(6, {
    title: "2026 중앙회화대전 최종 수상자 발표 전시",
    titleEn: "2026 JoongAng Fine Arts Competition Final Winners Announcement Exhibition",
    outlet: "아트월드뉴스", outletEn: "Art World News",
  });
  press(5, {
    title: "전시 '흐릿하게, 선명하게' — 월간미술 2026년 8월호",
    titleEn: "Exhibition 'Faintly, Vividly' — Monthly Art, August 2026 Issue",
  });
  press(2, {
    title: "세계미술작가교류협회 ‘세미갤러리’, 2026 서울아트페어 참가… ‘넥스트10’ 작가들 총출동",
    titleEn: "Semi Gallery of the World Fine Art Association to Participate in Seoul Art Fair 2026… Presenting the 'Next 10' Artists",
    outlet: "아트월드뉴스", outletEn: "Art World News",
  });
  press(1, { title: "비움갤러리, '경주아트페어 2025' 참여 - 박혜정, 전연미, 호진 작가와 함께 '예술의 결을 이어가다'" });

  // typos
  byId(row.videos, 1).titleEn = "Artist Interview - A Private Hue";
  const s1 = byId(row.slides, 1);
  s1.bodyEn = s1.bodyEn.replace(/<A Color\\? Private Very>/g, "<A Private Hue>");
}
