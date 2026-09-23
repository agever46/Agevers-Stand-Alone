import { TrendingSection, NewReleasesSection } from "@/components/HomeSections";
import BrowseByPlatform from "@/components/BrowseByPlatform";
import CustomerReviews from "@/components/CustomerReviews";
import StatsSection from "@/components/StatsSection";
import BestsellersSection from "@/components/BestsellersSection";
import PreOrdersSection from "@/components/PreOrdersSection";
import RecentlyViewedSection from "@/components/RecentlyViewedSection";
import JustForYouSection from "@/components/JustForYouSection";
const HeroSection = () => {
  return (
    <section className="relative flex flex-col bg-background">
      <NewReleasesSection />
      <RecentlyViewedSection />
      <JustForYouSection />
      <PreOrdersSection />
      <TrendingSection />
      <BestsellersSection />
      <BrowseByPlatform />
      <StatsSection />
      <CustomerReviews />
    </section>
  );
};

export default HeroSection;
