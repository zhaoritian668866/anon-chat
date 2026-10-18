import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { MessageCircle, RefreshCw, LogIn, UserPlus, Copy, Check } from "lucide-react";
import { useChatUser } from "@/contexts/ChatUserContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { generateNickname, getAvatarUrl, AVATAR_STYLES } from "@/lib/random-identity";

export default function Home() {
  const [, navigate] = useLocation();
  const { setUser, isLoggedIn } = useChatUser();
  const [mode, setMode] = useState<"welcome" | "register" | "login">("welcome");
  const [nickname, setNickname] = useState(generateNickname());
  const [avatarStyle, setAvatarStyle] = useState<string>(AVATAR_STYLES[0].id);
  const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).slice(2));
  const [loginId, setLoginId] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [registeredId, setRegisteredId] = useState<string | null>(null);

  const registerMutation = trpc.chatUser.register.useMutation();
  const loginMutation = trpc.chatUser.login.useMutation();

  // If already logged in, redirect to chat
  if (isLoggedIn) {
    navigate("/chat");
    return null;
  }

  const refreshAvatar = () => {
    setAvatarSeed(Math.random().toString(36).slice(2));
  };

  const refreshNickname = () => {
    setNickname(generateNickname());
  };

  const handleRegister = async () => {
    if (!nickname.trim()) {
      toast.error("请输入昵称");
      return;
    }
    setLoading(true);
    try {
      const avatar = getAvatarUrl(avatarStyle, avatarSeed);
      const result = await registerMutation.mutateAsync({
        nickname: nickname.trim(),
        avatar,
        avatarStyle,
      });
      if (result.success && result.user) {
        setRegisteredId(result.user.uniqueId);
        setUser(result.user as any);
      } else {
        toast.error(result.message || "注册失败");
      }
    } catch (e: any) {
      toast.error("注册失败，请重试");
    }
    setLoading(false);
  };

  const handleLogin = async () => {
    if (!loginId.trim()) {
      toast.error("请输入你的ID");
      return;
    }
    setLoading(true);
    try {
      const result = await loginMutation.mutateAsync({ uniqueId: loginId.trim() });
      if (result.success && result.user) {
        setUser(result.user as any);
        toast.success("登录成功！");
        navigate("/chat");
      } else {
        toast.error(result.message || "登录失败");
      }
    } catch (e: any) {
      toast.error("登录失败，请重试");
    }
    setLoading(false);
  };

  const copyId = async () => {
    if (!registeredId) return;
    try {
      await navigator.clipboard.writeText(registeredId);
      setCopied(true);
      toast.success("ID已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("复制失败");
    }
  };

  const goToChat = () => {
    navigate("/chat");
  };

  // Registration success screen
  if (registeredId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="pt-8 pb-8 px-6 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">注册成功！</h2>
            <p className="text-muted-foreground mb-6">请牢记你的专属ID，可用于在其他设备登录</p>

            <div className="bg-green-50 border-2 border-green-200 rounded-xl p-4 mb-6">
              <p className="text-sm text-muted-foreground mb-1">你的专属ID</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-mono font-bold text-green-700 tracking-widest">{registeredId}</span>
                <Button variant="ghost" size="icon" onClick={copyId} className="h-8 w-8">
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground mb-6">
              此ID是你唯一的登录凭证，请妥善保管。换设备时使用此ID即可恢复所有聊天记录和好友。
            </p>

            <Button onClick={goToChat} className="w-full h-12 text-base bg-green-600 hover:bg-green-700 rounded-xl">
              <MessageCircle className="w-5 h-5 mr-2" />
              开始聊天
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">匿名聊天</h1>
          <p className="text-muted-foreground mt-2">无需注册邮箱，即刻开聊</p>
        </div>

        {/* Welcome mode */}
        {mode === "welcome" && (
          <Card className="shadow-xl border-0">
            <CardContent className="pt-8 pb-8 px-6 space-y-4">
              <Button
                onClick={() => setMode("register")}
                className="w-full h-14 text-base bg-green-600 hover:bg-green-700 rounded-xl"
              >
                <UserPlus className="w-5 h-5 mr-2" />
                创建新身份
              </Button>
              <Button
                onClick={() => setMode("login")}
                variant="outline"
                className="w-full h-14 text-base rounded-xl border-green-200 text-green-700 hover:bg-green-50"
              >
                <LogIn className="w-5 h-5 mr-2" />
                使用ID登录
              </Button>
              <p className="text-xs text-center text-muted-foreground pt-2">
                创建新身份会生成一个专属ID，你可以用它在任何设备登录
              </p>
            </CardContent>
          </Card>
        )}

        {/* Register mode */}
        {mode === "register" && (
          <Card className="shadow-xl border-0">
            <CardContent className="pt-6 pb-6 px-6">
              {/* Avatar */}
              <div className="flex flex-col items-center mb-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-green-100 bg-white">
                    <img
                      src={getAvatarUrl(avatarStyle, avatarSeed)}
                      alt="avatar"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    onClick={refreshAvatar}
                    className="absolute -bottom-1 -right-1 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center hover:bg-green-700 transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Avatar style selector */}
                <div className="flex flex-wrap justify-center gap-1.5 mt-4">
                  {AVATAR_STYLES.map((style) => (
                    <button
                      key={style.id}
                      onClick={() => { setAvatarStyle(style.id); refreshAvatar(); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all ${
                        avatarStyle === style.id
                          ? "bg-green-600 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Nickname */}
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">昵称</label>
                <div className="flex gap-2">
                  <Input
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder="输入你的昵称"
                    maxLength={50}
                    className="rounded-xl"
                  />
                  <Button variant="outline" size="icon" onClick={refreshNickname} className="shrink-0 rounded-xl">
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Buttons */}
              <Button
                onClick={handleRegister}
                disabled={loading || !nickname.trim()}
                className="w-full h-12 text-base bg-green-600 hover:bg-green-700 rounded-xl"
              >
                {loading ? "创建中..." : "创建身份"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setMode("welcome")}
                className="w-full mt-2 text-muted-foreground"
              >
                返回
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Login mode */}
        {mode === "login" && (
          <Card className="shadow-xl border-0">
            <CardContent className="pt-8 pb-8 px-6">
              <div className="mb-6">
                <label className="text-sm font-medium text-gray-700 mb-1.5 block">输入你的专属ID</label>
                <Input
                  value={loginId}
                  onChange={(e) => setLoginId(e.target.value.toUpperCase())}
                  placeholder="例如: A3B7K9"
                  maxLength={16}
                  className="rounded-xl text-center text-xl font-mono tracking-widest h-14"
                />
              </div>

              <Button
                onClick={handleLogin}
                disabled={loading || !loginId.trim()}
                className="w-full h-12 text-base bg-green-600 hover:bg-green-700 rounded-xl"
              >
                {loading ? "登录中..." : "登录"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setMode("welcome")}
                className="w-full mt-2 text-muted-foreground"
              >
                返回
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer features */}
        <div className="flex justify-center gap-8 mt-8">
          <div className="text-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <MessageCircle className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs text-muted-foreground">即时聊天</span>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <UserPlus className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs text-muted-foreground">添加好友</span>
          </div>
          <div className="text-center">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-1">
              <LogIn className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-xs text-muted-foreground">跨设备登录</span>
          </div>
        </div>
      </div>
    </div>
  );
}
