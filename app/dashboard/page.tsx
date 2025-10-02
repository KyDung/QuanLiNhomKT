"use client";

import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, User, Wallet, Receipt, QrCode } from "lucide-react";
import ProfileSettings from "@/components/profile-settings";
import ExpenseManager from "@/components/expense-manager";
import QRCodeManager from "@/components/qrcode-manager";

export default function DashboardPage() {
  const { currentUser, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      router.push("/");
    }
  }, [currentUser, router]);

  if (!currentUser) {
    return null;
  }

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="container mx-auto p-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="bg-primary rounded-full p-2">
              <Wallet className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Quản lý chi tiêu
              </h1>
              <p className="text-sm text-muted-foreground">
                Xin chào, {currentUser.displayName}
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Đăng xuất
          </Button>
        </div>

        {/* Admin Info Card */}
        <Card className="mb-6 bg-primary text-primary-foreground">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Thông tin quản trị viên
            </CardTitle>
            <CardDescription className="text-primary-foreground/80">
              Tài khoản hiện tại
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <p className="text-2xl font-bold">{currentUser.displayName}</p>
              <p className="text-primary-foreground/90">
                Username: {currentUser.username}
              </p>
              <p className="text-sm text-primary-foreground/70">
                ID: {currentUser.id}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tabs */}
        <Tabs defaultValue="expenses" className="space-y-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="expenses">
              <Receipt className="h-4 w-4 mr-2" />
              Chi tiêu
            </TabsTrigger>
            <TabsTrigger value="qrcode">
              <QrCode className="h-4 w-4 mr-2" />
              QR Code
            </TabsTrigger>
            <TabsTrigger value="profile">
              <User className="h-4 w-4 mr-2" />
              Tài khoản
            </TabsTrigger>
          </TabsList>

          <TabsContent value="expenses">
            <ExpenseManager />
          </TabsContent>

          <TabsContent value="qrcode">
            <QRCodeManager />
          </TabsContent>

          <TabsContent value="profile">
            <ProfileSettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
