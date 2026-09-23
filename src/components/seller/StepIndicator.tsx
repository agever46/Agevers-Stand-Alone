import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}

const StepIndicator = ({ currentStep, totalSteps, labels }: StepIndicatorProps) => (
  <div className="flex items-center justify-center gap-2 mb-8">
    {Array.from({ length: totalSteps }, (_, i) => {
      const step = i + 1;
      const isActive = step === currentStep;
      const isDone = step < currentStep;
      return (
        <div key={step} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors ${
                isDone
                  ? "bg-primary border-primary text-primary-foreground"
                  : isActive
                  ? "border-primary text-primary bg-primary/10"
                  : "border-border text-muted-foreground"
              }`}
            >
              {isDone ? <Check className="h-4 w-4" /> : step}
            </div>
            <span
              className={`text-[10px] font-display tracking-wider whitespace-nowrap ${
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              }`}
            >
              {labels[i]}
            </span>
          </div>
          {i < totalSteps - 1 && (
            <div
              className={`w-8 h-0.5 mb-4 ${
                isDone ? "bg-primary" : "bg-border"
              }`}
            />
          )}
        </div>
      );
    })}
  </div>
);

export default StepIndicator;
