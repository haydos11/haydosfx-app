import React from "react";
import AppShell from "@/components/shell/AppShell";
import { Card, CardContent } from "@/components/ui/card";
import FxStrengthChart from "./FxStrengthChart";

export default async function Page() {
  return (
    <AppShell title="Currency Strength">
      <div className="grid gap-6">
        <Card className="p-4">
          <CardContent className="p-0">
            <h2 className="text-2xl font-semibold mb-1">Currency Strength Chart</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Equal-weighted G8 indices built from Yahoo daily closes; normalized to 0 at the left edge.
            </p>
            <FxStrengthChart days={30} />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
