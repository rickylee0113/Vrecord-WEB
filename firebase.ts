import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup as firebaseSignInWithPopup, 
  signOut as firebaseSignOut, 
  onAuthStateChanged as firebaseOnAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  User as FirebaseUser 
} from 'firebase/auth';

// Firebase 設定 (公開識別資訊)
const firebaseConfig = {
  apiKey: "AIzaSyDFrrBfXXrpbq9Ug2UMOynOgfBdQElSTMw",
  authDomain: "vrecweb-2f883.firebaseapp.com",
  projectId: "vrecweb-2f883",
  storageBucket: "vrecweb-2f883.firebasestorage.app",
  messagingSenderId: "760822662374",
  appId: "1:760822662374:web:0550cf89856f29bebb6727"
};

let app;
let authInstance: any;
let provider: any;

try {
  app = initializeApp(firebaseConfig);
  authInstance = getAuth(app);
  provider = new GoogleAuthProvider();
  
  // 設定登入狀態持久化 (Local Persistence)
  // 這樣重新整理頁面後，使用者仍然保持登入狀態
  setPersistence(authInstance, browserLocalPersistence).catch((err) => {
    console.warn("Firebase Auth persistence setup failed:", err);
  });
} catch (error) {
  console.error("Firebase 初始化失敗 (Init Error):", error);
}

// 匯出 User 型別
export type User = FirebaseUser;

// 匯出 auth 實例與 provider
export const auth = authInstance;
export const googleProvider = provider;

// 包裝原始 Firebase 函式以符合 App 介面
export const signInWithPopup = async (auth: any, provider: any) => {
  if (!auth) {
    alert("Firebase 初始化失敗，無法登入。");
    return;
  }

  // 檢查協定：Google 登入不支援 file:// (直接點兩下打開 HTML)
  if (window.location.protocol === 'file:') {
      alert("錯誤：Google 登入不支援 'file://' 協定。\n請上傳至伺服器或使用 'npm run dev' 在 localhost 執行。");
      return;
  }

  try {
    return await firebaseSignInWithPopup(auth, provider);
  } catch (error: any) {
    console.error("登入錯誤 Details:", error);
    if (error.code === 'auth/operation-not-supported-in-this-environment') {
        alert("登入失敗：環境不支援。\n請確認您使用的是 http:// 或 https:// 協定 (不要用 file://)，且瀏覽器未封鎖第三方 Cookie。");
    } else if (error.code === 'auth/unauthorized-domain') {
        alert(`登入失敗：網域未授權。\n目前的網域是: ${window.location.hostname}\n請前往 Firebase Console -> Authentication -> Settings -> Authorized domains 將其加入。`);
    } else if (error.code === 'auth/popup-closed-by-user') {
        console.log("使用者取消登入");
    } else {
        alert(`登入失敗: ${error.message}`);
    }
    throw error;
  }
};

export const signOut = async (auth: any) => {
  if (!auth) return;
  return firebaseSignOut(auth);
};

export const onAuthStateChanged = (auth: any, callback: (user: User | null) => void) => {
  if (!auth) {
    callback(null);
    return () => {};
  }
  return firebaseOnAuthStateChanged(auth, callback);
};