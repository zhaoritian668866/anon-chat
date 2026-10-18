import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { ShieldX, Clock, Loader2 } from "lucide-react";

const ACCESS_TOKEN_KEY = "anon_chat_access_token";

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function storeAccessToken(token: string) {
  localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken() {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

/**
 * AccessGate wraps the app and ensures a valid access token exists.
 * - If URL has ?token=xxx, validate and store it
 * - If localStorage has a token, validate it
 * - Otherwise show "access denied" page
 */
export default function AccessGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"checking" | "valid" | "invalid" | "expired">("checking");
  const [tokenToCheck, setTokenToCheck] = useState<string | null>(null);

  // Extract token from URL or localStorage on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get("token");

    if (urlToken) {
      setTokenToCheck(urlToken);
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.pathname + url.search);
    } else {
      const stored = getStoredAccessToken();
      if (stored) {
        setTokenToCheck(stored);
      } else {
        setStatus("invalid");
      }
    }
  }, []);

  // Validate token via tRPC
  const validateQuery = trpc.accessToken.validate.useQuery(
    { token: tokenToCheck || "" },
    {
      enabled: !!tokenToCheck,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );

  useEffect(() => {
    if (!tokenToCheck) return;

    if (validateQuery.data) {
      if (validateQuery.data.valid) {
        storeAccessToken(tokenToCheck);
        setStatus("valid");
      } else {
        clearAccessToken();
        // Distinguish expired from invalid
        const msg = validateQuery.data.message || "";
        if (msg.includes("过期")) {
          setStatus("expired");
        } else {
          setStatus("invalid");
        }
      }
    }
    if (validateQuery.error) {
      clearAccessToken();
      setStatus("invalid");
    }
  }, [validateQuery.data, validateQuery.error, tokenToCheck]);

  if (status === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
        <Loader2 className="w-8 h-8 animate-spin text-green-600" />
      </div>
    );
  }

  if (status === "expired") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
        <Card className="w-full max-w-sm shadow-xl border-0">
          <CardContent className="pt-8 pb-8 px-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-amber-100 rounded-2xl flex items-center justify-center">
              <Clock className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">链接已失效</h2>
            <p className="text-muted-foreground text-sm mb-4">
              你的访问链接已过期，无法继续使用。
            </p>
            <p className="text-xs text-muted-foreground">
              请联系管理员获取新的访问链接。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
        <Card className="w-full max-w-sm shadow-xl border-0">
          <CardContent className="pt-8 pb-8 px-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-2xl flex items-center justify-center">
              <ShieldX className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-800 mb-2">访问受限</h2>
            <p className="text-muted-foreground text-sm mb-4">
              此网站需要通过有效的访问链接才能使用。
            </p>
            <p className="text-xs text-muted-foreground">
              请联系管理员获取访问链接。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
