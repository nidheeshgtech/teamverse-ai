import { Skeleton } from "@/ui/states";

export default function Loading() {
  return (
    <div className="flex flex-col gap-space-md px-margin-mobile py-space-lg lg:p-margin" aria-busy="true">
      <Skeleton className="h-16 w-96" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
