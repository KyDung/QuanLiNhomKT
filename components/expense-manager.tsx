"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { db } from "@/lib/firebase";
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
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Plus, Receipt, Users, ShoppingCart, DollarSign, History, TrendingUp, TrendingDown, Clock } from "lucide-react";
import type { Expense, DebtRecord, DebtPayment } from "@/lib/types";
import type { User } from "@/lib/init-users";

export default function ExpenseManager() {
  const { currentUser, refreshUser } = useAuth();
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [splitAll, setSplitAll] = useState(true);
  const [expenseType, setExpenseType] = useState<"split" | "buyfor">("split");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [debtRecords, setDebtRecords] = useState<DebtRecord[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Debt payment states
  const [selectedDebtor, setSelectedDebtor] = useState("");
  const [paymentType, setPaymentType] = useState<"partial" | "full">("partial");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDescription, setPaymentDescription] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    // Load all users
    const loadUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const usersData = usersSnapshot.docs.map(
        (doc) => ({ id: doc.id, ...doc.data() } as User)
      );
      setUsers(usersData);
    };
    loadUsers();

    // Listen to expenses
    const expensesQuery = query(collection(db, "expenses"), orderBy("createdAt", "desc"));
    const unsubscribeExpenses = onSnapshot(expensesQuery, (snapshot) => {
      const expensesData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as Expense[];
      setExpenses(expensesData);
    });

    // Listen to debt records
    const debtQuery = query(collection(db, "debtRecords"), orderBy("createdAt", "desc"));
    const unsubscribeDebt = onSnapshot(debtQuery, (snapshot) => {
      const debtsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as DebtRecord[];
      setDebtRecords(debtsData);
    });

    // Listen to debt payments
    const paymentsQuery = query(collection(db, "debtPayments"), orderBy("createdAt", "desc"));
    const unsubscribePayments = onSnapshot(paymentsQuery, (snapshot) => {
      const paymentsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
      })) as DebtPayment[];
      setPayments(paymentsData);
    });

    return () => {
      unsubscribeExpenses();
      unsubscribeDebt();
      unsubscribePayments();
    };
  }, []);

  // Helper functions for debt management
  const getDebtorUsers = () => {
    const activeDebts = debtRecords.filter(debt => 
      debt.creditor === currentUser?.id && debt.status === "active"
    );
    
    const debtsByUser = activeDebts.reduce((acc, debt) => {
      if (!acc[debt.debtor]) {
        acc[debt.debtor] = {
          userId: debt.debtor,
          userName: debt.debtorName,
          totalDebt: 0
        };
      }
      acc[debt.debtor].totalDebt += debt.amount;
      return acc;
    }, {} as Record<string, { userId: string; userName: string; totalDebt: number }>);
    
    return Object.values(debtsByUser).filter(debt => debt.totalDebt > 0);
  };

  // Tính ai đang nợ tôi (groupby người)
  const getMyCredits = () => {
    const creditsToMe = debtRecords.filter(debt => 
      debt.creditor === currentUser?.id && debt.status === "active"
    );
    
    const creditsByUser = creditsToMe.reduce((acc, debt) => {
      if (!acc[debt.debtor]) {
        acc[debt.debtor] = {
          userId: debt.debtor,
          userName: debt.debtorName,
          totalDebt: 0
        };
      }
      acc[debt.debtor].totalDebt += debt.amount;
      return acc;
    }, {} as Record<string, { userId: string; userName: string; totalDebt: number }>);

    return Object.values(creditsByUser);
  };

  // Tính tôi đang nợ ai (groupby người)
  const getMyDebts = () => {
    const myDebts = debtRecords.filter(debt => 
      debt.debtor === currentUser?.id && debt.status === "active"
    );
    
    const debtsByUser = myDebts.reduce((acc, debt) => {
      if (!acc[debt.creditor]) {
        acc[debt.creditor] = {
          userId: debt.creditor,
          userName: debt.creditorName,
          totalDebt: 0
        };
      }
      acc[debt.creditor].totalDebt += debt.amount;
      return acc;
    }, {} as Record<string, { userId: string; userName: string; totalDebt: number }>);

    return Object.values(debtsByUser);
  };

  // Tạo timeline tổng hợp
  const getTimeline = () => {
    const timeline: Array<{
      id: string;
      type: 'expense' | 'payment';
      createdAt: Date;
      amount: number;
      description: string;
      createdByName: string;
      createdBy?: string;
      expenseType?: "split" | "buyfor";
      participants?: string[];
      splitAmount?: number;
      paidByName?: string;
      paidToName?: string;
    }> = [];

    // Thêm expenses
    expenses.forEach(expense => {
      timeline.push({
        id: expense.id,
        type: 'expense',
        createdAt: expense.createdAt,
        amount: expense.amount,
        description: expense.description,
        createdByName: expense.createdByName,
        createdBy: expense.createdBy,
        expenseType: expense.expenseType,
        participants: expense.participants,
        splitAmount: expense.splitAmount,
      });
    });

    // Thêm payments
    payments.forEach(payment => {
      timeline.push({
        id: payment.id,
        type: 'payment',
        createdAt: payment.createdAt,
        amount: payment.amount,
        description: payment.description,
        createdByName: payment.paidByName, // Người trả nợ
        paidByName: payment.paidByName,
        paidToName: payment.paidToName,
      });
    });

    // Sort theo thời gian mới nhất
    return timeline.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  };

  const handleUserToggle = (userId: string) => {
    if (expenseType === "buyfor") {
      // Với mua giúp: chỉ cho phép chọn một người
      setSelectedUsers([userId]);
    } else {
      // Với chia tiền: cho phép chọn nhiều người
      setSelectedUsers((prev) =>
        prev.includes(userId)
          ? prev.filter((id) => id !== userId)
          : [...prev, userId]
      );
    }
  };

  const handleExpenseTypeChange = (type: "split" | "buyfor") => {
    setExpenseType(type);
    if (type === "buyfor") {
      setSplitAll(false); // Reset splitAll khi chuyển sang buyfor
    }
    setSelectedUsers([]); // Reset selected users
  };

  const handleDebtPayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser || !selectedDebtor) return;

    const selectedDebtorInfo = getDebtorUsers().find(debt => debt.userId === selectedDebtor);
    if (!selectedDebtorInfo) {
      toast({
        title: "Lỗi",
        description: "Không tìm thấy thông tin nợ",
        variant: "destructive",
      });
      return;
    }

    const debtAmount = selectedDebtorInfo.totalDebt;
    let paymentAmountNumber = 0;

    if (paymentType === "full") {
      paymentAmountNumber = debtAmount;
    } else {
      paymentAmountNumber = Number.parseFloat(paymentAmount);
      if (isNaN(paymentAmountNumber) || paymentAmountNumber <= 0) {
        toast({
          title: "Lỗi",
          description: "Vui lòng nhập số tiền hợp lệ",
          variant: "destructive",
        });
        return;
      }

      if (paymentAmountNumber > debtAmount) {
        toast({
          title: "Lỗi",
          description: `Số tiền trừ không được vượt quá số nợ (${debtAmount.toLocaleString("vi-VN")} đ)`,
          variant: "destructive",
        });
        return;
      }
    }

    setPaymentLoading(true);

    try {
      // Add payment record
      await addDoc(collection(db, "debtPayments"), {
        paidBy: selectedDebtor,
        paidByName: selectedDebtorInfo.userName,
        paidTo: currentUser.id,
        paidToName: currentUser.displayName,
        amount: paymentAmountNumber,
        description: paymentDescription || "Trả nợ",
        createdAt: new Date(),
      });

      // Cập nhật status của debt records thành "paid"
      const activeDebts = debtRecords
        .filter(debt => debt.creditor === currentUser.id && debt.debtor === selectedDebtor && debt.status === "active")
        .sort((a, b) => b.amount - a.amount);

      let remainingPayment = paymentAmountNumber;
      for (const debt of activeDebts) {
        if (remainingPayment <= 0) break;
        
        const debtRef = doc(db, "debtRecords", debt.id!);
        if (remainingPayment >= debt.amount) {
          await updateDoc(debtRef, { status: "paid" });
          remainingPayment -= debt.amount;
        } else {
          await updateDoc(debtRef, { status: "paid" });
          
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
          });
          
          remainingPayment = 0;
        }
      }

      await refreshUser();

      toast({
        title: "Thành công",
        description: `Đã trừ ${paymentAmountNumber.toLocaleString("vi-VN")} đ nợ của ${selectedDebtorInfo.userName}`,
      });

      // Reset form
      setSelectedDebtor("");
      setPaymentAmount("");
      setPaymentDescription("");
      setPaymentType("partial");
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        title: "Lỗi",
        description: "Không thể xử lý thanh toán, vui lòng thử lại",
        variant: "destructive",
      });
    }

    setPaymentLoading(false);
  };

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) return;

    const expenseAmount = Number.parseFloat(amount);
    if (isNaN(expenseAmount) || expenseAmount <= 0) {
      toast({
        title: "Lỗi",
        description: "Vui lòng nhập số tiền hợp lệ",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // LOGIC MỚI: Xử lý 2 trường hợp
      if (expenseType === "split") {
        // CHIA TIỀN: Bao gồm cả người trả tiền
        const allParticipants = splitAll
          ? users.map((u) => u.id)
          : [...new Set([currentUser.id, ...selectedUsers])]; // Luôn bao gồm người trả

        const splitAmount = expenseAmount / allParticipants.length;

        // Add expense record
        const expenseRef = await addDoc(collection(db, "expenses"), {
          createdBy: currentUser.id,
          createdByName: currentUser.displayName,
          amount: expenseAmount,
          description: `[CHIA TIỀN] ${description}`,
          participants: allParticipants,
          splitAmount,
          expenseType: "split",
          createdAt: new Date(),
        });

        // Tạo debt records cho expense chia tiền
        for (const userId of allParticipants) {
          if (userId !== currentUser.id) {
            const user = users.find((u) => u.id === userId);
            if (user) {
              await addDoc(collection(db, "debtRecords"), {
                creditor: currentUser.id,
                creditorName: currentUser.displayName,
                debtor: userId,
                debtorName: user.displayName,
                amount: splitAmount,
                description: `Chia tiền: ${description}`,
                expenseId: expenseRef.id,
                expenseType: "split",
                status: "active",
                createdAt: new Date(),
              });
            }
          }
        }

        // KHÔNG cập nhật user.balance cho chia tiền - chỉ dùng debtRecords
      } else {
        // MUA GIÚP: Chỉ những người được chọn (không bao gồm người trả)
        const recipients = selectedUsers.filter((id) => id !== currentUser.id);

        if (recipients.length === 0) {
          toast({
            title: "Lỗi",
            description: "Vui lòng chọn ít nhất một người để mua giúp",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        const amountPerPerson = expenseAmount / recipients.length;

        // Add expense record
        const expenseRef = await addDoc(collection(db, "expenses"), {
          createdBy: currentUser.id,
          createdByName: currentUser.displayName,
          amount: expenseAmount,
          description: `[MUA GIÚP] ${description}`,
          participants: recipients,
          splitAmount: amountPerPerson,
          expenseType: "buyfor",
          createdAt: new Date(),
        });

        // Tạo debt records cho expense mua giúp
        for (const userId of recipients) {
          const user = users.find((u) => u.id === userId);
          if (user) {
            await addDoc(collection(db, "debtRecords"), {
              creditor: currentUser.id,
              creditorName: currentUser.displayName,
              debtor: userId,
              debtorName: user.displayName,
              amount: amountPerPerson,
              description: `Mua giúp: ${description}`,
              expenseId: expenseRef.id,
              expenseType: "buyfor",
              status: "active",
              createdAt: new Date(),
            });
          }
        }

        // KHÔNG cập nhật user.balance cho mua giúp - chỉ dùng debtRecords
      }

      await refreshUser();

      toast({
        title: "Thành công",
        description:
          expenseType === "split"
            ? "Đã thêm chi tiêu chia tiền"
            : "Đã thêm giao dịch mua giúp",
      });

      // Reset form
      setAmount("");
      setDescription("");
      setSelectedUsers([]);
      setSplitAll(true);
    } catch (error) {
      console.error("Error adding expense:", error);
      toast({
        title: "Lỗi",
        description: "Không thể thêm chi tiêu, vui lòng thử lại",
        variant: "destructive",
      });
    }

    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="expenses" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="expenses">Chi tiêu</TabsTrigger>
          <TabsTrigger value="debt-management">Quản lý nợ</TabsTrigger>
          <TabsTrigger value="timeline">Lịch sử chung</TabsTrigger>
        </TabsList>

        {/* Tab Chi tiêu */}
        <TabsContent value="expenses" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thêm chi tiêu mới</CardTitle>
              <CardDescription>
                Ghi lại chi tiêu và chia đều cho các thành viên
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Expense Type Selection */}
              <div className="mb-6">
                <Label className="text-base font-medium mb-3 block">
                  Loại giao dịch
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleExpenseTypeChange("split")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      expenseType === "split"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <Users className="h-6 w-6 mx-auto mb-2" />
                    <div className="font-medium">Chia tiền</div>
                    <div className="text-sm text-gray-500">
                      Chia đều chi phí chung
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExpenseTypeChange("buyfor")}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      expenseType === "buyfor"
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <ShoppingCart className="h-6 w-6 mx-auto mb-2" />
                    <div className="font-medium">Mua giúp</div>
                    <div className="text-sm text-gray-500">
                      Mua hộ cho người khác
                    </div>
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddExpense} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="amount">Số tiền (VNĐ)</Label>
                  <Input
                    id="amount"
                    type="number"
                    placeholder="100000"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Ghi chú</Label>
                  <Textarea
                    id="description"
                    placeholder={
                      expenseType === "split"
                        ? "Ví dụ: Tiền ăn trưa, tiền điện, ..."
                        : "Ví dụ: Mua nước uống, mua đồ ăn vặt, ..."
                    }
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                {expenseType === "split" && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="splitAll"
                        checked={splitAll}
                        onCheckedChange={(checked) =>
                          setSplitAll(checked as boolean)
                        }
                      />
                      <Label htmlFor="splitAll" className="cursor-pointer">
                        Chia cho tất cả mọi người
                      </Label>
                    </div>
                  </div>
                )}

                {(expenseType === "buyfor" || !splitAll) && (
                  <div className="space-y-2">
                    <Label>
                      {expenseType === "split"
                        ? "Chọn người chia tiền"
                        : "Chọn người được mua giúp (chỉ một người)"}
                    </Label>
                    <div className="space-y-2">
                      {expenseType === "buyfor" ? (
                        // Radio buttons cho mua giúp (chỉ chọn 1)
                        <RadioGroup
                          value={selectedUsers[0] || ""}
                          onValueChange={(value) => setSelectedUsers([value])}
                        >
                          {users
                            .filter((user) => user.id !== currentUser?.id)
                            .map((user) => (
                              <div key={user.id} className="flex items-center space-x-2">
                                <RadioGroupItem value={user.id} id={user.id} />
                                <Label htmlFor={user.id} className="cursor-pointer">
                                  {user.displayName} ({user.username})
                                </Label>
                              </div>
                            ))}
                        </RadioGroup>
                      ) : (
                        // Checkboxes cho chia tiền (chọn nhiều)
                        <>
                          {users
                            .filter((user) => user.id !== currentUser?.id)
                            .map((user) => (
                              <div
                                key={user.id}
                                className="flex items-center space-x-2"
                              >
                                <Checkbox
                                  id={user.id}
                                  checked={selectedUsers.includes(user.id)}
                                  onCheckedChange={() => handleUserToggle(user.id)}
                                />
                                <Label htmlFor={user.id} className="cursor-pointer">
                                  {user.displayName} ({user.username})
                                  {user.id === currentUser?.id && " (Tôi)"}
                                </Label>
                              </div>
                            ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {expenseType === "split" ? (
                    <>
                      <Users className="h-4 w-4 mr-2" />
                      {loading ? "Đang chia tiền..." : "Thêm chia tiền"}
                    </>
                  ) : (
                    <>
                      <ShoppingCart className="h-4 w-4 mr-2" />
                      {loading ? "Đang thêm..." : "Thêm mua giúp"}
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Quản lý nợ */}
        <TabsContent value="debt-management" className="space-y-6">
          {/* Ai đang nợ tôi */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                Ai đang nợ tôi
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getMyCredits().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Không có ai nợ bạn</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getMyCredits().map((credit) => (
                    <div
                      key={credit.userId}
                      className="flex items-center justify-between p-3 border rounded-lg bg-emerald-50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-emerald-100 text-emerald-700">
                            {credit.userName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{credit.userName}</span>
                      </div>
                      <Badge variant="default" className="bg-emerald-600">
                        +{credit.totalDebt.toLocaleString("vi-VN")} đ
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tôi đang nợ ai */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingDown className="h-5 w-5 text-red-600" />
                Tôi đang nợ ai
              </CardTitle>
            </CardHeader>
            <CardContent>
              {getMyDebts().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Bạn không nợ ai</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {getMyDebts().map((debt) => (
                    <div
                      key={debt.userId}
                      className="flex items-center justify-between p-3 border rounded-lg bg-red-50"
                    >
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-red-100 text-red-700">
                            {debt.userName.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{debt.userName}</span>
                      </div>
                      <Badge variant="destructive">
                        -{debt.totalDebt.toLocaleString("vi-VN")} đ
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Trừ nợ */}
          {getDebtorUsers().length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Trừ nợ</CardTitle>
                <CardDescription>
                  Ghi nhận khi có người trả nợ cho bạn
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleDebtPayment} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Người trả nợ</Label>
                    <Select
                      value={selectedDebtor}
                      onValueChange={setSelectedDebtor}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Chọn người trả nợ" />
                      </SelectTrigger>
                      <SelectContent>
                        {getDebtorUsers().map((debt) => (
                          <SelectItem key={debt.userId} value={debt.userId}>
                            {debt.userName} - Nợ:{" "}
                            {debt.totalDebt.toLocaleString("vi-VN")} đ
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <Label>Loại thanh toán</Label>
                    <RadioGroup
                      value={paymentType}
                      onValueChange={(value: "full" | "partial") =>
                        setPaymentType(value)
                      }
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="full" id="full" />
                        <Label htmlFor="full" className="cursor-pointer">
                          Trả hết nợ
                          {selectedDebtor && (
                            <span className="ml-2 text-sm text-muted-foreground">
                              (
                              {getDebtorUsers()
                                .find((d) => d.userId === selectedDebtor)
                                ?.totalDebt.toLocaleString("vi-VN")}{" "}
                              đ)
                            </span>
                          )}
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="partial" id="partial" />
                        <Label htmlFor="partial" className="cursor-pointer">
                          Trả một phần
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {paymentType === "partial" && (
                    <div className="space-y-2">
                      <Label htmlFor="paymentAmount">Số tiền trả (VNĐ)</Label>
                      <Input
                        id="paymentAmount"
                        type="number"
                        value={paymentAmount}
                        onChange={(e) => setPaymentAmount(e.target.value)}
                        placeholder="0"
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="paymentDescription">Ghi chú (tùy chọn)</Label>
                    <Input
                      id="paymentDescription"
                      value={paymentDescription}
                      onChange={(e) => setPaymentDescription(e.target.value)}
                      placeholder="Ghi chú cho việc trả nợ..."
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={paymentLoading || !selectedDebtor}
                    className="w-full"
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    {paymentLoading ? "Đang xử lý..." : "Trừ nợ"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab Timeline - Lịch sử chung */}
        <TabsContent value="timeline" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lịch sử chung</CardTitle>
              <CardDescription>
                Tất cả các giao dịch theo thời gian: chi tiêu, mua giúp và trả nợ
              </CardDescription>
            </CardHeader>
            <CardContent>
              {getTimeline().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Receipt className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Chưa có giao dịch nào</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {getTimeline().map((item, index) => (
                    <div
                      key={`${item.type}-${item.id}-${index}`}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex items-start gap-3">
                          <div
                            className={`p-2 rounded-full ${
                              item.type === "expense"
                                ? item.expenseType === "buyfor"
                                  ? "bg-blue-100 text-blue-600"
                                  : "bg-emerald-100 text-emerald-600"
                                : "bg-yellow-100 text-yellow-600"
                            }`}
                          >
                            {item.type === "expense" ? (
                              item.expenseType === "buyfor" ? (
                                <ShoppingCart className="h-4 w-4" />
                              ) : (
                                <Users className="h-4 w-4" />
                              )
                            ) : (
                              <DollarSign className="h-4 w-4" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold">
                              {item.type === "expense"
                                ? item.description.replace(
                                    /^\[(CHIA TIỀN|MUA GIÚP)\]\s*/,
                                    ""
                                  )
                                : item.description}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              Bởi {item.createdByName} •{" "}
                              {item.createdAt?.toLocaleDateString("vi-VN")}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.type === "expense"
                                ? item.expenseType === "buyfor"
                                  ? "🛒 Mua giúp"
                                  : "💰 Chia tiền"
                                : "💳 Trả nợ"}
                            </p>

                            {/* Chi tiết giao dịch */}
                            <div className="mt-2 text-xs">
                              {item.type === "expense" ? (
                                item.expenseType === "split" ? (
                                  <div className="bg-emerald-50 p-2 rounded border">
                                    <p className="font-medium text-emerald-700">
                                      Chia tiền với:
                                    </p>
                                    <p className="text-emerald-600">
                                      {item.createdByName} (người trả) +{" "}
                                      {item.participants && item.participants
                                        .filter((id: string) => id !== item.createdBy)
                                        .map(
                                          (id: string) =>
                                            users.find((u) => u.id === id)
                                              ?.displayName
                                        )
                                        .filter(Boolean)
                                        .join(", ")}
                                    </p>
                                    <p className="text-emerald-600">
                                      Tổng {item.participants?.length || 0} người • Mỗi
                                      người:{" "}
                                      {item.splitAmount?.toLocaleString("vi-VN") || "0"} đ
                                    </p>
                                  </div>
                                ) : (
                                  <div className="bg-blue-50 p-2 rounded border">
                                    <p className="font-medium text-blue-700">
                                      {item.createdByName} mua giúp cho:
                                    </p>
                                    <p className="text-blue-600">
                                      {item.participants && item.participants
                                        .map(
                                          (id: string) =>
                                            users.find((u) => u.id === id)
                                              ?.displayName
                                        )
                                        .filter(Boolean)
                                        .join(", ")}
                                    </p>
                                    <p className="text-blue-600">
                                      {item.participants?.length || 0} người • Mỗi người:{" "}
                                      {item.splitAmount?.toLocaleString("vi-VN") || "0"} đ
                                    </p>
                                  </div>
                                )
                              ) : (
                                <div className="bg-yellow-50 p-2 rounded border">
                                  <p className="font-medium text-yellow-700">
                                    {item.paidByName} trả nợ cho {item.paidToName}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        <p className="font-bold text-lg">
                          {item.amount.toLocaleString("vi-VN")} đ
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
