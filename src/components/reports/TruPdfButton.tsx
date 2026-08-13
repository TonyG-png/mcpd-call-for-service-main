import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";

export default function TruPdfButton({ onCreate }: { onCreate: () => Promise<void> }) {
  const [isCreating, setIsCreating] = useState(false);

  const create = async () => {
    setIsCreating(true);
    try {
      await onCreate();
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <button
      type="button"
      onClick={create}
      disabled={isCreating}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:cursor-wait disabled:opacity-70"
    >
      {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      {isCreating ? "Creating PDF..." : "Create PDF"}
    </button>
  );
}
