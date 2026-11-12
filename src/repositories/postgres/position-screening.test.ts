import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  candidates,
  candidateProfiles,
  candidateLanguages,
  candidateCertifications,
  candidateDrivingLicenses,
  companies,
  recruitmentSelections,
  jobDescriptions,
} from "@/db/schema";
import { positionKeywords } from "@/services/matching/position-keywords";
import { createSelectionService } from "@/services/company-service";
import { createTestDatabase, type TestDatabase } from "@/test/test-database";

describe("position screening on PostgreSQL", () => {
  let testDb: TestDatabase;
  let selectionId: string;
  let companyId: string;
  const criteria = positionKeywords({
    titles: ["Progettista impianti elettrici e termoidraulici"],
    requirements: ["Autocad inglese"],
  });
  const ids = new Map<string, string>();

  beforeAll(async () => {
    testDb = await createTestDatabase();
    const [company] = await testDb.db
      .insert(companies)
      .values({ name: "Azienda di prova", province: "BG" })
      .returning();
    companyId = company!.id;
    const [selection] = await testDb.db
      .insert(recruitmentSelections)
      .values({ companyId, title: "Progettista", status: "OPEN" })
      .returning();
    selectionId = selection!.id;
    await testDb.db
      .insert(jobDescriptions)
      .values({
        selectionId,
        title: "Progettista",
        duties: "Progettazione di impianti elettrici e termoidraulici",
        requirements: "Conoscenza software Autocad. Inglese.",
      });
    for (const [name, sector] of [
      ["Software", "Analisti e progettisti di software"],
      ["Elettrico", "Disegnatore tecnico di impianti elettrici"],
      ["Termico", "Progettista termotecnico"],
      ["Parziale", "Tecnico elettricista installatore"],
      ["SettoreMancante", "Disegnatore tecnico"],
      ["Generico", "Conduttore di impianti"],
      ["Commercialista", "Commercialista"],
    ]) {
      const [candidate] = await testDb.db.insert(candidates).values({ firstName: "Test", lastName: name! }).returning();
      ids.set(name!, candidate!.id);
      await testDb.db
        .insert(candidateProfiles)
        .values({
          candidateId: candidate!.id,
          experienceSector: sector!,
          experienceMonths: 60,
          residenceProvince: "BG",
          residenceRegion: "Lombardia",
        });
    }
    await testDb.db
      .insert(candidateLanguages)
      .values({ candidateId: ids.get("Elettrico")!, language: "Inglese", level: "B2" });
    await testDb.db.insert(candidateCertifications).values({ candidateId: ids.get("Elettrico")!, name: "Autocad" });
    await testDb.db
      .insert(candidateDrivingLicenses)
      .values({ candidateId: ids.get("Elettrico")!, category: "B", valid: true });
  }, 60_000);

  afterAll(async () => {
    await testDb?.close();
  });

  const query = () => ({
    roleKeywords: criteria.role,
    bonusKeywords: criteria.bonus,
    screening: criteria.screening,
    selectionId,
    limit: 100,
  });

  it("excludes a software designer, recognizes a technical synonym, and retains partial profiles for review", async () => {
    const result = await testDb.store.candidates.matchPosition(query());
    const byName = new Map(result.items.map((item) => [item.lastName, item]));
    expect(byName.has("Software")).toBe(false);
    expect(byName.has("Generico")).toBe(false);
    expect(byName.get("Elettrico")).toMatchObject({
      matchStatus: "COHERENT",
      experienceYears: 5,
      drivingLicense: "B",
      matchedRequirements: ["autocad", "inglese"],
    });
    expect(byName.get("Termico")?.matchStatus).toBe("COHERENT");
    expect(byName.get("Parziale")?.matchStatus).toBe("REVIEW");
    expect(byName.get("SettoreMancante")?.matchStatus).toBe("REVIEW");
    expect(result.items[0]?.lastName).toBe("Elettrico");
    expect((await testDb.store.candidates.matchPosition(query())).items.map((item) => item.candidateId)).toEqual(
      result.items.map((item) => item.candidateId),
    );
  });

  it("actually screens by the JD when the selection title only says designer", async () => {
    const service = createSelectionService({
      store: testDb.store,
      actor: { id: "00000000-0000-4000-8000-000000000000", name: "HR", email: "hr@example.test", roles: ["ADMIN"] },
    });
    const result = await service.compatibleCandidates(selectionId);
    expect(result?.keywords.screening.domainLabels).toEqual(["Elettrico", "Termoidraulico"]);
    expect(result?.items.map((item) => item.lastName)).not.toContain("Software");
    expect(result?.items.find((item) => item.lastName === "Elettrico")?.matchStatus).toBe("COHERENT");
  });

  it("does not confuse commercialista with commerciale", async () => {
    const result = await testDb.store.candidates.matchPosition({
      roleKeywords: ["commerciale"],
      bonusKeywords: [],
      selectionId,
      limit: 100,
    });
    expect(result.items.map((item) => item.lastName)).not.toContain("Commercialista");
  });

  it("uses the complete eligible pool for region and native driving-license filters, before the limit", async () => {
    const rows = await testDb.db
      .insert(candidates)
      .values(
        Array.from({ length: 106 }, (_, index) => ({
          firstName: "Bulk",
          lastName: `Candidato${String(index).padStart(3, "0")}`,
        })),
      )
      .returning();
    await testDb.db
      .insert(candidateProfiles)
      .values(
        rows.map((row, index) => ({
          candidateId: row.id,
          experienceSector: "Progettista elettrico",
          experienceMonths: index === 105 ? 12 : 120,
          residenceProvince: index === 105 ? "TN" : "BG",
          residenceRegion: index === 105 ? "Trentino-Alto Adige" : "Lombardia",
        })),
      );
    const target = rows[105]!.id;
    await testDb.db.insert(candidateDrivingLicenses).values({ candidateId: target, category: "B", valid: true });
    const bulkQuery = { ...query(), candidateIds: rows.map((row) => row.id) };
    const initial = await testDb.store.candidates.matchPosition(bulkQuery);
    expect(initial.total).toBe(106);
    expect(initial.items.map((item) => item.candidateId)).not.toContain(target);
    expect(initial.facets.regions).toContainEqual({ value: "Trentino-Alto Adige", count: 1 });
    expect(initial.facets.counts.license).toBe(1);
    for (const filters of [{ region: "Trentino-Alto Adige" }, { flags: ["license" as const] }]) {
      const result = await testDb.store.candidates.matchPosition({ ...bulkQuery, filters });
      expect(result.total).toBe(1);
      expect(result.items.map((item) => item.candidateId)).toEqual([target]);
    }
    const empty = await testDb.store.candidates.matchPosition({ ...bulkQuery, filters: { region: "Nessuna regione" } });
    expect(empty.total).toBe(0);
    expect(empty.items).toEqual([]);
    expect(empty.facets.regions).toHaveLength(2);
  });
});
