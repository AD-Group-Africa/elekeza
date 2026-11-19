import { LoadingState } from '@/components/ui';

export default function AppRouteLoading() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" aria-busy="true">
      <LoadingState label="Opening page…" />
    </div>
  );
}
