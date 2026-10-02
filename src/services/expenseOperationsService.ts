/**
 * Expense writes for the Budget tab. Linking an expense to a task writes an "Expense Linked"
 * history row on that task; if the history write fails, the expense change is undone.
 */
import { runSequence, type SequenceStep } from '@/api/dataverseClient';
import { expensesService, type ExpenseInput } from '@/services/expensesService';
import { taskHistoryService } from '@/services/taskActivityService';
import { HistoryAction } from '@/types/schema';
import type { Expense } from '@/types/entities';
import { formatCurrency } from '@/utils/format';

function linkedEntry(taskId: string, name: string, amount: number | null | undefined) {
  return {
    eventTaskId: taskId,
    action: HistoryAction.ExpenseLinked,
    summary: `Expense "${name}" linked${amount != null ? ` (${formatCurrency(amount)})` : ''}`,
    fieldName: 'Expense',
    newValue: name.slice(0, 100),
  };
}

export const expenseOperations = {
  async create(input: ExpenseInput): Promise<string> {
    const steps: SequenceStep[] = [
      { label: 'Create expense', run: () => expensesService.create(input), undo: (id) => expensesService.remove(String(id)) },
    ];
    if (input.eventTaskId) {
      const taskId = input.eventTaskId;
      steps.push({ label: 'Write history', run: () => taskHistoryService.add(linkedEntry(taskId, input.name, input.actualAmount ?? input.estimatedAmount)) });
    }
    const [id] = (await runSequence(steps)) as [string];
    return id;
  },

  /** Update an expense; writes "Expense Linked" when it gets linked to a different task. */
  async update(expense: Expense, patch: Partial<ExpenseInput>): Promise<void> {
    const newTaskId = patch.eventTaskId;
    const steps: SequenceStep[] = [
      {
        label: 'Update expense',
        run: () => expensesService.update(expense.id, patch),
        undo: () => expensesService.update(expense.id, {
          name: expense.name, category: expense.category, status: expense.status, vendor: expense.vendor,
          estimatedAmount: expense.estimatedAmount, actualAmount: expense.actualAmount, paymentDate: expense.paymentDate,
          eventTaskId: expense.eventTaskId,
        }),
      },
    ];
    if (newTaskId && newTaskId !== expense.eventTaskId) {
      const name = patch.name ?? expense.name;
      const amount = patch.actualAmount !== undefined ? patch.actualAmount : expense.actualAmount ?? expense.estimatedAmount;
      steps.push({ label: 'Write history', run: () => taskHistoryService.add(linkedEntry(newTaskId, name, amount)) });
    }
    await runSequence(steps);
  },

  /** Deletes the expense; its receipts (Notes) are removed with it by Dataverse. */
  async remove(expense: Expense): Promise<void> {
    await expensesService.remove(expense.id);
  },
};
