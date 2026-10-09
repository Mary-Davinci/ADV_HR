import { endOfDay, endOfWeek, startOfDay, startOfWeek, subDays } from "date-fns";

import type { Activity } from "@/domain";
import { assertCan, can } from "@/lib/auth/permissions";
import type { InterviewView, SelectionListItem, TaskView } from "@/repositories/types";

import { nowOf, type ServiceContext } from "./context";

export const NEW_CANDIDATE_WINDOW_DAYS = 7;

export interface DashboardSummary {
  kpi: {
    activeCandidates: number;
    newCandidates: number;
    interviewsToday: number;
    interviewsThisWeek: number;
    openSelections: number;
    applicationsToReview: number;
    candidatesWithoutFeedback: number;
    overdueTasks: number;
  };
  upcomingInterviews: InterviewView[];
  recentActivities: Activity[];
  myTasks: TaskView[];
  activeSelections: SelectionListItem[];
}

export function createDashboardService(context: ServiceContext) {
  const { store, actor } = context;

  return {
    async getSummary(): Promise<DashboardSummary> {
      assertCan(actor, "candidate.read");
      const now = nowOf(context);
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      const weekEnd = endOfWeek(now, { weekStartsOn: 1 });
      const activeInterviewStatuses = ["SCHEDULED", "COMPLETED"] as const;
      const canReadTasks = can(actor, "task.read");

      const [
        activeCandidates,
        newCandidates,
        interviewsToday,
        interviewsThisWeek,
        openSelections,
        applicationsToReview,
        candidatesWithoutFeedback,
        overdueTasks,
        upcoming,
        recentActivities,
        myTasks,
        activeSelections,
      ] = await Promise.all([
        store.reports.countCandidates({ activeOnly: true }),
        store.reports.countCandidates({ createdSince: subDays(now, NEW_CANDIDATE_WINDOW_DAYS) }),
        store.interviews.count({ from: startOfDay(now), to: endOfDay(now), statuses: [...activeInterviewStatuses] }),
        store.interviews.count({ from: weekStart, to: weekEnd, statuses: [...activeInterviewStatuses] }),
        store.reports.countSelections({ statuses: ["OPEN"] }),
        store.reports.countApplications({ stageCodes: ["NEW", "TO_REVIEW"] }),
        store.reports.countCandidates({ withoutFeedback: true }),
        canReadTasks ? store.tasks.count({ statuses: ["OPEN", "IN_PROGRESS"], overdueAt: now }) : 0,
        store.interviews.list({ from: now, statuses: ["SCHEDULED"], limit: 6 }),
        store.activities.list({ limit: 8 }),
        canReadTasks
          ? store.tasks.list({ assignedTo: actor.id, statuses: ["OPEN", "IN_PROGRESS"], limit: 5 })
          : { items: [], total: 0 },
        store.selections.list({ statuses: ["OPEN", "PAUSED"], limit: 5 }),
      ]);

      return {
        kpi: {
          activeCandidates,
          newCandidates,
          interviewsToday,
          interviewsThisWeek,
          openSelections,
          applicationsToReview,
          candidatesWithoutFeedback,
          overdueTasks,
        },
        upcomingInterviews: upcoming.items,
        recentActivities,
        myTasks: myTasks.items,
        activeSelections: activeSelections.items,
      };
    },
  };
}

export function createReportService(context: ServiceContext) {
  const { store, actor } = context;

  return {
    async getReport(range: { from: Date; to: Date }) {
      assertCan(actor, "reports.read");
      const [
        candidatesByStage,
        applicationsByStage,
        applicationsBySource,
        selectionsByStatus,
        interviewsByStatus,
        evaluations,
      ] = await Promise.all([
        store.reports.candidatesByStage(),
        store.reports.applicationsByStage(range),
        store.reports.applicationsBySource(range),
        store.reports.selectionsByStatus(),
        store.reports.interviewsByStatus(range),
        store.reports.evaluationsByResult(range),
      ]);
      return {
        candidatesByStage,
        applicationsByStage,
        applicationsBySource,
        selectionsByStatus,
        interviewsByStatus,
        evaluations,
      };
    },
  };
}
