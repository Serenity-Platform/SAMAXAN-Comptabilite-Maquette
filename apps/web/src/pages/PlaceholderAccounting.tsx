import { BookOpen } from "lucide-react";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function PlaceholderAccounting() {
  return (
    <PagePlaceholder
      icon={BookOpen}
      title="Comptabilité"
      description="Consultation des écritures comptables par journal, visualisation de la balance, de la grand livre, et export FEC conforme LPF. Arrive après l'intégration des flux bancaires et du moteur de règles TVA."
      comingIn="Lot 2.3"
    />
  );
}
