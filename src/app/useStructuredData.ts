import { useEffect } from "react";
import { artworkSlug, type Artwork, type CurrentExhibition, type ExhibitionEntry, type Lang } from "./data";

type Input = {
  lang: Lang;
  artistName: string;
  artistNameEn: string;
  artworkList: Artwork[];
  imageUrls: Record<string, string>;
  currentExList: CurrentExhibition[];
  exhibitionList: ExhibitionEntry[];
};

const SCRIPT_ID = "structured-data-dynamic";

// "2025.01.01" -> "2025-01-01"; leave anything already ISO-ish (e.g. a bare "2024" year) alone.
function normalizeDate(d: string): string {
  return /^\d{4}\.\d{2}\.\d{2}$/.test(d) ? d.replace(/\./g, "-") : d;
}

// Adds VisualArtwork + ExhibitionEvent entries (reusing data already entered in edit mode —
// no extra writing required) alongside the static Person JSON-LD in index.html, so search
// engines get a structured picture of individual works and exhibitions, not just the artist bio.
export function useStructuredData({ lang, artistName, artistNameEn, artworkList, imageUrls, currentExList, exhibitionList }: Input) {
  useEffect(() => {
    const creator = { "@type": "Person", name: artistName, alternateName: artistNameEn };
    const site = lang === "en" ? "https://jeonyeonmi.com/en" : "https://jeonyeonmi.com";

    // Uploaded artwork images live in the imageUrls map (keyed "artwork-<id>"), not on
    // w.image — that field is never actually written to, so filtering on it here used
    // to silently drop every real artwork from the structured data.
    const artworks = artworkList
      .map((w) => ({ w, image: imageUrls[`artwork-${w.id}`] }))
      .filter((e): e is { w: Artwork; image: string } => !!e.image)
      .map(({ w, image }) => ({
        "@type": "VisualArtwork",
        name: lang === "ko" ? w.title : w.titleEn,
        image,
        url: `${site}/works/${artworkSlug(w)}`,
        dateCreated: w.year || undefined,
        artMedium: lang === "ko" ? w.medium : w.mediumEn,
        artform: lang === "ko" ? w.category : w.categoryEn,
        description: (lang === "ko" ? w.description : w.descriptionEn) || undefined,
        creator,
      }));

    const current = currentExList.map((ex) => ({
      "@type": "ExhibitionEvent",
      name: lang === "ko" ? ex.title : ex.titleEn,
      startDate: normalizeDate(ex.startDate),
      endDate: normalizeDate(ex.endDate),
      location: { "@type": "Place", name: lang === "ko" ? ex.venue : ex.venueEn, address: lang === "ko" ? ex.location : ex.locationEn },
      organizer: creator,
    }));

    const history = exhibitionList.map((ex) => ({
      "@type": "ExhibitionEvent",
      name: lang === "ko" ? ex.title : ex.titleEn,
      startDate: ex.year || undefined,
      location: { "@type": "Place", name: lang === "ko" ? ex.venue : ex.venueEn, address: lang === "ko" ? ex.location : (ex.locationEn || ex.location) },
      organizer: creator,
    }));

    const graph = [...artworks, ...current, ...history];
    if (graph.length === 0) return;

    let script = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.type = "application/ld+json";
      document.head.appendChild(script);
    }
    script.textContent = JSON.stringify({ "@context": "https://schema.org", "@graph": graph });
  }, [lang, artistName, artistNameEn, artworkList, imageUrls, currentExList, exhibitionList]);
}
