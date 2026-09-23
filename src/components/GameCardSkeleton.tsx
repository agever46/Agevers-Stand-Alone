import { Skeleton } from "@/components/ui/skeleton";

const GameCardSkeleton = () => (
  <div className="glass rounded-lg overflow-hidden flex flex-col">
    <Skeleton className="aspect-[3/4] w-full" />
    <div className="p-4 flex flex-col flex-1">
      <Skeleton className="h-3 w-16 mb-2" />
      <Skeleton className="h-4 w-full mb-1" />
      <Skeleton className="h-4 w-3/4 mb-4" />
      <div className="mt-auto">
        <Skeleton className="h-6 w-20 mb-3" />
        <div className="flex justify-end gap-2">
          <Skeleton className="h-9 w-9 rounded-md" />
          <Skeleton className="h-8 w-20 rounded-md" />
        </div>
      </div>
    </div>
  </div>
);

export const GameCardSkeletonGrid = ({ count = 12 }: { count?: number }) => (
  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
    {Array.from({ length: count }).map((_, i) => (
      <GameCardSkeleton key={i} />
    ))}
  </div>
);

export default GameCardSkeleton;
