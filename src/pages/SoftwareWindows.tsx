import StorePage from "@/components/StorePage";
import { Monitor } from "lucide-react";

const categories = [
  { id: "windows", name: "Windows", icon: Monitor },
];

const SoftwareWindows = () => (
  <StorePage
    storeName="Windows"
    description="Browse Windows activation keys and licenses"
    categories={categories}
  />
);

export default SoftwareWindows;
