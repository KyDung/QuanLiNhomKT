"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth-context"
import { db } from "@/lib/firebase"
import { doc, updateDoc, getDocs, collection } from "firebase/firestore"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { QrCode, ImageIcon } from "lucide-react"
import type { User } from "@/lib/init-users"

export default function QRCodeManager() {
  const { currentUser, refreshUser } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const { toast } = useToast()

  useEffect(() => {
    // Load all users
    const loadUsers = async () => {
      const usersSnapshot = await getDocs(collection(db, "users"))
      const usersData = usersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as User)
      setUsers(usersData)
    }
    loadUsers()
  }, [])

  return (
    <div className="space-y-6">
      {/* QR Code Information */}
      <Card>
        <CardHeader>
          <CardTitle>Mã QR thanh toán</CardTitle>
          <CardDescription>Sử dụng mã QR để chuyển tiền cho các thành viên</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground mb-2">
              <strong>Hướng dẫn:</strong> Bạn có thể đặt ảnh QR code của mình vào thư mục public với tên file theo format: qr-[username].png
            </p>
            <p className="text-xs text-muted-foreground">
              Ví dụ: public/qr-admin1.png, public/qr-admin2.png
            </p>
          </div>
        </CardContent>
      </Card>

      {/* All Users QR Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Mã QR của các thành viên</CardTitle>
          <CardDescription>Xem mã QR thanh toán của tất cả thành viên</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {users.map((user) => (
              <div key={user.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="bg-primary rounded-full p-2">
                    <QrCode className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <div>
                    <p className="font-semibold">{user.displayName}</p>
                    <p className="text-sm text-muted-foreground">{user.username}</p>
                  </div>
                </div>

                {/* Check if QR code file exists in public folder */}
                <div className="border rounded-lg p-3 bg-muted flex justify-center">
                  <img
                    src={`/qr-${user.username}.png`}
                    alt={`${user.displayName} QR Code`}
                    className="max-w-full max-h-48 object-contain"
                    onError={(e) => {
                      // If image fails to load, show placeholder
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.nextElementSibling?.classList.remove('hidden')
                    }}
                  />
                  <div className="hidden flex flex-col items-center justify-center text-muted-foreground p-8">
                    <QrCode className="h-12 w-12 mb-2 opacity-50" />
                    <p className="text-sm">Chưa có mã QR</p>
                    <p className="text-xs text-center mt-1">Đặt file qr-{user.username}.png vào thư mục public</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
