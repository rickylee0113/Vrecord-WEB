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

console.log("正在初始化 Firebase (src)...");

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
  
  // 設定登入狀態持久化
  setPersistence(authInstance, browserLocalPersistence).then(() => {
     console.log("Firebase Persistence 設定成功 (src)");
  }).catch((err) => {
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

export const signInWithPopup = async (auth: any, provider: any) => {
  console.log("嘗試執行 signInWithPopup (src)...");

  if (!auth) {
    const msg = "Firebase Auth 尚未初始化，無法登入 (auth instance is null)。";
    console.error(msg);
    alert(msg);
    return;
  }

  if (window.location.protocol === 'file:') {
      alert("錯誤：Google 登入不支援 'file://' 協定。\n請上傳至伺服器或使用 'npm run dev' 在 localhost 執行。");
      return;
  }

  try {
    console.log("呼叫 firebaseSignInWithPopup...");
    const result = await firebaseSignInWithPopup(auth, provider);
    console.log("登入成功!", result.user.email);
    return result;
  } catch (error: any) {
    console.error("登入發生錯誤 Details:", error);
    if (error.code === 'auth/operation-not-supported-in-this-environment') {
        alert("登入失敗：環境不支援 (Auth not supported)。\n請確認您使用的是 http:// 或 https:// 協定，且瀏覽器未封鎖第三方 Cookie。");
    } else if (error.code === 'auth/unauthorized-domain') {
        alert(`登入失敗：網域未授權。\n目前的網域是: ${window.location.hostname}\n請前往 Firebase Console -> Authentication -> Settings -> Authorized domains 將其加入。`);
    } else if (error.code === 'auth/popup-closed-by-user') {
        console.log("使用者關閉了登入視窗");
    } else if (error.code === 'auth/popup-blocked') {
        alert("登入視窗被封鎖，請允許本網站顯示彈出式視窗 (Popup)。");
    } else {
        alert(`登入失敗: ${error.message} (${error.code})`);
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