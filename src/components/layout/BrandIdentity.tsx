import Image from "next/image";
import { cn } from "@/lib/utils";

/** The logo comes from the optional logo.png at the repository/runtime root. */
export function BrandIdentity({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex h-16 items-center justify-center bg-transparent px-2 py-3",
        className,
      )}
    >
      <Image
        src="/brand/logo"
        alt="Catalyst Brands"
        width={176}
        height={44}
        unoptimized
        priority
        className="h-11 w-full max-w-44 object-contain"
      />
    </div>
  );
}
