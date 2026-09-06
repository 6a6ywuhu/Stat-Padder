/* Hand-drawn pixel-art portraits for a subset of players, served from
 * public/pixel-profiles/<slug>.png. When a player has one it's used in
 * place of the NHL headshot photo on their profile. Add a file to that
 * folder and its slug here to enable another player. */

const PIXEL_PROFILE_SLUGS = new Set([
  "artemi-panarin",
  "auston-matthews",
  "brandon-bussi",
  "brock-faber",
  "cale-makar",
  "charlie-mcavoy",
  "connor-bedard",
  "connor-hellebuyck",
  "connor-mcdavid",
  "david-pastrnak",
  "elias-pettersson",
  "evan-bouchard",
  "frederik-andersen",
  "jack-hughes",
  "jake-guentzel",
  "jason-robertson",
  "jesperi-kotkaniemi",
  "kirill-kaprizov",
  "kyle-connor",
  "leon-draisaitl",
  "luke-hughes",
  "macklin-celebrini",
  "mark-scheifele",
  "nathan-mackinnon",
  "nick-suzuki",
  "nikita-kucherov",
  "quinn-hughes",
  "rasmus-dahlin",
  "sebastian-aho",
  "seth-jarvis",
  "sidney-crosby",
  "victor-hedman",
  "will-smith",
  "william-nylander",
  "zeev-buium",
]);

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining accents
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** The public path to a player's pixel portrait, or null if they don't have one. */
export function pixelProfileFor(firstName: string, lastName: string): string | null {
  return pixelProfileForName(`${firstName} ${lastName}`);
}

/** Same, from an already-joined "First Last" name. */
export function pixelProfileForName(name: string): string | null {
  const slug = slugify(name);
  return PIXEL_PROFILE_SLUGS.has(slug) ? `/pixel-profiles/${slug}.png` : null;
}
