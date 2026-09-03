import { ProjectView } from "./project-view";

export default async function ProjectDetailPage({
  params,
}: PageProps<"/projects/[id]">) {
  const { id } = await params;
  return <ProjectView projectId={id} />;
}
