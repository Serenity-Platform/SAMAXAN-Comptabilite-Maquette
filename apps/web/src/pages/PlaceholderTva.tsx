import { Receipt } from "lucide-react";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function PlaceholderTva() {
  return (
    <PagePlaceholder
      icon={Receipt}
      title="TVA"
      description="Calcul automatique de la TVA collectée et déductible depuis les écritures, génération de la déclaration CA3, export PDF conforme. Couvre les cas franchise, réel simplifié, réel normal, et mini-réel."
      comingIn="Lot 4.x"
    />
  );
}
