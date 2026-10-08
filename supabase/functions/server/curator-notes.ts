/* Facts and stories the artist has told us directly that aren't (yet) anywhere on the site, kept
   here so the docent can answer from them. Everything in these lists is sent with every question,
   so keep it short and move an item out once it lives in the artist's statement or a work's
   description (the live data is then the single source of truth).

   Edit this file (not the database) to change what the docent knows beyond the site content. */

const START_STORY_KO = `내가 어디에서 작업의 영향을 받았는가 묻는다면, 그 시작은 남편의 한마디였다.
“슬퍼해도 되고, 기쁠 때 기뻐해도 된다.”

나는 오랫동안 울지 말라, 슬퍼하지 말라는 말에 길들여져 있었다. 그래서 눈물이 나도 소리 내어 울지 못하고, 기쁨조차 조심스레 숨기며 살아왔다. 감정을 드러내는 것은 늘 허용되지 않는 것 같았고, 그렇게 타인의 기준 속에서 나 자신을 잃어가고 있었다.

그런데 남편의 그 말은 내 안의 단단한 족쇄를 풀어주었다. 나는 처음으로 슬픔을 있는 그대로 슬퍼하고, 기쁨을 있는 그대로 기뻐할 수 있다는 사실을 깨달았다. 감정을 억누르지 않고 받아들일 때, 비로소 나는 나 자신을 온전히 인정할 수 있었고, 타인의 틀에서 벗어나 나에게로 돌아올 수 있었다.

그래서 나의 작업에는 모든 감정이 새겨진다. 기쁨도, 슬픔도, 두려움도, 기다림도. 그것들은 더 이상 감추어야 할 것이 아니라, 삶을 이루는 결이자 흔적이다. 나무껍질이 겹겹이 쌓여 나무를 단단하게 하듯, 내 감정의 결 또한 쌓이고 겹쳐 나를 만들고, 그것이 곧 내 작업의 뿌리가 된다.`;

const START_STORY_EN = `If you ask where my work's influence comes from, it began with one sentence from my husband.
"It's okay to be sad, and it's okay to be happy when you're happy."

For a long time I had been trained by words like "don't cry" and "don't be sad." So even when tears came I couldn't cry out loud, and I carefully hid even my joy. Showing emotion never seemed to be allowed, and in living by other people's standards I was losing myself.

But my husband's words loosened a hard shackle inside me. For the first time I realized I could be sad as sadness, and glad as gladness. When I accepted my feelings instead of suppressing them, I could finally fully acknowledge myself, step out of other people's frames and return to me.

That is why every emotion is engraved in my work — joy, sorrow, fear, waiting. They are no longer things to hide, but the grain and traces that make up a life. As layer upon layer of bark makes a tree sturdy, the grain of my emotions accumulates and overlaps to make me, and that has become the root of my work.`;

export const ARTIST_NOTES: { ko: string[]; en: string[] } = {
  ko: [
    "- 작품을 만든 순서(오래된 것부터): 〈흰 결〉 → 〈아주 사적인 색〉 연작 → 〈숨 결〉 → 〈묵 결〉 → 〈봄 결〉 → 〈꿈 결〉 → 〈코르셋〉 → 〈작열〉 → 〈연 결〉 → 〈결연〉(가장 최근). 가장 먼저 만든 작품은 〈흰 결〉이다.",
    "- 작가는 2025년에 작품 활동을 시작했다. 활동 지역은 수도권이고, 거주지는 경기도 안산이다.",
    "- 작품 구매·가격·의뢰 문의는 공개된 SNS 연락처(인스타그램 등)로 하면 된다. 구체적인 가격은 홈페이지에 공개돼 있지 않다.",
    `- 작업의 시작과 영향에 대해 작가가 직접 쓴 글(1인칭)이다. 인용하거나 풀어서 전할 수 있다. 글 속 '남편'이 누구인지는 따로 설명하지 말고, 안내자(호이)의 이야기처럼 말하지 말 것:\n"""\n${START_STORY_KO}\n"""`,
  ],
  en: [
    "- Order in which the works were made (oldest first): 〈Huin-gyeol〉 → the 〈A Private Hue〉 series → 〈Sum-gyeol〉 → 〈Muk-gyeol〉 → 〈Bom-gyeol〉 → 〈Ggum-gyeol〉 → 〈Corset〉 → 〈Incandescence〉 → 〈Yeon-gyeol〉 → 〈Gyeol-yeon〉 (most recent). The first work made was 〈Huin-gyeol〉.",
    "- The artist began making work in 2025. She is active in the Seoul metropolitan area and lives in Ansan, Gyeonggi-do.",
    "- For purchase, price or commission inquiries, contact the artist through the public social-media contacts (Instagram etc.). Specific prices are not published on the website.",
    `- The artist's own words (first person) about how her work began and what shaped it. You may quote or paraphrase them. Do not explain who the "husband" in the text is, and do not speak of it as the guide's (Hoi's) own story:\n"""\n${START_STORY_EN}\n"""`,
  ],
};
