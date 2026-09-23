import { useRef, useState } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface UploadedFile {
  path: string;
  name: string;
}

interface MultiFileUploadFieldProps {
  label: string;
  required?: boolean;
  accept?: string;
  userId: string;
  folder: string;
  values: string[];
  onChange: (urls: string[]) => void;
  hint?: string;
  max?: number;
}

const MultiFileUploadField = ({
  label,
  required,
  accept = "image/*,.pdf",
  userId,
  folder,
  values,
  onChange,
  hint,
  max = 5,
}: MultiFileUploadFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fileNames, setFileNames] = useState<Record<string, string>>({});

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (values.length >= max) {
      toast.error(`Maximum ${max} files allowed`);
      return;
    }

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

    setFileNames((prev) => ({ ...prev, [path]: file.name }));
    onChange([...values, path]);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleRemove = async (path: string) => {
    await supabase.storage.from("seller-documents").remove([path]);
    onChange(values.filter((v) => v !== path));
    setFileNames((prev) => {
      const n = { ...prev };
      delete n[path];
      return n;
    });
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

      <div className="space-y-2">
        {values.map((path) => (
          <div
            key={path}
            className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2"
          >
            <FileText className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs text-foreground truncate flex-1">
              {fileNames[path] || "Uploaded file"}
            </span>
            <button
              type="button"
              onClick={() => handleRemove(path)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}

        {values.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-full h-16 rounded-md border-2 border-dashed border-border bg-secondary/50 hover:border-primary/40 transition-colors flex flex-col items-center justify-center gap-1 text-muted-foreground"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span className="text-[11px]">
                  Add file ({values.length}/{max})
                </span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
};

export default MultiFileUploadField;
