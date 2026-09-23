/**
 * Single source of truth for platform & sub-platform categories.
 * Used by the Navbar navigation AND Admin product forms.
 * 
 * To add a new category:
 *  1. Add an entry to PLATFORM_CATEGORIES below
 *  2. It will automatically appear in the navbar AND admin dropdowns
 */

export interface SubCategory {
  name: string;
  href: string;
}

export interface PlatformCategory {
  name: string;
  href: string;
  subcategories?: SubCategory[];
}

export const PLATFORM_CATEGORIES: PlatformCategory[] = [
  {
    name: "PC",
    href: "#pc",
    subcategories: [
      { name: "Steam", href: "/steam" },
      
      { name: "Microsoft Store", href: "/microsoft-store" },
      { name: "GOG", href: "/gog" },
      { name: "Epic Games", href: "/epic-games" },
      { name: "Blizzard", href: "/blizzard" },
      { name: "EA Games", href: "/ea-games" },
      { name: "Rockstar", href: "/rockstar" },
    ],
  },
  {
    name: "Xbox",
    href: "/xbox",
    subcategories: [
      { name: "Games", href: "/xbox?tab=games" },
      { name: "DLC", href: "/xbox?tab=dlc" },
      { name: "Subscriptions", href: "/xbox?tab=subscriptions" },
      { name: "Top Ups", href: "/xbox?tab=topups" },
    ],
  },
  {
    name: "PlayStation",
    href: "/playstation",
    subcategories: [
      { name: "Games", href: "/playstation?tab=games" },
      { name: "DLC", href: "/playstation?tab=dlc" },
      { name: "Subscriptions", href: "/playstation?tab=subscriptions" },
      { name: "Top Ups", href: "/playstation?tab=topups" },
    ],
  },
  {
    name: "Nintendo",
    href: "/nintendo",
    subcategories: [
      { name: "Games", href: "/nintendo?tab=games" },
      { name: "DLC", href: "/nintendo?tab=dlc" },
      { name: "Subscriptions", href: "/nintendo?tab=subscriptions" },
      { name: "Top Ups", href: "/nintendo?tab=topups" },
    ],
  },
  {
    name: "Software",
    href: "/software",
    subcategories: [
      { name: "Windows", href: "/software/windows" },
      { name: "Office", href: "/software/office" },
      { name: "Anti-Virus", href: "/software/anti-virus" },
    ],
  },
  { name: "In-Game Items", href: "/in-game-items" },
  
  { name: "Gift Cards", href: "/gift-cards" },
  { name: "Media & Streaming", href: "/media-streaming" },
  { name: "Mobile", href: "/mobile" },
  { name: "Pre-Order", href: "/pre-order" },
];

/**
 * Derived map: platform name → sub-platform names.
 * Used by Admin product forms for dropdowns.
 * Categories without subcategories use their own name as the single sub-platform.
 */
export const SUB_PLATFORM_MAP: Record<string, string[]> = Object.fromEntries(
  PLATFORM_CATEGORIES.map((cat) => [
    cat.name,
    cat.subcategories?.map((sc) => sc.name) ?? [cat.name],
  ])
);

export const getSubPlatforms = (platform: string): string[] =>
  SUB_PLATFORM_MAP[platform] || SUB_PLATFORM_MAP["PC"];
