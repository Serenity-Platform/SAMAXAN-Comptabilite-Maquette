import { Landmark } from "lucide-react";
import { PagePlaceholder } from "../components/PagePlaceholder";

export function PlaceholderBank() {
  return (
    <PagePlaceholder
      icon={Landmark}
      title="Banque"
      description="Connexion Revolut Business, import automatique des transactions, rapprochement bancaire, et gestion des multi-devises. Premier flux comptable réel intégré à Paperasse."
      comingIn="Lot 2.1"
    />
  );
}
