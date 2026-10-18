import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowLeft, Users, MessageCircle, Link2, Ban, CheckCircle, Eye, Plus, Copy, Trash2, Lock, LogOut } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Admin() {
  const [, navigate] = useLocation();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [loginLoading, setLoginLoading] = useState(false);
  const [activeSection, setActiveSection] = useState<"users" | "messages" | "tokens">("tokens");
  const [page, setPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [showMessages, setShowMessages] = useState(false);
  const [showCreateToken, setShowCreateToken] = useState(false);
  const [tokenForm, setTokenForm] = useState({ expiresInHours: "24", note: "" });
  const [adminInfo, setAdminInfo] = useState<{ id: number; username: string; displayName: string | null } | null>(null);

  // Check admin session
  const adminMeQuery = trpc.adminAuth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (adminMeQuery.data) {
      setIsLoggedIn(true);
      setAdminInfo(adminMeQuery.data);
    }
  }, [adminMeQuery.data]);

  // Admin mutations
  const loginMutation = trpc.adminAuth.login.useMutation();
  const logoutMutation = trpc.adminAuth.logout.useMutation();

  // Admin queries
  const usersQuery = trpc.admin.users.useQuery(
    { page, limit: 20 },
    { enabled: isLoggedIn && activeSection === "users" }
  );
  const messagesQuery = trpc.admin.messages.useQuery(
    { page, limit: 30 },
    { enabled: isLoggedIn && activeSection === "messages" }
  );
  const userMessagesQuery = trpc.admin.messagesByUser.useQuery(
    { userId: selectedUserId || 0, page: 1, limit: 50 },
    { enabled: !!selectedUserId && showMessages }
  );
  const tokensQuery = trpc.accessToken.list.useQuery(
    { page },
    { enabled: isLoggedIn && activeSection === "tokens" }
  );

  const setStatusMutation = trpc.admin.setUserStatus.useMutation();
  const createTokenMutation = trpc.accessToken.create.useMutation();
  const revokeTokenMutation = trpc.accessToken.revoke.useMutation();

  const handleLogin = async () => {
    if (!loginForm.username || !loginForm.password) {
      toast.error("请输入用户名和密码");
      return;
    }
    setLoginLoading(true);
    try {
      const result = await loginMutation.mutateAsync(loginForm);
      if (result.success) {
        setIsLoggedIn(true);
        setAdminInfo(result.admin!);
        toast.success("登录成功");
      } else {
        toast.error(result.message || "登录失败");
      }
    } catch {
      toast.error("登录失败，请重试");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    setIsLoggedIn(false);
    setAdminInfo(null);
    toast.success("已退出登录");
  };

  const handleToggleStatus = async (userId: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "banned" : "active";
    try {
      await setStatusMutation.mutateAsync({ userId, status: newStatus });
      toast.success(newStatus === "banned" ? "已封禁用户" : "已解封用户");
      usersQuery.refetch();
    } catch {
      toast.error("操作失败");
    }
  };

  const handleCreateToken = async () => {
    try {
      const result = await createTokenMutation.mutateAsync({
        expiresInHours: parseInt(tokenForm.expiresInHours),
        note: tokenForm.note || undefined,
      });
      if (result.success && result.token) {
        const link = `${window.location.origin}/?token=${result.token.token}`;
        await navigator.clipboard.writeText(link);
        toast.success("访问链接已创建并复制到剪贴板");
        setShowCreateToken(false);
        setTokenForm({ expiresInHours: "24", note: "" });
        tokensQuery.refetch();
      }
    } catch {
      toast.error("创建失败");
    }
  };

  const handleRevokeToken = async (id: number) => {
    try {
      await revokeTokenMutation.mutateAsync({ id });
      toast.success("已作废该链接");
      tokensQuery.refetch();
    } catch {
      toast.error("操作失败");
    }
  };

  const copyTokenLink = (token: string) => {
    const link = `${window.location.origin}/?token=${token}`;
    navigator.clipboard.writeText(link);
    toast.success("链接已复制");
  };

  const viewUserMessages = (userId: number) => {
    setSelectedUserId(userId);
    setShowMessages(true);
  };

  // Login page
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <Card className="w-full max-w-sm shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-2xl flex items-center justify-center">
              <Lock className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-xl">管理后台</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">请输入管理员账号密码</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="用户名"
              value={loginForm.username}
              onChange={(e) => setLoginForm(f => ({ ...f, username: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Input
              type="password"
              placeholder="密码"
              value={loginForm.password}
              onChange={(e) => setLoginForm(f => ({ ...f, password: e.target.value }))}
              onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            />
            <Button
              onClick={handleLogin}
              disabled={loginLoading}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              {loginLoading ? "登录中..." : "登录"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")} className="h-9 w-9">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-bold">管理后台</h1>
            <span className="text-xs text-muted-foreground">({adminInfo?.displayName || adminInfo?.username})</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-red-500 hover:text-red-600">
            <LogOut className="w-4 h-4 mr-1" />
            退出
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveSection("tokens"); setPage(1); }}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                <Link2 className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{tokensQuery.data?.total || 0}</p>
                <p className="text-xs text-muted-foreground">访问链接</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveSection("users"); setPage(1); }}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{usersQuery.data?.total || 0}</p>
                <p className="text-xs text-muted-foreground">用户</p>
              </div>
            </CardContent>
          </Card>
          <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => { setActiveSection("messages"); setPage(1); }}>
            <CardContent className="pt-4 pb-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{messagesQuery.data?.total || 0}</p>
                <p className="text-xs text-muted-foreground">消息</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Section tabs */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={activeSection === "tokens" ? "default" : "outline"}
            onClick={() => { setActiveSection("tokens"); setPage(1); }}
            className={activeSection === "tokens" ? "bg-purple-600 hover:bg-purple-700" : ""}
            size="sm"
          >
            <Link2 className="w-4 h-4 mr-1" />
            访问链接
          </Button>
          <Button
            variant={activeSection === "users" ? "default" : "outline"}
            onClick={() => { setActiveSection("users"); setPage(1); }}
            className={activeSection === "users" ? "bg-green-600 hover:bg-green-700" : ""}
            size="sm"
          >
            <Users className="w-4 h-4 mr-1" />
            用户管理
          </Button>
          <Button
            variant={activeSection === "messages" ? "default" : "outline"}
            onClick={() => { setActiveSection("messages"); setPage(1); }}
            className={activeSection === "messages" ? "bg-blue-600 hover:bg-blue-700" : ""}
            size="sm"
          >
            <MessageCircle className="w-4 h-4 mr-1" />
            聊天记录
          </Button>
        </div>

        {/* Access Tokens section */}
        {activeSection === "tokens" && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">访问链接管理</CardTitle>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700" onClick={() => setShowCreateToken(true)}>
                  <Plus className="w-4 h-4 mr-1" />
                  生成链接
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">生成带时效的访问链接，用户只能通过有效链接访问网站</p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {tokensQuery.data?.tokens.map((t: any) => (
                  <div key={t.id} className={`p-3 rounded-xl border ${t.status === "active" ? "bg-green-50 border-green-200" : t.status === "expired" ? "bg-gray-50 border-gray-200" : "bg-red-50 border-red-200"}`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.status === "active" ? "bg-green-100 text-green-700" :
                          t.status === "expired" ? "bg-gray-100 text-gray-600" :
                          "bg-red-100 text-red-700"
                        }`}>
                          {t.status === "active" ? "有效" : t.status === "expired" ? "已过期" : "已作废"}
                        </span>
                        <span className="text-xs text-muted-foreground">有效期 {t.expiresInHours}小时</span>
                      </div>
                      <div className="flex gap-1">
                        {t.status === "active" && (
                          <>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyTokenLink(t.token)} title="复制链接">
                              <Copy className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-red-500" onClick={() => handleRevokeToken(t.id)} title="作废">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <span>创建: {new Date(t.createdAt).toLocaleString("zh-CN")}</span>
                      <span className="mx-2">|</span>
                      <span>过期: {new Date(t.expiresAt).toLocaleString("zh-CN")}</span>
                    </div>
                    {t.note && <p className="text-xs mt-1 text-gray-600">备注: {t.note}</p>}
                  </div>
                ))}
                {(!tokensQuery.data?.tokens || tokensQuery.data.tokens.length === 0) && (
                  <p className="text-center py-8 text-muted-foreground">暂无访问链接，点击"生成链接"创建</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Users section */}
        {activeSection === "users" && (
          <Card>
            <CardContent className="pt-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">用户</th>
                      <th className="pb-3 font-medium">ID</th>
                      <th className="pb-3 font-medium">状态</th>
                      <th className="pb-3 font-medium">注册时间</th>
                      <th className="pb-3 font-medium">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usersQuery.data?.users.map((u: any) => (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full overflow-hidden bg-green-100 shrink-0">
                              {u.avatar && <img src={u.avatar} alt="" className="w-full h-full object-cover" />}
                            </div>
                            <span className="truncate max-w-[120px]">{u.nickname}</span>
                          </div>
                        </td>
                        <td className="py-3 font-mono text-xs">{u.uniqueId}</td>
                        <td className="py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            u.status === "active" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>
                            {u.status === "active" ? "正常" : "封禁"}
                          </span>
                        </td>
                        <td className="py-3 text-xs text-muted-foreground">
                          {new Date(u.createdAt).toLocaleDateString("zh-CN")}
                        </td>
                        <td className="py-3">
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => viewUserMessages(u.id)} title="查看聊天记录">
                              <Eye className="w-3.5 h-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${u.status === "active" ? "text-red-500" : "text-green-500"}`}
                              onClick={() => handleToggleStatus(u.id, u.status)}
                              title={u.status === "active" ? "封禁" : "解封"}
                            >
                              {u.status === "active" ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {usersQuery.data && usersQuery.data.total > 20 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
                  <span className="text-sm text-muted-foreground flex items-center">第 {page} 页</span>
                  <Button variant="outline" size="sm" disabled={page * 20 >= usersQuery.data.total} onClick={() => setPage(p => p + 1)}>下一页</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Messages section */}
        {activeSection === "messages" && (
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-2">
                {messagesQuery.data?.messages.map((msg: any) => (
                  <div key={msg.id} className="p-3 bg-gray-50 rounded-xl text-sm">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-medium text-xs">
                        用户#{msg.senderId} → 用户#{msg.receiverId}
                        {msg.type !== "text" && <span className="ml-1 text-blue-500">[{msg.type === "image" ? "图片" : msg.type === "location" ? "定位" : msg.type}]</span>}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(msg.sentAt).toLocaleString("zh-CN")}
                      </span>
                    </div>
                    {msg.type === "image" ? (
                      <img src={msg.content} alt="图片消息" className="max-w-[200px] rounded-lg mt-1" />
                    ) : (
                      <p className="text-gray-700 break-words">{msg.content}</p>
                    )}
                  </div>
                ))}
                {(!messagesQuery.data?.messages || messagesQuery.data.messages.length === 0) && (
                  <p className="text-center py-8 text-muted-foreground">暂无消息记录</p>
                )}
              </div>

              {messagesQuery.data && messagesQuery.data.total > 30 && (
                <div className="flex justify-center gap-2 mt-4">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>上一页</Button>
                  <span className="text-sm text-muted-foreground flex items-center">第 {page} 页</span>
                  <Button variant="outline" size="sm" disabled={page * 30 >= messagesQuery.data.total} onClick={() => setPage(p => p + 1)}>下一页</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create token dialog */}
      <Dialog open={showCreateToken} onOpenChange={setShowCreateToken}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>生成访问链接</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">有效期</label>
              <Select value={tokenForm.expiresInHours} onValueChange={(v) => setTokenForm(f => ({ ...f, expiresInHours: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1小时</SelectItem>
                  <SelectItem value="6">6小时</SelectItem>
                  <SelectItem value="12">12小时</SelectItem>
                  <SelectItem value="24">1天</SelectItem>
                  <SelectItem value="48">2天</SelectItem>
                  <SelectItem value="72">3天</SelectItem>
                  <SelectItem value="168">7天</SelectItem>
                  <SelectItem value="720">30天</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">备注（可选）</label>
              <Input
                placeholder="例如：给张三的链接"
                value={tokenForm.note}
                onChange={(e) => setTokenForm(f => ({ ...f, note: e.target.value }))}
              />
            </div>
            <Button onClick={handleCreateToken} className="w-full bg-purple-600 hover:bg-purple-700">
              生成并复制链接
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User messages dialog */}
      <Dialog open={showMessages} onOpenChange={setShowMessages}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>用户 #{selectedUserId} 的聊天记录</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-2">
              {userMessagesQuery.data?.messages.map((msg: any) => (
                <div key={msg.id} className="p-3 bg-gray-50 rounded-xl text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium text-xs ${msg.senderId === selectedUserId ? "text-green-600" : "text-blue-600"}`}>
                      {msg.senderId === selectedUserId ? "发送" : "接收"} → 用户#{msg.senderId === selectedUserId ? msg.receiverId : msg.senderId}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(msg.sentAt).toLocaleString("zh-CN")}
                    </span>
                  </div>
                  {msg.type === "image" ? (
                    <img src={msg.content} alt="图片消息" className="max-w-[200px] rounded-lg mt-1" />
                  ) : (
                    <p className="text-gray-700 break-words">{msg.content}</p>
                  )}
                </div>
              ))}
              {(!userMessagesQuery.data?.messages || userMessagesQuery.data.messages.length === 0) && (
                <p className="text-center py-8 text-muted-foreground">暂无消息记录</p>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
