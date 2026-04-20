import { FileText } from "lucide-react";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function PlaceholderDocuments() {
  return (
    <PagePlaceholder
      icon={FileText}
      title="Documents"
      description="Factures clients et fournisseurs (Factur-X), avoirs, relevés bancaires, pièces justificatives. Upload manuel et import automatique depuis les événements Serenity."
      comingIn="Lot 4.x"
    />
  );
}
