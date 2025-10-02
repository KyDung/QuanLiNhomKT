import { db } from "./firebase"
import { doc, setDoc, getDoc } from "firebase/firestore"

export interface User {
  id: string
  username: string
  displayName: string
  password: string
  balance: number
  qrCodeUrl?: string
}

const defaultUsers: User[] = [
  {
    id: "admin1",
    username: "admin1",
    displayName: "Kỳ Dũng",
    password: "123456",
    balance: 0,
  },
  {
    id: "admin2",
    username: "admin2",
    displayName: "Ánh Dương",
    password: "123456",
    balance: 0,
  },
  {
    id: "admin3",
    username: "admin3",
    displayName: "Anh Đức",
    password: "123456",
    balance: 0,
  },
]

export async function initializeUsers() {
  try {
    for (const user of defaultUsers) {
      const userRef = doc(db, "users", user.id)
      const userSnap = await getDoc(userRef)

      if (!userSnap.exists()) {
        await setDoc(userRef, user)
        console.log(`User ${user.username} initialized`)
      } else {
        // Cập nhật displayName nếu user đã tồn tại
        const existingUser = userSnap.data() as User
        if (existingUser.displayName !== user.displayName || existingUser.balance === undefined) {
          await setDoc(userRef, {
            ...existingUser,
            displayName: user.displayName,
            balance: existingUser.balance || 0 // Đảm bảo balance không undefined
          }, { merge: true })
          console.log(`User ${user.username} updated`)
        }
      }
    }
    return true
  } catch (error) {
    console.error("Error initializing users:", error)
    return false
  }
}
