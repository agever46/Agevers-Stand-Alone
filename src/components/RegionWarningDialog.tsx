import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AlertTriangle } from "lucide-react";

interface RegionWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productRegion: string;
  userCountry: string;
  onConfirm: () => void;
}

export default function RegionWarningDialog({
  open,
  onOpenChange,
  productRegion,
  userCountry,
  onConfirm,
}: RegionWarningDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="glass border-yellow-500/30">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-yellow-500">
            <AlertTriangle className="h-5 w-5" />
            Region Mismatch
          </AlertDialogTitle>
          <AlertDialogDescription className="text-muted-foreground">
            This product is region-locked to <strong className="text-foreground">{productRegion}</strong> and 
            may not work in your detected location (<strong className="text-foreground">{userCountry}</strong>).
            <br /><br />
            Are you sure you want to continue?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-yellow-600 hover:bg-yellow-700 text-white"
          >
            Buy Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
