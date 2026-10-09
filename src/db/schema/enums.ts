import { pgEnum } from "drizzle-orm/pg-core";

import { ACTIVITY_ACTIONS, ACTIVITY_ENTITY_TYPES, AUDIT_ACTIONS } from "../../domain/activity";
import {
  ACTIVE_POLICY_PROGRAMS,
  ACTIVE_POLICY_STATUSES,
  AVAILABILITY_TYPES,
  DRIVING_LICENSE_CATEGORIES,
  EDUCATION_LEVELS,
  EMPLOYMENT_STATUSES,
  GENDERS,
  LANGUAGE_LEVELS,
  PROTECTED_CATEGORIES,
  SKILL_CATEGORIES,
  WORK_MODES,
  WORK_TIMES,
} from "../../domain/candidate";
import { COMPANY_SOURCES } from "../../domain/company";
import { DOCUMENT_PROCESSING_STATUSES, DOCUMENT_TYPES, STORAGE_PROVIDERS } from "../../domain/document";
import { FEEDBACK_TYPES, INTERVIEW_STATUSES, INTERVIEW_TYPES } from "../../domain/interview";
import { LEGACY_ENTITY_TYPES, LEGACY_SYSTEMS } from "../../domain/legacy";
import {
  MATCHING_EVIDENCE_STATUSES,
  MATCHING_OVERALL_STATUSES,
  MATCHING_REQUIREMENT_CODES,
} from "../../domain/matching";
import { APPLICATION_SOURCES, EVALUATION_RESULTS, SELECTION_STATUSES } from "../../domain/recruiting";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../domain/task";

/**
 * Enum PostgreSQL generati dalle costanti di dominio (unica fonte di verità).
 * Aggiungere un valore = modificare il dominio + nuova migration (ALTER TYPE ... ADD VALUE).
 * La pipeline di recruiting NON è un enum: vive nella tabella `recruiting_stages`.
 */
export const genderEnum = pgEnum("gender", GENDERS);
export const protectedCategoryEnum = pgEnum("protected_category", PROTECTED_CATEGORIES);
export const employmentStatusEnum = pgEnum("employment_status", EMPLOYMENT_STATUSES);
export const workTimeEnum = pgEnum("work_time", WORK_TIMES);
export const workModeEnum = pgEnum("work_mode", WORK_MODES);
export const availabilityEnum = pgEnum("availability_type", AVAILABILITY_TYPES);
export const educationLevelEnum = pgEnum("education_level", EDUCATION_LEVELS);
export const skillCategoryEnum = pgEnum("skill_category", SKILL_CATEGORIES);
export const languageLevelEnum = pgEnum("language_level", LANGUAGE_LEVELS);
export const drivingLicenseCategoryEnum = pgEnum("driving_license_category", DRIVING_LICENSE_CATEGORIES);
export const activePolicyProgramEnum = pgEnum("active_policy_program", ACTIVE_POLICY_PROGRAMS);
export const activePolicyStatusEnum = pgEnum("active_policy_status", ACTIVE_POLICY_STATUSES);

export const companySourceEnum = pgEnum("company_source", COMPANY_SOURCES);
export const selectionStatusEnum = pgEnum("selection_status", SELECTION_STATUSES);
export const applicationSourceEnum = pgEnum("application_source", APPLICATION_SOURCES);
export const evaluationResultEnum = pgEnum("evaluation_result", EVALUATION_RESULTS);

export const interviewTypeEnum = pgEnum("interview_type", INTERVIEW_TYPES);
export const interviewStatusEnum = pgEnum("interview_status", INTERVIEW_STATUSES);
export const feedbackTypeEnum = pgEnum("feedback_type", FEEDBACK_TYPES);

export const activityEntityTypeEnum = pgEnum("activity_entity_type", ACTIVITY_ENTITY_TYPES);
export const activityActionEnum = pgEnum("activity_action", ACTIVITY_ACTIONS);
export const auditActionEnum = pgEnum("audit_action", AUDIT_ACTIONS);

export const taskPriorityEnum = pgEnum("task_priority", TASK_PRIORITIES);
export const taskStatusEnum = pgEnum("task_status", TASK_STATUSES);

export const documentTypeEnum = pgEnum("document_type", DOCUMENT_TYPES);
export const storageProviderEnum = pgEnum("storage_provider", STORAGE_PROVIDERS);
export const documentProcessingStatusEnum = pgEnum("document_processing_status", DOCUMENT_PROCESSING_STATUSES);

export const legacySystemEnum = pgEnum("legacy_system", LEGACY_SYSTEMS);
export const legacyEntityTypeEnum = pgEnum("legacy_entity_type", LEGACY_ENTITY_TYPES);

export const matchingRequirementCodeEnum = pgEnum("matching_requirement_code", MATCHING_REQUIREMENT_CODES);
export const matchingEvidenceStatusEnum = pgEnum("matching_evidence_status", MATCHING_EVIDENCE_STATUSES);
export const matchingOverallStatusEnum = pgEnum("matching_overall_status", MATCHING_OVERALL_STATUSES);
