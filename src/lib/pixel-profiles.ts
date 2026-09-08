/* Hand-drawn pixel-art portraits for a subset of players, served from
 * public/pixel-profiles/<slug>.png. When a player has one it's used in
 * place of the NHL headshot photo on their profile. Add a file to that
 * folder and its slug here to enable another player. */

const PIXEL_PROFILE_SLUGS = new Set([
  "adam-fox",
  "alex-debrincat",
  "alex-ovechkin",
  "artemi-panarin",
  "auston-matthews",
  "brady-tkachuk",
  "brandon-bussi",
  "brock-boeser",
  "brock-faber",
  "cale-makar",
  "charlie-mcavoy",
  "cole-caufield",
  "connor-bedard",
  "connor-hellebuyck",
  "connor-mcdavid",
  "david-pastrnak",
  "dylan-larkin",
  "elias-pettersson",
  "elias-pettersson-defense",
  "evan-bouchard",
  "filip-forsberg",
  "frederik-andersen",
  "ivan-demidov",
  "j-t-miller",
  "jaccob-slavin",
  "jack-eichel",
  "jack-hughes",
  "jake-guentzel",
  "jakub-dobes",
  "jason-robertson",
  "jesperi-kotkaniemi",
  "jordan-binnington",
  "juraj-slafkovsky",
  "kirill-kaprizov",
  "kyle-connor",
  "lane-hutson",
  "leo-carlsson",
  "leon-draisaitl",
  "luke-hughes",
  "macklin-celebrini",
  "mark-scheifele",
  "mark-stone",
  "martin-necas",
  "matthew-tkachuk",
  "matvei-michkov",
  "mike-matheson",
  "mitch-marner",
  "moritz-seider",
  "nathan-mackinnon",
  "nick-suzuki",
  "nikita-kucherov",
  "noah-dobson",
  "quinn-hughes",
  "rasmus-dahlin",
  "roman-josi",
  "ryan-leonard",
  "sebastian-aho",
  "seth-jarvis",
  "sidney-crosby",
  "tim-stutzle",
  "travis-konecny",
  "trevor-zegras",
  "victor-hedman",
  "will-smith",
  "william-nylander",
  "zach-werenski",
  "zeev-buium",
]);

/* Names shared by more than one player: pick the portrait by position so
 * the right player gets the right face. Keyed by the plain name slug, then
 * by the player's position; anything not listed falls back to the plain
 * slug. */
const POSITIONAL_PIXEL_SLUGS: Record<string, Partial<Record<string, string>>> = {
  "elias-pettersson": { D: "elias-pettersson-defense" },
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The public path to a player's pixel portrait, or null if they don't have one. */
export function pixelProfileFor(
  firstName: string,
  lastName: string,
  position?: string | null
): string | null {
  return pixelProfileForName(`${firstName} ${lastName}`, position);
}

/** Same, from an already-joined "First Last" name. */
export function pixelProfileForName(name: string, position?: string | null): string | null {
  const slug = slugify(name);
  const positional = position ? POSITIONAL_PIXEL_SLUGS[slug]?.[position] : undefined;
  if (positional && PIXEL_PROFILE_SLUGS.has(positional)) {
    return `/pixel-profiles/${positional}.png`;
  }
  return PIXEL_PROFILE_SLUGS.has(slug) ? `/pixel-profiles/${slug}.png` : null;
}
