export const CAREER_BOARDS = ["aziende", "Careers"] as const;
export type CareerBoard = (typeof CAREER_BOARDS)[number];
export const CAREERS_PRIVACY_URL = "https://www.davinciformazione.com/privacy-policy/";
export const CAREERS_PRIVACY_VERSION = "2026-10-30";

export interface PublicJobContent {
  title: string;
  employer: string;
  location: string;
  summary: string;
  duties: string;
  requirements: string;
  contract: string;
}
