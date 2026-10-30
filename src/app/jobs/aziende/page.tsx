import { JobBoard } from "@/features/careers/components/job-board";

export default async function CompaniesJobs({ searchParams }: PageProps<"/jobs/aziende">) {
  const { q } = await searchParams;
  return <JobBoard board="aziende" query={typeof q === "string" ? q : ""} />;
}
