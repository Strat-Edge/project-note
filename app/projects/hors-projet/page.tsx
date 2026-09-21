import { ProjectView } from "../[id]/project-view";

// Tableau de bord du pseudo-projet « Hors projet » — les tâches générales (projectId: null,
// FR-2). Entrée VIRTUELLE : aucune ligne Project n'existe en base pour elle, la vérité de
// stockage reste `projectId: null` sur les tâches. C'est ce qui la rend structurellement
// non renommable, non archivable et non supprimable, et évite à la fois une migration du
// modèle (Task.projectId reste `string | null`) et un id sentinelle à synchroniser entre
// appareils.
//
// Segment statique : Next.js le fait primer sur le segment dynamique frère [id], et aucun
// projet réel ne peut le masquer puisque leurs id sont des UUID (crypto.randomUUID, cf.
// data/local/projects.ts). Tenu en phase avec NO_PROJECT_FILTER_ID (domain/calendar.ts),
// qui sert d'identifiant à la même entrée dans le filtre du calendrier général.
export default function HorsProjetPage() {
  return <ProjectView projectId={null} />;
}
