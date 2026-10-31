export const BANLOG_SEARCH_EVENT = "banlog:search" as const;

export interface BanLogSearchDetail {
  query: string;
}
