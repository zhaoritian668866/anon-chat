import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, RefreshCw, Save, Copy } from "lucide-react";
import { useChatUser } from "@/contexts/ChatUserContext";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getAvatarUrl, AVATAR_STYLES } from "@/lib/random-identity";

export default function Profile() {
  const [, navigate] = useLocation();
  const { user, setUser } = useChatUser();

  const [nickname, setNickname] = useState(user?.nickname || "");
  const [avatarStyle, setAvatarStyle] = useState<string>(user?.avatarStyle || "adventurer");
  const [avatarSeed, setAvatarSeed] = useState(Math.random().toString(36).slice(2));
  const [saving, setSaving] = useState(false);

  const updateMutation = trpc.chatUser.updateProfile.useMutation();

  if (!user) {
    navigate("/");
    return null;
  }

  const currentAvatar = getAvatarUrl(avatarStyle, avatarSeed);

  const handleSave = async () => {
    if (!nickname.trim()) {
      toast.error("昵称不能为空");
      return;
    }
    setSaving(true);
    try {
      const result = await updateMutation.mutateAsync({
        userId: user.id,
        nickname: nickname.trim(),
        avatar: currentAvatar,
        avatarStyle,
      });
      if (result.success && result.user) {
        setUser(result.user as any);
        toast.success("个人资料已更新");
        navigate("/chat");
      } else {
        toast.error("更新失败");
      }
    } catch {
      toast.error("更新失败，请重试");
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/chat")} className="h-9 w-9">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">编辑个人资料</h1>
        </div>

        <Card className="shadow-lg border-0">
          <CardContent className="pt-6 pb-6 px-6">
            {/* ID display */}
            <div className="text-center mb-6 p-3 bg-green-50 rounded-xl">
              <p className="text-xs text-muted-foreground mb-1">你的专属ID</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-2xl font-mono font-bold text-green-700 tracking-widest">{user.uniqueId}</span>
                <button onClick={() => { navigator.clipboard.writeText(user.uniqueId); toast.success("已复制"); }}>
                  <Copy className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>

            {/* Avatar */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-green-100 bg-white">
                  <img src={currentAvatar} alt="avatar" className="w-full h-full object-cover" />
                </div>
                <button
                  onClick={() => setAvatarSeed(Math.random().toString(36).slice(2))}
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
                    onClick={() => { setAvatarStyle(style.id); setAvatarSeed(Math.random().toString(36).slice(2)); }}
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
              <Input
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="输入你的昵称"
                maxLength={50}
                className="rounded-xl"
              />
            </div>

            {/* Save button */}
            <Button
              onClick={handleSave}
              disabled={saving || !nickname.trim()}
              className="w-full h-12 text-base bg-green-600 hover:bg-green-700 rounded-xl"
            >
              <Save className="w-4 h-4 mr-2" />
              {saving ? "保存中..." : "保存修改"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
