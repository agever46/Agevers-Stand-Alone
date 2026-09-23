import { useRef, useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface FileUploadFieldProps {
  label: string;
  required?: boolean;
  accept?: string;
  userId: string;
  folder: string;
  value: string | null;
  onChange: (url: string | null) => void;
  hint?: string;
}

const FileUploadField = ({
  label,
  required,
  accept = "image/*,.pdf",
  userId,
  folder,
  value,
  onChange,
  hint,
}: FileUploadFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("File must be under 10MB");
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${userId}/${folder}/${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("seller-documents")
      .upload(path, file, { upsert: true });

    setUploading(false);

    if (error) {
      toast.error("Upload failed: " + error.message);
      return;
    }

    setFileName(file.name);
    onChange(path);
  };

  const handleRemove = async () => {
    if (value) {
      await supabase.storage.from("seller-documents").remove([value]);
    }
    onChange(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      <label className="text-xs font-display font-semibold text-foreground mb-1 block">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      {hint && (
        <p className="text-[10px] text-muted-foreground mb-1.5">{hint}</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleUpload}
      />
      {!value ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-20 rounded-md border-2 border-dashed border-border bg-secondary/50 hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground"
        >
          {uploading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <>
              <Upload className="h-5 w-5" />
              <span className="text-xs">Click to upload</span>
            </>
          )}
        </button>
      ) : (
        <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2">
          <FileText className="h-4 w-4 text-primary shrink-0" />
          <span className="text-xs text-foreground truncate flex-1">
            {fileName || "Uploaded"}
          </span>
          <button
            type="button"
            onClick={handleRemove}
            className="text-muted-foreground hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUploadField;
