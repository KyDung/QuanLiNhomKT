import { initializeApp, getApps } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"

const firebaseConfig = {
  apiKey: "AIzaSyAfhXQYVYs33RWGfODvjBDKYKYAp_5xnA4",
  authDomain: "quanli-ktap.firebaseapp.com",
  projectId: "quanli-ktap",
  storageBucket: "quanli-ktap.firebasestorage.app",
  messagingSenderId: "608699375747",
  appId: "1:608699375747:web:bf65b9ab6a66d5fc0bfbb6",
  measurementId: "G-5Y9K1X81JW",
}

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
const auth = getAuth(app)
const db = getFirestore(app)
const storage = getStorage(app)

export { app, auth, db, storage }
