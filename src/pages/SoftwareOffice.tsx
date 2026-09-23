import StorePage from "@/components/StorePage";
import { FileText } from "lucide-react";

const categories = [
  { id: "office", name: "Office", icon: FileText },
];

const SoftwareOffice = () => (
  <StorePage
    storeName="Office"
    description="Browse Microsoft Office activation keys and licenses"
    categories={categories}
  />
);

export default SoftwareOffice;