import React, { useState, useEffect } from 'react';
import { Activity, UserCircle } from 'lucide-react';
import { auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User } from './firebase';
import { VolleyTagApp, STORAGE_KEY } from './src/App';

const App = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const [key, setKey] = useState(0);
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            // 如果 Firebase 偵測到使用者，就設定使用者
            // 如果是 Guest 模式，這裡不會觸發，因為 Guest 只是本地 State
            if (currentUser) {
                setUser(currentUser);
            } else {
                // 只有當目前狀態不是 Guest 時才設為 null (避免覆蓋掉剛按下的 Guest)
                setUser(prev => (prev?.uid.startsWith('guest-') ? prev : null));
            }
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        setIsLoggingIn(true);
        try {
            await signInWithPopup(auth, googleProvider);
        } catch (error) {
            console.error("Login failed", error);
            // Alert is handled in firebase.ts
        } finally {
            setIsLoggingIn(false);
        }
    };

    const handleGuestLogin = () => {
        const guestUser = {
            uid: 'guest-' + Date.now(),
            displayName: '訪客教練',
            email: 'guest@volleytag.pro',
            photoURL: '',
            emailVerified: true,
            isAnonymous: true,
            metadata: {},
            providerData: [],
            refreshToken: '',
            tenantId: null,
            delete: async () => {},
            getIdToken: async () => '',
            getIdTokenResult: async () => ({} as any),
            reload: async () => {},
            toJSON: () => ({}),
            phoneNumber: null,
            providerId: 'guest',
        } as unknown as User;
        setUser(guestUser);
    };

    const handleLogout = async () => {
        try {
            if (user?.uid?.startsWith('guest-')) {
                setUser(null); // 訪客直接清除 State
            } else {
                await signOut(auth); // Google 用戶呼叫 Firebase 登出
                setUser(null);
            }
        } catch (error) {
            console.error("Logout failed", error);
        }
    };

    const reset = () => {
        localStorage.removeItem(STORAGE_KEY);
        setKey(k => k + 1);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4">
                <div className="w-full max-w-md bg-slate-800 p-8 rounded-2xl shadow-2xl border border-slate-700 text-center animate-fade-in-up">
                    <div className="flex justify-center mb-6">
                        <div className="bg-slate-700 p-4 rounded-full">
                            <Activity size={48} className="text-blue-500" />
                        </div>
                    </div>
                    <h1 className="text-3xl font-black mb-2 tracking-tight">VolleyTag Pro</h1>
                    <p className="text-slate-400 mb-8 font-medium">專業排球數據記錄與分析系統</p>
                    
                    <button 
                        onClick={handleLogin} 
                        disabled={isLoggingIn}
                        className={`w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-6 rounded-xl flex items-center justify-center gap-3 transition-all mb-4 ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 hover:shadow-lg hover:shadow-blue-500/20'}`}
                    >
                        {isLoggingIn ? (
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        ) : (
                            <svg className="w-6 h-6" viewBox="0 0 24 24">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                        )}
                        {isLoggingIn ? '登入中...' : '使用 Google 帳號登入'}
                    </button>

                    <button 
                        onClick={handleGuestLogin} 
                        className="w-full bg-slate-700 hover:bg-slate-600 text-slate-300 font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-3 transition-all hover:text-white"
                    >
                        <UserCircle size={24} />
                        訪客試用 (無需登入)
                    </button>
                    
                    <p className="mt-6 text-xs text-slate-500">
                        登入即代表您同意本系統的使用條款與隱私權政策。
                        <br/>僅限教練與球隊管理員使用。
                    </p>
                </div>
            </div>
        );
    }

    return <VolleyTagApp key={key} onResetApp={reset} user={user} onLogout={handleLogout} />;
};

export default App;