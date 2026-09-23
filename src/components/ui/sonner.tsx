import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      position="top-center"
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      duration={6000}
      closeButton
      expand
      // The fixed navbar sits at an extremely high z-index (it must always
      // stay above page content), so a toast at the very top of the
      // viewport rendered underneath it — invisible until a second toast
      // stacked further down. Offset below the navbar (and the yellow
      // new-account banner, when shown) instead of trying to out-z-index it.
      offset={{ top: "calc(var(--new-account-banner-height, 0px) + 8rem)" }}
      mobileOffset={{ top: "calc(var(--new-account-banner-height, 0px) + 5rem)" }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "group-[.toast]:!bg-destructive group-[.toast]:!text-white group-[.toast]:!border-destructive hover:group-[.toast]:!bg-destructive/90 group-[.toast]:!opacity-100",
          icon: "hidden",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
