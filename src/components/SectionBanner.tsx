import { type LucideIcon } from "lucide-react";

interface SectionBannerProps {
  image: string;
  title: string;
  icon: LucideIcon;
  iconColor?: string;
  children?: React.ReactNode;
}

const SectionBanner = ({ image, title, children }: SectionBannerProps) => (
  <div className="mb-5">
    <div className="w-full rounded-xl overflow-hidden bg-background">
      <img
        src={image}
        alt={title}
        className="w-full max-h-56 md:max-h-80 object-contain"
        loading="lazy"
      />
    </div>
    {children && (
      <div className="flex items-center justify-end mt-3">
        {children}
      </div>
    )}
  </div>
);

export default SectionBanner;
