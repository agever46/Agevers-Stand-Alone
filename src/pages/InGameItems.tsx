import StorePage from "@/components/StorePage";

const InGameItems = () => (
  <StorePage
    storeName="In-Game Items"
    description="Browse in-game currencies, V-Bucks, Robux, Riot Points and more"
    platformMode
    autoGroupPage="In-Game Items"
    showProductsWithAutoGroups
    categories={[]}
  />
);

export default InGameItems;
