import { JobBoard } from "@/features/careers/components/job-board";

export default async function InternalJobs({ searchParams }: PageProps<"/jobs/Careers">) {
  const { q } = await searchParams;
  return <JobBoard board="Careers" query={typeof q === "string" ? q : ""} />;
}
