export interface Expense {
  id: string
  createdBy: string
  createdByName: string
  amount: number
  description: string
  participants: string[]
  splitAmount: number
  expenseType?: "split" | "buyfor"
  createdAt: Date
}

export interface DebtRecord {
  id: string
  creditor: string // người cho nợ
  creditorName: string
  debtor: string // người nợ
  debtorName: string
  amount: number
  description: string
  expenseId?: string // liên kết với expense gốc
  expenseType?: "split" | "buyfor"
  status: "active" | "paid" | "partially_paid"
  createdAt: Date
  paidAt?: Date
}

export interface DebtPayment {
  id: string
  paidBy: string
  paidByName: string
  paidTo: string
  paidToName: string
  amount: number
  description: string
  debtRecordId?: string // liên kết với debt record
  createdAt: Date
}
