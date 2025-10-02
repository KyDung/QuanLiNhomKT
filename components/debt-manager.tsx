"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { db } from "@/lib/firebase"
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  increment,
  getDocs,
  getDoc,
  where,
} from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useToast } from "@/hooks/use-toast"
import { DollarSign, History, TrendingUp, TrendingDown, CheckCircle } from "lucide-react"
import type { DebtPayment, DebtRecord } from "@/lib/types"
import type { User } from "@/lib/init-users"

export default function DebtManager() {
  const { currentUser, refreshUser } = useAuth()
  const [selectedUser, setSelectedUser] = useState("")
  const [paymentType, setPaymentType] = useState<"partial" | "full">("partial")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")
  const [users, setUsers] = useState<User[]>([])
  const [payments, setPayments] = useState<DebtPayment[]>([])
  const [debtRecords, setDebtRecords] = useState<DebtRecord[]>([])
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    // Load all users
    const loadUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"))
      const usersData = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as User)
      setUsers(usersData)
    }
    loadUsers()

    // Listen to debt payments
    const q = query(collection(db, "debtPayments"), orderBy("createdAt", "desc"))
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const paymentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as DebtPayment[]
      setPayments(paymentsData)
    })

    // Listen to debt records để tính nợ thực tế
    const debtQuery = query(collection(db, "debtRecords"), orderBy("createdAt", "desc"))
    const unsubscribeDebt = onSnapshot(debtQuery, (snapshot) => {
      const debtsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as DebtRecord[]
      setDebtRecords(debtsData)
    })

    return () => {
      unsubscribe()
      unsubscribeDebt()
    }
  }, [])

  const getDebtorUsers = () => {
    // Tính nợ thực tế từ debtRecords (status = "active")
    const activeDebts = debtRecords.filter(debt => 
      debt.creditor === currentUser?.id && debt.status === "active"
    )
    
    // Nhóm theo debtor để tính tổng nợ
    const debtsByUser = activeDebts.reduce((acc, debt) => {
      if (!acc[debt.debtor]) {
        acc[debt.debtor] = {
          userId: debt.debtor,
          userName: debt.debtorName,
          totalDebt: 0
        }
      }
      acc[debt.debtor].totalDebt += debt.amount
      return acc
    }, {} as Record<string, { userId: string; userName: string; totalDebt: number }>)
    
    return Object.values(debtsByUser).filter(debt => debt.totalDebt > 0)
  }

  const handleDebtPayment = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!currentUser || !selectedUser) return

    // Tìm thông tin người nợ từ debtRecords
    const selectedDebtorInfo = getDebtorUsers().find(debt => debt.userId === selectedUser)
    if (!selectedDebtorInfo) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy thông tin nợ",
        variant: "destructive",
      })
      return
    }

    const debtAmount = selectedDebtorInfo.totalDebt
    let paymentAmount = 0

    if (paymentType === "full") {
      paymentAmount = debtAmount
    } else {
      paymentAmount = Number.parseFloat(amount)
      if (isNaN(paymentAmount) || paymentAmount <= 0) {
        toast({
          title: "Lỗi",
          description: "Vui lòng nhập số tiền hợp lệ",
          variant: "destructive",
        })
        return
      }

      if (paymentAmount > debtAmount) {
        toast({
          title: "Lỗi",
          description: `Số tiền trừ không được vượt quá số nợ (${debtAmount.toLocaleString("vi-VN")} đ)`,
          variant: "destructive",
        })
        return
      }
    }

    setLoading(true)

    try {
      // Add payment record
      await addDoc(collection(db, "debtPayments"), {
        paidBy: selectedUser,
        paidByName: selectedDebtorInfo.userName,
        paidTo: currentUser.id,
        paidToName: currentUser.displayName,
        amount: paymentAmount,
        description: description || "Trả nợ",
        createdAt: new Date(),
      })

      // Cập nhật status của debt records thành "paid" (từ số tiền lớn nhất trước)
      const activeDebts = debtRecords
        .filter(debt => debt.creditor === currentUser.id && debt.debtor === selectedUser && debt.status === "active")
        .sort((a, b) => b.amount - a.amount) // Sort từ lớn đến nhỏ

      let remainingPayment = paymentAmount
      for (const debt of activeDebts) {
        if (remainingPayment <= 0) break
        
        const debtRef = doc(db, "debtRecords", debt.id!)
        if (remainingPayment >= debt.amount) {
          // Trả hết khoản nợ này
          await updateDoc(debtRef, { status: "paid" })
          remainingPayment -= debt.amount
        } else {
          // Trả một phần, cần tạo debt record mới cho số còn lại
          await updateDoc(debtRef, { status: "paid" })
          
          // Tạo debt record mới cho số tiền còn lại
          await addDoc(collection(db, "debtRecords"), {
            creditor: debt.creditor,
            creditorName: debt.creditorName,
            debtor: debt.debtor,
            debtorName: debt.debtorName,
            amount: debt.amount - remainingPayment,
            description: debt.description,
            expenseId: debt.expenseId,
            expenseType: debt.expenseType,
            status: "active",
            createdAt: new Date(),
          })
          
          remainingPayment = 0
        }
      }

      await refreshUser()

      toast({
        title: "Thành công",
        description: `Đã trừ ${paymentAmount.toLocaleString("vi-VN")} đ nợ của ${selectedDebtorInfo.userName}`,
      })

      // Reset form
      setSelectedUser("")
      setAmount("")
      setDescription("")
      setPaymentType("partial")
    } catch (error) {
      console.error("Error processing payment:", error)
      toast({
        title: "Lỗi",
        description: "Không thể xử lý thanh toán, vui lòng thử lại",
        variant: "destructive",
      })
    }

    setLoading(false)
  }

  const debtorUsers = getDebtorUsers()

  // Tính tổng overview
  const totalOwedToMe = debtRecords
    .filter(debt => debt.creditor === currentUser?.id && debt.status === "active")
    .reduce((sum, debt) => sum + debt.amount, 0)
  
  const totalIOwe = debtRecords
    .filter(debt => debt.debtor === currentUser?.id && debt.status === "active")
    .reduce((sum, debt) => sum + debt.amount, 0)

  return (
    <div className="space-y-6">
      {/* Tổng quan nợ */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Người khác nợ tôi</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {totalOwedToMe.toLocaleString("vi-VN")} đ
            </div>
            <p className="text-xs text-muted-foreground">
              {debtorUsers.length} người nợ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tôi nợ người khác</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalIOwe.toLocaleString("vi-VN")} đ
            </div>
            <p className="text-xs text-muted-foreground">
              {debtRecords.filter(debt => debt.debtor === currentUser?.id && debt.status === "active").length} khoản nợ
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Debt Payment Form */}
      <Card>
        <CardHeader>
          <CardTitle>Trừ nợ</CardTitle>
          <CardDescription>Trừ tiền nợ của những người đã trả tiền cho bạn</CardDescription>
        </CardHeader>
        <CardContent>
          {totalOwedToMe <= 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
              <p>Tuyệt vời! Không ai nợ bạn tiền</p>
            </div>
          ) : debtorUsers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <DollarSign className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Không có ai nợ bạn tiền</p>
            </div>
          ) : (
            <form onSubmit={handleDebtPayment} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="debtor">Chọn người nợ</Label>
                <Select value={selectedUser} onValueChange={setSelectedUser}>
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn người nợ" />
                  </SelectTrigger>
                  <SelectContent>
                    {debtorUsers.map((debt) => (
                      <SelectItem key={debt.userId} value={debt.userId}>
                        {debt.userName} - Nợ: {debt.totalDebt.toLocaleString("vi-VN")} đ
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Loại thanh toán</Label>
                <RadioGroup value={paymentType} onValueChange={(value) => setPaymentType(value as "partial" | "full")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="partial" id="partial" />
                    <Label htmlFor="partial" className="cursor-pointer">
                      Trừ một phần
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="full" id="full" />
                    <Label htmlFor="full" className="cursor-pointer">
                      Trừ toàn bộ nợ
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {paymentType === "partial" && (
                <div className="space-y-2">
                  <Label htmlFor="amount">Số tiền trừ (VNĐ)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="50000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Ghi chú (tùy chọn)</Label>
                <Input
                  id="description"
                  placeholder="Ví dụ: Trả tiền ăn, trả tiền điện, ..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <Button type="submit" disabled={loading || !selectedUser} className="w-full">
                <DollarSign className="h-4 w-4 mr-2" />
                {loading ? "Đang xử lý..." : "Trừ nợ"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>Lịch sử thanh toán</CardTitle>
          <CardDescription>Tất cả các giao dịch thanh toán của mọi người</CardDescription>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Chưa có lịch sử thanh toán</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div key={payment.id} className="border rounded-lg p-4 space-y-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold">{payment.description}</p>
                      <p className="text-sm text-muted-foreground">
                        {payment.paidByName} trả cho {payment.paidToName} •{" "}
                        {payment.createdAt?.toLocaleDateString("vi-VN")}
                      </p>
                    </div>
                    <p className="font-bold text-lg text-green-600">-{payment.amount.toLocaleString("vi-VN")} đ</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
