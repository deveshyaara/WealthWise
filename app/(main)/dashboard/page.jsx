import { getUserAccounts } from "@/actions/dashboard";
import { getDashboardData } from "@/actions/dashboard";
import { getCurrentBudget, getCategoryBudgets } from "@/actions/budget";
import { AccountCard } from "./_components/account-card";
import { CreateAccountDrawer } from "@/components/create-account-drawer";
import { BudgetProgress } from "./_components/budget-progress";
import { CategoryBudgetManager } from "./_components/category-budget-manager";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Wallet } from "lucide-react";
import { DashboardOverview } from "./_components/transaction-overview";
import { formatCurrency, safeAdd } from "@/lib/currency";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  let accounts = [];
  let transactions = [];
  let categoryBudgetsData = [];

  try {
    const [userAccounts, userTransactions, categoryBudgetsRes] =
      await Promise.all([
        getUserAccounts(),
        getDashboardData(),
        getCategoryBudgets(),
      ]);

    accounts = userAccounts || [];
    transactions = userTransactions || [];
    categoryBudgetsData = categoryBudgetsRes?.data || [];
  } catch (error) {
    console.error("Failed to load dashboard data:", error.message);
  }

  const defaultAccount = accounts?.find((account) => account.isDefault);

  // Get budget for default account
  let budgetData = null;
  if (defaultAccount) {
    try {
      budgetData = await getCurrentBudget(defaultAccount.id);
    } catch (e) {
      console.warn("Failed to load budget for default account:", e.message);
    }
  }

  // Calculate balances strictly grouped by currency (Financial safety rule: never mix currencies without conversion)
  const balancesByCurrency = accounts.reduce((acc, account) => {
    const curr = account.currency || "USD";
    acc[curr] = safeAdd(acc[curr] || 0, account.balance);
    return acc;
  }, {});

  const currencyKeys = Object.keys(balancesByCurrency);

  return (
    <div className="space-y-8">
      {/* Portfolio Balance Header */}
      {currencyKeys.length > 0 && (
        <div className="rounded-xl border bg-card/60 p-5 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
                <Wallet className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {currencyKeys.length > 1
                    ? "Multi-Currency Portfolio Balance"
                    : "Total Balance"}
                </p>
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-0.5">
                  {currencyKeys.map((curr) => (
                    <div key={curr} className="flex items-baseline gap-1.5">
                      <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                        {formatCurrency(balancesByCurrency[curr], curr)}
                      </span>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground uppercase">
                        {curr}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground self-start sm:self-auto">
              {accounts.length} {accounts.length === 1 ? "Account" : "Accounts"}{" "}
              connected
            </p>
          </div>
        </div>
      )}

      {/* Budget Progress (Overall Monthly) */}
      <BudgetProgress
        initialBudget={budgetData?.budget}
        currentExpenses={budgetData?.currentExpenses || 0}
        currency={defaultAccount?.currency || "USD"}
      />

      {/* Category Budgets Manager */}
      <CategoryBudgetManager
        categoryBudgets={categoryBudgetsData}
        accounts={accounts}
      />

      {/* Dashboard Overview */}
      <DashboardOverview
        accounts={accounts}
        transactions={transactions || []}
      />

      {/* Accounts Grid */}
      <div className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">
          Your Accounts
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <CreateAccountDrawer>
            <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed">
              <CardContent className="flex flex-col items-center justify-center text-muted-foreground h-full pt-5 min-h-[140px]">
                <Plus className="h-10 w-10 mb-2" />
                <p className="text-sm font-medium">Add New Account</p>
              </CardContent>
            </Card>
          </CreateAccountDrawer>
          {accounts.length > 0 &&
            accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
        </div>
      </div>
    </div>
  );
}
