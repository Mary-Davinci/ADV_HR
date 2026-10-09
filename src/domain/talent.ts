import type { EntityId } from "./shared";

export interface TalentPool {
  id: EntityId;
  name: string;
  description: string | null;
  createdBy: EntityId | null;
  createdAt: Date;
  memberCount: number;
}

export interface TalentPoolMember {
  candidateId: EntityId;
  fullName: string;
  city: string | null;
  addedAt: Date;
}
