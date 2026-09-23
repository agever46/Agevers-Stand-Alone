import StorePage from "@/components/StorePage";
import { Sparkles } from "lucide-react";

const categories = [
  { id: "ai", name: "AI", icon: Sparkles },
];

const SoftwareAI = () => (
  <StorePage
    storeName="AI"
    description="Browse AI software licenses, subscriptions and tools"
    categories={categories}
  />
);

export default SoftwareAI;