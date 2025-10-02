"use client";

import { useState, useEffect } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/lib/auth-context";
import {
  ArrowRight,
  TrendingDown,
  TrendingUp,
  Clock,
  CheckCircle,
  User,
} from "lucide-react";
import type { DebtRecord } from "@/lib/types";

export default function DebtTracker() {
  const [debtRecords, setDebtRecords] = useState<DebtRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser) return;

    // Lắng nghe tất cả debt records
    const unsubscribe = onSnapshot(
      query(collection(db, "debtRecords"), orderBy("createdAt", "desc")),
      (snapshot) => {
        const debtsData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
        })) as DebtRecord[];
        setDebtRecords(debtsData);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  // Lọc các khoản nợ người khác nợ mình
  const debtsOwedToMe = debtRecords.filter(
    (debt) => debt.creditor === currentUser?.id && debt.status === "active"
  );

  // Lọc các khoản nợ mình nợ người khác
  const debtsIOwe = debtRecords.filter(
    (debt) => debt.debtor === currentUser?.id && debt.status === "active"
  );

  // Tính tổng số tiền
  const totalOwedToMe = debtsOwedToMe.reduce(
    (sum, debt) => sum + debt.amount,
    0
  );
  const totalIOwe = debtsIOwe.reduce((sum, debt) => sum + debt.amount, 0);

  // Nhóm theo người để hiển thị dễ dàng hơn
  const groupedDebtsOwedToMe = debtsOwedToMe.reduce((groups, debt) => {
    const debtorId = debt.debtor;
    if (!groups[debtorId]) {
      groups[debtorId] = {
        debtorName: debt.debtorName,
        debts: [],
        totalAmount: 0,
      };
    }
    groups[debtorId].debts.push(debt);
    groups[debtorId].totalAmount += debt.amount;
    return groups;
  }, {} as Record<string, { debtorName: string; debts: DebtRecord[]; totalAmount: number }>);

  const groupedDebtsIOwe = debtsIOwe.reduce((groups, debt) => {
    const creditorId = debt.creditor;
    if (!groups[creditorId]) {
      groups[creditorId] = {
        creditorName: debt.creditorName,
        debts: [],
        totalAmount: 0,
      };
    }
    groups[creditorId].debts.push(debt);
    groups[creditorId].totalAmount += debt.amount;
    return groups;
  }, {} as Record<string, { creditorName: string; debts: DebtRecord[]; totalAmount: number }>);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Clock className="h-8 w-8 mx-auto mb-2 animate-spin" />
          <p>Đang tải dữ liệu nợ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tổng quan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Người khác nợ tôi
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-600">
              {totalOwedToMe.toLocaleString("vi-VN")} đ
            </div>
            <p className="text-xs text-muted-foreground">
              {debtsOwedToMe.length} khoản nợ
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Tôi nợ người khác
            </CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {totalIOwe.toLocaleString("vi-VN")} đ
            </div>
            <p className="text-xs text-muted-foreground">
              {debtsIOwe.length} khoản nợ
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tổng nợ theo từng người */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
              Ai đang nợ tôi
            </CardTitle>
            <CardDescription>Tổng nợ từng người cụ thể</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(groupedDebtsOwedToMe).length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm">Không ai nợ bạn!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(groupedDebtsOwedToMe).map(([debtorId, group]) => (
                  <div key={debtorId} className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg">
                    <span className="font-medium text-emerald-800">{group.debtorName}</span>
                    <span className="font-bold text-emerald-600">
                      {group.totalAmount.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-red-600" />
              Tôi đang nợ ai
            </CardTitle>
            <CardDescription>Tổng nợ của tôi với từng người</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(groupedDebtsIOwe).length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                <p className="text-sm">Bạn không nợ ai cả!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {Object.entries(groupedDebtsIOwe).map(([creditorId, group]) => (
                  <div key={creditorId} className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                    <span className="font-medium text-red-800">{group.creditorName}</span>
                    <span className="font-bold text-red-600">
                      {group.totalAmount.toLocaleString("vi-VN")} đ
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chi tiết nợ */}
      <Tabs defaultValue="owed-to-me" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="owed-to-me">
            Người khác nợ tôi ({Object.keys(groupedDebtsOwedToMe).length})
          </TabsTrigger>
          <TabsTrigger value="i-owe">
            Tôi nợ người khác ({Object.keys(groupedDebtsIOwe).length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="owed-to-me" className="space-y-4">
          {Object.keys(groupedDebtsOwedToMe).length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
                <p className="text-muted-foreground">Không có ai nợ bạn!</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedDebtsOwedToMe).map(([debtorId, group]) => (
              <Card key={debtorId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      <CardTitle className="text-lg">
                        {group.debtorName}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-emerald-600 bg-emerald-50"
                    >
                      {group.totalAmount.toLocaleString("vi-VN")} đ
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.debts.map((debt) => (
                      <div
                        key={debt.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{debt.description}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>
                              {debt.createdAt.toLocaleDateString("vi-VN")}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {debt.expenseType === "split"
                                ? "💰 Chia tiền"
                                : "🛒 Mua giúp"}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-emerald-600">
                            {debt.amount.toLocaleString("vi-VN")} đ
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="i-owe" className="space-y-4">
          {Object.keys(groupedDebtsIOwe).length === 0 ? (
            <Card>
              <CardContent className="text-center py-8">
                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-emerald-500" />
                <p className="text-muted-foreground">Bạn không nợ ai cả!</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(groupedDebtsIOwe).map(([creditorId, group]) => (
              <Card key={creditorId}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      <CardTitle className="text-lg">
                        {group.creditorName}
                      </CardTitle>
                    </div>
                    <Badge
                      variant="secondary"
                      className="text-red-600 bg-red-50"
                    >
                      {group.totalAmount.toLocaleString("vi-VN")} đ
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {group.debts.map((debt) => (
                      <div
                        key={debt.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{debt.description}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>
                              {debt.createdAt.toLocaleDateString("vi-VN")}
                            </span>
                            <Badge variant="outline" className="text-xs">
                              {debt.expenseType === "split"
                                ? "💰 Chia tiền"
                                : "🛒 Mua giúp"}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-red-600">
                            {debt.amount.toLocaleString("vi-VN")} đ
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
