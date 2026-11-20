import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";
import { dataSourceName } from "@/lib/sources";

export const dynamic = "force-dynamic";

export default function Home() {
  return (
    <Suspense>
      <Dashboard dataSource={dataSourceName()} />
    </Suspense>
  );
}
