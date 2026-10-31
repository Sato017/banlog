/** AniList 通用题材；value 必须与 GraphQL genre 参数完全一致。 */
export const GENRE_OPTIONS = [
  { value: "Action", label: "动作 Action" },
  { value: "Adventure", label: "冒险 Adventure" },
  { value: "Comedy", label: "喜剧 Comedy" },
  { value: "Drama", label: "剧情 Drama" },
  { value: "Fantasy", label: "奇幻 Fantasy" },
  { value: "Horror", label: "恐怖 Horror" },
  { value: "Mahou Shoujo", label: "魔法少女 Mahou Shoujo" },
  { value: "Mecha", label: "机甲 Mecha" },
  { value: "Music", label: "音乐 Music" },
  { value: "Mystery", label: "悬疑 Mystery" },
  { value: "Psychological", label: "心理 Psychological" },
  { value: "Romance", label: "恋爱 Romance" },
  { value: "Sci-Fi", label: "科幻 Sci-Fi" },
  { value: "Slice of Life", label: "日常 Slice of Life" },
  { value: "Sports", label: "运动 Sports" },
  { value: "Supernatural", label: "超自然 Supernatural" },
  { value: "Thriller", label: "惊悚 Thriller" },
] as const;

export type GenreValue = (typeof GENRE_OPTIONS)[number]["value"];

const SUPPORTED_GENRES = new Set<string>(
  GENRE_OPTIONS.map((option) => option.value),
);

export function isSupportedGenre(value: string): value is GenreValue {
  return SUPPORTED_GENRES.has(value);
}
