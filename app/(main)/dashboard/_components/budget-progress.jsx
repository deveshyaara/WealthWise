"use client";

import { useState, useEffect } from "react";
import { Pencil, Check, X, AlertTriangle, AlertCircle } from "lucide-react";
import useFetch from "@/hooks/use-fetch";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { formatCurrency } from "@/lib/currency";
import { Badge } from "@/components/ui/badge";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateBudget } from "@/actions/budget";

export function BudgetProgress({ initialBudget, currentExpenses, currency = "USD" }) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const {
    loading: isLoading,
    fn: updateBudgetFn,
    data: updatedBudget,
    error,
  } = useFetch(updateBudget);

  const budget =
    updatedBudget?.success && updatedBudget.data
      ? updatedBudget.data
      : initialBudget;

  const [newBudget, setNewBudget] = useState(
    initialBudget?.amount?.toString() || ""
  );

  const rawPercentUsed =
    budget && budget.amount > 0 ? (currentExpenses / budget.amount) * 100 : 0;
  const percentUsed = Math.min(100, rawPercentUsed);
  const isOver = rawPercentUsed >= 100;
  const isNear = rawPercentUsed >= 80 && !isOver;

  const handleUpdateBudget = async () => {
    const amount = parseFloat(newBudget);

    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid positive amount");
      return;
    }

    const result = await updateBudgetFn(amount);
    if (result?.success) {
      setIsEditing(false);
      toast.success("Budget updated successfully");
      router.refresh();
    }
  };

  const handleCancel = () => {
    setNewBudget(budget?.amount?.toString() || "");
    setIsEditing(false);
  };

  useEffect(() => {
    if (error) {
      toast.error(error.message || "Failed to update budget");
    }
  }, [error]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">
              Monthly Budget (Default Account)
            </CardTitle>
            {budget && (
              <div>
                {isOver ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-xs"
                  >
                    <AlertCircle className="h-3 w-3" />
                    Budget Exceeded
                  </Badge>
                ) : isNear ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-xs"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    80% Threshold Reached
                  </Badge>
                ) : null}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1">
            {isEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={newBudget}
                  onChange={(e) => setNewBudget(e.target.value)}
                  className="w-32"
                  placeholder="Enter amount"
                  autoFocus
                  disabled={isLoading}
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleUpdateBudget}
                  disabled={isLoading}
                >
                  <Check className="h-4 w-4 text-green-500" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCancel}
                  disabled={isLoading}
                >
                  <X className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ) : (
              <>
                <CardDescription>
                  {budget
                    ? `${formatCurrency(currentExpenses, currency)} of ${formatCurrency(budget.amount, currency)} spent`
                    : "No budget set"}
                </CardDescription>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setIsEditing(true);
                    setNewBudget(budget?.amount?.toString() || "");
                  }}
                  className="h-6 w-6"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {budget && (
          <div className="space-y-2">
            <Progress
              value={percentUsed}
              extraStyles={
                isOver
                  ? "bg-rose-500"
                  : isNear
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }
            />
            <div className="flex justify-between items-center text-xs text-muted-foreground">
              <span>{rawPercentUsed.toFixed(1)}% used</span>
              <span>
                {budget.amount > currentExpenses
                  ? `${formatCurrency(budget.amount - currentExpenses, currency)} remaining`
                  : `${formatCurrency(currentExpenses - budget.amount, currency)} over`}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
