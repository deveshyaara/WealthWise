"use client";

import { useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Plus,
  AlertTriangle,
  AlertCircle,
  Trash2,
  Edit2,
  CheckCircle2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { defaultCategories, categoryColors } from "@/data/categories";
import { formatCurrency } from "@/lib/currency";
import { upsertCategoryBudget, deleteCategoryBudget } from "@/actions/budget";

export function CategoryBudgetManager({ categoryBudgets = [], accounts = [] }) {
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const expenseCategories = defaultCategories.filter(
    (c) => c.type === "EXPENSE"
  );

  const handleOpenDialog = (existingBudget = null) => {
    if (existingBudget) {
      setSelectedCategory(existingBudget.category);
      setSelectedAccountId(existingBudget.accountId || "all");
      setBudgetAmount(existingBudget.amount.toString());
    } else {
      setSelectedCategory(expenseCategories[0]?.id || "");
      setSelectedAccountId("all");
      setBudgetAmount("");
    }
    setIsDialogOpen(true);
  };

  const handleSaveBudget = async (e) => {
    e.preventDefault();
    const amountNum = parseFloat(budgetAmount);

    if (!selectedCategory) {
      toast.error("Please select a category.");
      return;
    }

    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid positive budget amount.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await upsertCategoryBudget({
        category: selectedCategory,
        amount: amountNum,
        accountId: selectedAccountId === "all" ? null : selectedAccountId,
      });

      if (res?.success) {
        toast.success(`Budget for ${selectedCategory} saved!`);
        setIsDialogOpen(false);
        router.refresh();
      } else {
        toast.error(res?.error || "Failed to save category budget.");
      }
    } catch (err) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBudget = async (id, categoryName) => {
    if (!confirm(`Delete budget for ${categoryName}?`)) return;

    try {
      setDeletingId(id);
      const res = await deleteCategoryBudget(id);
      if (res?.success) {
        toast.success(`Budget for ${categoryName} removed.`);
        router.refresh();
      } else {
        toast.error(res?.error || "Failed to delete budget.");
      }
    } catch (err) {
      toast.error(err.message || "Failed to delete budget.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <Card className="shadow-sm border">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-primary" />
            <CardTitle className="text-base font-semibold">
              Category Budgets & Thresholds
            </CardTitle>
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Monitor limits, 80% warning alerts, and monthly category spending
          </CardDescription>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              className="gap-1.5 h-8 text-xs font-medium"
              onClick={() => handleOpenDialog()}
            >
              <Plus className="h-4 w-4" />
              Add Category Budget
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">
                Configure Category Budget
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSaveBudget} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Expense Category
                </label>
                <Select
                  value={selectedCategory}
                  onValueChange={setSelectedCategory}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          <span>{cat.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Scope to Account
                </label>
                <Select
                  value={selectedAccountId}
                  onValueChange={setSelectedAccountId}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Accounts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Accounts</SelectItem>
                    {accounts.map((ac) => (
                      <SelectItem key={ac.id} value={ac.id}>
                        {ac.name} ({ac.currency || "USD"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground">
                  Monthly Budget Limit
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="500.00"
                  value={budgetAmount}
                  onChange={(e) => setBudgetAmount(e.target.value)}
                  className="h-9"
                  required
                />
              </div>

              <DialogFooter className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving..." : "Save Budget"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {categoryBudgets.length === 0 ? (
          <div className="text-center py-8 px-4 rounded-lg border border-dashed text-muted-foreground">
            <Layers className="mx-auto h-8 w-8 opacity-40 mb-2" />
            <p className="text-sm font-medium">No category budgets created</p>
            <p className="text-xs mt-1">
              Set spending limits on Dining, Shopping, Travel, and more to receive 80% & 100% threshold alerts.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {categoryBudgets.map((b) => {
              const categoryColor = categoryColors[b.category] || "#6366f1";
              const isOver = b.isExceeded;
              const isNear = b.isWarning80;

              return (
                <div
                  key={b.id}
                  className="rounded-lg border p-3.5 space-y-3 bg-card/60 transition-all hover:shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: categoryColor }}
                      />
                      <span className="font-semibold text-sm capitalize">
                        {b.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted">
                        {b.accountName}
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="Edit Limit"
                        onClick={() => handleOpenDialog(b)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Delete Budget"
                        onClick={() => handleDeleteBudget(b.id, b.category)}
                        disabled={deletingId === b.id}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5">
                    <Progress
                      value={Math.min(100, b.percentUsed)}
                      extraStyles={
                        isOver
                          ? "bg-rose-500"
                          : isNear
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }
                    />

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {formatCurrency(b.spent, b.currency)} of{" "}
                        {formatCurrency(b.amount, b.currency)}
                      </span>
                      <span
                        className={`font-semibold ${
                          isOver
                            ? "text-rose-600 dark:text-rose-400"
                            : isNear
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {b.percentUsed}%
                      </span>
                    </div>
                  </div>

                  {/* Status Indicator Badges */}
                  <div className="pt-0.5 flex items-center justify-between text-xs">
                    {isOver ? (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[11px]"
                      >
                        <AlertCircle className="h-3 w-3" />
                        Limit Exceeded by {formatCurrency(Math.abs(b.remaining), b.currency)}
                      </Badge>
                    ) : isNear ? (
                      <Badge
                        variant="secondary"
                        className="gap-1 bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30 text-[11px]"
                      >
                        <AlertTriangle className="h-3 w-3" />
                        Warning: 80% Threshold Reached
                      </Badge>
                    ) : (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                        {formatCurrency(b.remaining, b.currency)} available
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
