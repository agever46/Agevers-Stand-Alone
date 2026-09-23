import { useNavigate } from "react-router-dom";
import { Gamepad2 } from "lucide-react";
import SectionBanner from "@/components/SectionBanner";
import steamLogo from "@/assets/platforms/steam.png";
import playstationLogo from "@/assets/platforms/playstation.png";
import xboxLogo from "@/assets/platforms/xbox.png";
import nintendoLogo from "@/assets/platforms/nintendo.png";
import epicLogo from "@/assets/platforms/epic.png";
import eaLogo from "@/assets/platforms/ea.png";
import gogLogo from "@/assets/platforms/gog.png";
import giftcardsLogo from "@/assets/platforms/giftcards.png";
import platformsBanner from "@/assets/banners/platforms_new.jpg";

const platforms = [
  { name: "Steam", href: "/steam", icon: "🎮", gradient: "from-[hsl(215,80%,15%)] to-[hsl(215,90%,8%)]", logo: steamLogo, logoOnly: true },
  { name: "PlayStation", href: "/playstation", icon: "🎯", gradient: "from-[hsl(220,70%,45%)] to-[hsl(220,80%,25%)]", logo: playstationLogo, logoOnly: true },
  { name: "Xbox", href: "/xbox", icon: "🟢", gradient: "from-[hsl(120,60%,35%)] to-[hsl(120,70%,20%)]", logo: xboxLogo, logoOnly: true },
  { name: "Nintendo", href: "/nintendo", icon: "🔴", gradient: "from-[hsl(0,70%,45%)] to-[hsl(0,70%,30%)]", logo: nintendoLogo, logoOnly: true },
  { name: "Epic Games", href: "/epic-games", icon: "⚡", gradient: "from-[hsl(240,10%,30%)] to-[hsl(240,10%,15%)]", logo: epicLogo, logoOnly: true },
  { name: "EA Games", href: "/ea-games", icon: "⚽", gradient: "from-[hsl(200,70%,40%)] to-[hsl(200,80%,22%)]", logo: eaLogo, logoOnly: true },
  { name: "GOG", href: "/gog", icon: "🌐", gradient: "from-[hsl(280,50%,40%)] to-[hsl(280,60%,22%)]", logo: gogLogo, logoOnly: true },
  { name: "Gift Cards", href: "/gift-cards", icon: "🎁", gradient: "from-[hsl(45,80%,45%)] to-[hsl(30,70%,30%)]", logo: giftcardsLogo, logoOnly: true },
];

const BrowseByPlatform = () => {
  const navigate = useNavigate();

  return (
    <section className="py-12">
      <div className="container mx-auto px-4">
        <SectionBanner image={platformsBanner} title="BROWSE BY PLATFORM" icon={Gamepad2} iconColor="gradient-primary" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {platforms.map((platform) => (
            <button
              key={platform.name}
              onClick={() => navigate(platform.href)}
               className="relative overflow-hidden bg-transparent border-0 rounded-none p-0 flex flex-col items-center justify-center gap-2 aspect-square group cursor-pointer hover:scale-105 transition-transform"
             >
               {!platform.logoOnly && <div className="absolute inset-0 bg-white/0 group-hover:bg-white/5 transition-colors duration-300" />}
               {platform.logo ? (
                <img src={platform.logo} alt={platform.name} className="h-32 w-32 md:h-36 md:w-36 object-contain relative z-10" />
              ) : (
                <span className="text-3xl md:text-4xl relative z-10">{platform.icon}</span>
              )}
              <span className={`font-display text-[10px] md:text-xs font-bold tracking-wider relative z-10 text-center leading-tight ${platform.logoOnly ? "text-foreground" : "text-white"}`}>
                 {platform.name.toUpperCase()}
               </span>
               {!platform.logoOnly && <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 box-glow rounded-xl" />}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default BrowseByPlatform;
