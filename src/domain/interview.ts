import type { AuditInfo, EntityId, UserRef } from "./shared";

export const INTERVIEW_TYPES = ["SCREENING", "HR", "TECHNICAL", "CLIENT", "FOLLOW_UP", "OTHER"] as const;
export type InterviewType = (typeof INTERVIEW_TYPES)[number];

export const INTERVIEW_STATUSES = ["SCHEDULED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
export type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];

export interface Interview extends AuditInfo {
  id: EntityId;
  applicationId: EntityId;
  recruiterId: EntityId | null;
  scheduledAt: Date;
  durationMinutes: number | null;
  type: InterviewType;
  status: InterviewStatus;
  location: string | null;
  meetingUrl: string | null;
  notes: string | null;
}

export const FEEDBACK_TYPES = ["GENERAL", "INTERVIEW", "PHONE_SCREENING", "CLIENT", "INTERNAL_NOTE"] as const;
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** I feedback sono uno storico: non si sovrascrive un singolo campo note. */
export interface Feedback extends AuditInfo {
  id: EntityId;
  applicationId: EntityId;
  interviewId: EntityId | null;
  author: UserRef;
  type: FeedbackType;
  content: string;
}
