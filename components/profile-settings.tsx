"use client"

import type React from "react"

import { useState } from "react"
import { useAuth } from "@/lib/auth-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

export default function ProfileSettings() {
  const { currentUser, updateUserProfile } = useAuth()
  const [displayName, setDisplayName] = useState(currentUser?.displayName || "")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault()

    if (newPassword && newPassword !== confirmPassword) {
      toast({
        title: "Lỗi",
        description: "Mật khẩu xác nhận không khớp",
        variant: "destructive",
      })
      return
    }

    setLoading(true)

    const success = await updateUserProfile(displayName, newPassword || undefined)

    if (success) {
      toast({
        title: "Cập nhật thành công",
        description: "Thông tin tài khoản đã được cập nhật",
      })
      setNewPassword("")
      setConfirmPassword("")
    } else {
      toast({
        title: "Cập nhật thất bại",
        description: "Có lỗi xảy ra, vui lòng thử lại",
        variant: "destructive",
      })
    }

    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cài đặt tài khoản</CardTitle>
        <CardDescription>Cập nhật thông tin cá nhân của bạn</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleUpdateProfile} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="username">Tên đăng nhập</Label>
            <Input id="username" value={currentUser?.username} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="displayName">Tên hiển thị</Label>
            <Input
              id="displayName"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Nhập tên hiển thị"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="newPassword">Mật khẩu mới (để trống nếu không đổi)</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nhập mật khẩu mới"
            />
          </div>

          {newPassword && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Xác nhận mật khẩu mới</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại mật khẩu mới"
              />
            </div>
          )}

          <Button type="submit" disabled={loading}>
            {loading ? "Đang cập nhật..." : "Cập nhật thông tin"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
