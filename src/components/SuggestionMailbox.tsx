import { Link } from "react-router-dom";
import { Mail, Sparkles, ArrowRight } from "lucide-react";

const SuggestionMailbox = () => {
  return (
    <section className="container mx-auto px-4 py-10 md:py-14">
      <Link
        to="/suggestions"
        className="group block relative overflow-hidden rounded-3xl border-2 border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background hover:border-primary hover:shadow-primary/30 transition-all shadow-xl"
      >
        <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 h-56 w-56 rounded-full bg-primary/10 blur-3xl pointer-events-none" />

        <div className="relative grid md:grid-cols-[auto,1fr,auto] items-center gap-6 md:gap-8 p-6 md:p-10">
          {/* Mailbox illustration */}
          <div className="flex justify-center md:justify-start">
            <div className="relative">
              {/* Mailbox body */}
              <div className="relative w-32 h-36 md:w-40 md:h-44 bg-gradient-to-b from-primary to-primary/70 rounded-t-full rounded-b-lg shadow-2xl shadow-primary/40 border-2 border-primary/50 group-hover:-translate-y-1 transition-transform">
                {/* Slot */}
                <div className="absolute top-6 left-1/2 -translate-x-1/2 w-20 md:w-24 h-2 bg-background/80 rounded-full shadow-inner" />
                {/* Door */}
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-16 md:w-20 h-12 md:h-14 bg-background/20 rounded border border-primary-foreground/30 flex items-center justify-center">
                  <Mail className="h-6 w-6 md:h-7 md:w-7 text-primary-foreground" />
                </div>
                {/* Flag */}
                <div className="absolute -right-2 top-10 w-6 h-8 bg-red-500 rounded-r-sm shadow-md group-hover:rotate-12 transition-transform origin-bottom-left">
                  <div className="absolute -left-0.5 top-0 w-1 h-full bg-red-700" />
                </div>
                <Sparkles className="absolute -top-2 -left-2 h-5 w-5 text-yellow-400 animate-pulse" />
                <Sparkles className="absolute -top-3 right-4 h-4 w-4 text-yellow-300 animate-pulse" style={{ animationDelay: "0.4s" }} />
              </div>
              {/* Pole */}
              <div className="mx-auto w-3 h-8 bg-gradient-to-b from-primary/60 to-primary/30 rounded-b-sm" />
            </div>
          </div>

          {/* Copy */}
          <div className="text-center md:text-left flex flex-col gap-2">
            <div className="inline-flex items-center gap-2 text-xs md:text-sm font-bold text-primary uppercase tracking-[0.2em] justify-center md:justify-start">
              <Sparkles className="h-4 w-4" /> Suggestion Mailbox
            </div>
            <h2 className="font-display text-2xl md:text-4xl font-black text-foreground leading-tight">
              Can't find what you're looking for?
            </h2>
            <p className="text-sm md:text-base text-muted-foreground max-w-xl">
              Request a missing product, suggest an improvement, or report a bug.
              We're connected to <span className="text-primary font-bold">100,000+ products</span> and would love to hear from you.
            </p>
          </div>

          {/* CTA */}
          <div className="flex justify-center md:justify-end">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-display font-bold tracking-wider shadow-lg shadow-primary/30 group-hover:translate-x-1 transition-transform">
              DROP A MESSAGE <ArrowRight className="h-4 w-4" />
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
};

export default SuggestionMailbox;